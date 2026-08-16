"""Municipality dataset validation, upload, activation, profiles, and summaries."""
from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.database_models import DatasetRecord
from app.services import data_validator, preprocessing_service
from app.utils.exceptions import BadRequestError, FileTooLargeError, NotFoundError
from app.utils.file_utils import build_stored_filename, is_within_directory
from app.utils.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/data", tags=["data"])


async def _read_upload_as_dataframe(file: UploadFile) -> tuple[pd.DataFrame, bytes]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise BadRequestError("Only .csv files are accepted.")
    raw_bytes = await file.read()
    if not raw_bytes:
        raise BadRequestError("The uploaded file is empty.")
    if len(raw_bytes) > settings.max_upload_bytes:
        raise FileTooLargeError(
            f"File exceeds the {settings.max_upload_mb} MB upload limit.",
            details=f"Received {len(raw_bytes) / (1024 * 1024):.2f} MB.",
        )
    try:
        frame = pd.read_csv(pd.io.common.BytesIO(raw_bytes))
    except Exception as exc:  # noqa: BLE001
        raise BadRequestError("The file could not be read as CSV.", details=str(exc)) from exc
    return frame, raw_bytes


@router.post("/validate")
async def validate_dataset(file: UploadFile = File(...)) -> dict:
    frame, _ = await _read_upload_as_dataframe(file)
    return data_validator.validate_dataframe(frame).to_payload()


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...), session: Session = Depends(get_session)) -> dict:
    frame, raw_bytes = await _read_upload_as_dataframe(file)
    result = data_validator.validate_dataframe(frame)
    if not result.valid:
        raise BadRequestError(
            "The municipality dataset did not pass validation and was not saved.",
            details=f"{len(result.errors)} blocking error(s) were found.",
        )

    dataset_id, stored_filename = build_stored_filename(file.filename)

    # Vercel Functions do not provide durable local file storage. Store the
    # validated CSV bytes in Postgres. Local runs retain the disk copy for
    # backwards compatibility and easier inspection.
    if not settings.is_vercel:
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        destination = settings.uploads_dir / stored_filename
        if not is_within_directory(settings.uploads_dir, destination):
            raise BadRequestError("Invalid file name.")
        destination.write_bytes(raw_bytes)

    record = DatasetRecord(
        id=dataset_id,
        original_file_name=file.filename,
        stored_file_name=stored_filename,
        file_content=raw_bytes,
        start_date=pd.to_datetime(result.start_date).date() if result.start_date else None,
        end_date=pd.to_datetime(result.end_date).date() if result.end_date else None,
        row_count=result.total_rows,
        validation_status="PASS",
        validation_summary_json=result.to_payload(),
        is_active=False,
        data_classification=preprocessing_service.DATA_CLASSIFICATION,
    )
    session.add(record)
    session.commit()
    return {
        "dataset_id": dataset_id,
        "original_file_name": file.filename,
        "safe_stored_file_name": stored_filename,
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "date_range": {"start_date": result.start_date, "end_date": result.end_date},
        "row_count": result.total_rows,
        "municipality_count": result.municipality_count,
        "validation_summary": result.to_payload(),
        "became_active_dataset": False,
    }


@router.post("/activate/{dataset_id}")
def activate_dataset(dataset_id: str, session: Session = Depends(get_session)) -> dict:
    target = session.get(DatasetRecord, dataset_id)
    if target is None:
        raise NotFoundError(f"Dataset '{dataset_id}' was not found.")
    for record in session.exec(select(DatasetRecord).where(DatasetRecord.is_active == True)):  # noqa: E712
        record.is_active = False
        session.add(record)
    target.is_active = True
    session.add(target)
    session.commit()
    preprocessing_service.invalidate_active_dataframe_cache()
    return {"dataset_id": dataset_id, "is_active": True}


@router.get("/active")
def get_active_dataset(session: Session = Depends(get_session)) -> dict:
    record = preprocessing_service.get_active_dataset_record(session)
    if record is None:
        raise NotFoundError("No active dataset is registered.")
    return {
        "dataset_id": record.id,
        "active_dataset_name": record.original_file_name,
        "coverage_area": preprocessing_service.COVERAGE_AREA,
        "date_range": {
            "start_date": record.start_date.isoformat() if record.start_date else None,
            "end_date": record.end_date.isoformat() if record.end_date else None,
        },
        "row_count": record.row_count,
        "municipality_count": record.validation_summary_json.get("municipality_count", 12),
        "last_date": record.end_date.isoformat() if record.end_date else None,
        "target_column": preprocessing_service.TARGET_COLUMN,
        "data_classification": record.data_classification,
        "missing_data_summary": record.validation_summary_json.get("missing_values", {}),
        "is_synthetic": True,
        "location_aware": True,
    }


@router.get("/municipalities")
def get_municipalities(session: Session = Depends(get_session)) -> dict:
    frame, _ = preprocessing_service.load_active_dataframe(session)
    if frame is None:
        raise NotFoundError("No active municipality dataset is available.")
    profiles = preprocessing_service.municipality_profiles(frame)
    return {"count": len(profiles), "municipalities": profiles}


@router.get("/summary")
def get_data_summary(
    municipality: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> dict:
    frame, record = preprocessing_service.load_active_dataframe(session)
    if frame is None:
        raise NotFoundError("No active dataset is available to summarize.")
    summary = preprocessing_service.build_data_summary(frame, municipality=municipality)
    summary["active_dataset_name"] = record.original_file_name
    summary["data_classification"] = record.data_classification
    return summary

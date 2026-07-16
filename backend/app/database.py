"""Database connection and schema initialization for local and Vercel deployments."""
from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings
from app.utils.logging_config import get_logger

logger = get_logger(__name__)


def _normalize_database_url(url: str) -> str:
    value = (url or "").strip()
    # Vercel Marketplace providers commonly expose postgresql:// or postgres://.
    # Explicitly select psycopg 3, which is included in the Vercel requirements.
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value[len("postgres://"):]
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value[len("postgresql://"):]
    return value


DATABASE_URL = _normalize_database_url(settings.database_url)
IS_SQLITE = DATABASE_URL.startswith("sqlite:")
connect_args = {"check_same_thread": False} if IS_SQLITE else {}
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=not IS_SQLITE,
)


def _column_names(connection, table_name: str) -> set[str]:
    if IS_SQLITE:
        rows = connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        return {str(row[1]) for row in rows}
    inspector = inspect(connection)
    return {str(column["name"]) for column in inspector.get_columns(table_name)}


def _migrate_existing_tables() -> None:
    """Apply small compatibility migrations without altering model calculations."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "forecast_records" in table_names:
        with engine.begin() as connection:
            columns = _column_names(connection, "forecast_records")
            additions = {
                "municipality": "TEXT",
                "latitude": "DOUBLE PRECISION" if not IS_SQLITE else "REAL",
                "longitude": "DOUBLE PRECISION" if not IS_SQLITE else "REAL",
            }
            for name, sql_type in additions.items():
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE forecast_records ADD COLUMN {name} {sql_type}"))
                    logger.info("Added forecast_records.%s during migration.", name)

    if "dataset_records" in table_names:
        with engine.begin() as connection:
            columns = _column_names(connection, "dataset_records")
            if "file_content" not in columns:
                binary_type = "BYTEA" if not IS_SQLITE else "BLOB"
                connection.execute(text(f"ALTER TABLE dataset_records ADD COLUMN file_content {binary_type}"))
                logger.info("Added dataset_records.file_content during migration.")


def init_db() -> None:
    if IS_SQLITE:
        # The local application writes under backend/data/processed. Vercel's
        # emergency fallback writes only under /tmp.
        database_path = DATABASE_URL.removeprefix("sqlite:///")
        if database_path and database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    from app.models import database_models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _migrate_existing_tables()
    logger.info("Database tables ready (%s).", "SQLite" if IS_SQLITE else "Postgres")


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

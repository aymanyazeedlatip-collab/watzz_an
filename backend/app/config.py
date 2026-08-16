"""Central application settings for the municipality-aware WATTZAN backend."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "WATTZAN"
    app_version: str = "16.2.9"
    app_timezone: str = "Asia/Manila"
    database_url: str = "sqlite:///./data/processed/wattzan.db"
    cors_origins: str = "http://127.0.0.1:8000,http://localhost:8000"
    max_upload_mb: int = 75
    deployment_platform: str = "local"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_models: str = "gemini-3.1-flash-lite"
    gemini_timeout_seconds: int = 45
    gemini_max_output_tokens: int = 4096
    gemini_retry_output_tokens: int = 8192
    gemini_thinking_level: str = "low"
    gemini_max_context_chars: int = 28000

    @property
    def gemini_configured(self) -> bool:
        return _is_real_gemini_key(self.gemini_api_key)

    @property
    def artifacts_dir(self) -> Path:
        return BACKEND_DIR / "artifacts"

    @property
    def province_baseline_dir(self) -> Path:
        return self.artifacts_dir / "province_baseline"

    @property
    def municipality_artifacts_dir(self) -> Path:
        return self.artifacts_dir / "municipality_v1"

    @property
    def production_artifacts_dir(self) -> Path:
        return self.municipality_artifacts_dir / "production"

    @property
    def evaluation_artifacts_dir(self) -> Path:
        return self.municipality_artifacts_dir / "evaluation"

    @property
    def metrics_dir(self) -> Path:
        return self.municipality_artifacts_dir / "metrics"

    @property
    def feature_config_dir(self) -> Path:
        return self.municipality_artifacts_dir / "feature_config"

    @property
    def default_data_dir(self) -> Path:
        return BACKEND_DIR / "data" / "default"

    @property
    def uploads_dir(self) -> Path:
        return BACKEND_DIR / "data" / "uploads"

    @property
    def processed_data_dir(self) -> Path:
        return BACKEND_DIR / "data" / "processed"

    @property
    def is_vercel(self) -> bool:
        return bool(os.getenv("VERCEL") or self.deployment_platform.lower() == "vercel")

    @property
    def writable_runtime_dir(self) -> Path:
        # Vercel Functions should not persist application data on the bundled
        # filesystem. /tmp is used only for temporary fallback files.
        return Path("/tmp/wattzan") if self.is_vercel else self.processed_data_dir

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


def _clean_env_value(value: Any) -> str:
    """Normalize values commonly produced by Windows text editors."""
    cleaned = str(value or "").lstrip("\ufeff").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {"'", '"'}:
        cleaned = cleaned[1:-1].strip()
    return cleaned


def _is_real_gemini_key(value: Any) -> bool:
    key = _clean_env_value(value)
    placeholders = {
        "PASTE_YOUR_GEMINI_API_KEY_HERE",
        "YOUR_GEMINI_API_KEY",
        "PASTE_YOUR_REAL_API_KEY_HERE",
        "YOUR_EXISTING_API_KEY",
    }
    return bool(key and key.upper() not in placeholders and len(key) >= 10)


def _candidate_env_paths() -> list[Path]:
    candidates = [
        BACKEND_DIR / ".env",
        BACKEND_DIR / ".env.txt",
        PROJECT_DIR / ".env",
        PROJECT_DIR / ".env.txt",
        Path.cwd() / ".env",
        Path.cwd() / ".env.txt",
    ]
    unique: list[Path] = []
    seen: set[str] = set()
    for path in candidates:
        resolved = str(path.resolve())
        if resolved not in seen:
            seen.add(resolved)
            unique.append(path)
    return unique


def _read_simple_env(path: Path) -> dict[str, str]:
    """Read the small GEMINI section without depending on process cwd."""
    values: dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError):
        return values
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        key = key.strip().lstrip("\ufeff").upper()
        if not key.startswith("GEMINI_"):
            continue
        values[key] = _clean_env_value(raw_value)
    return values


def refresh_gemini_settings() -> dict[str, Any]:
    """Reload Gemini settings safely, including common Windows file mistakes.

    This function never returns or logs the API key itself.
    """
    checked = _candidate_env_paths()
    existing = [path for path in checked if path.is_file()]

    source = "process environment" if _is_real_gemini_key(os.getenv("GEMINI_API_KEY")) else None
    selected_key = _clean_env_value(os.getenv("GEMINI_API_KEY")) if source else ""
    selected_values: dict[str, str] = {}
    placeholder_files: list[str] = []

    for path in existing:
        values = _read_simple_env(path)
        candidate = values.get("GEMINI_API_KEY", "")
        if candidate and not _is_real_gemini_key(candidate):
            placeholder_files.append(str(path))
        if not selected_key and _is_real_gemini_key(candidate):
            selected_key = candidate
            selected_values = values
            source = str(path)
            break

    if selected_key:
        settings.gemini_api_key = selected_key
        model = _clean_env_value(selected_values.get("GEMINI_MODEL") or os.getenv("GEMINI_MODEL"))
        fallbacks = _clean_env_value(selected_values.get("GEMINI_FALLBACK_MODELS") or os.getenv("GEMINI_FALLBACK_MODELS"))
        timeout = _clean_env_value(selected_values.get("GEMINI_TIMEOUT_SECONDS") or os.getenv("GEMINI_TIMEOUT_SECONDS"))
        max_tokens = _clean_env_value(selected_values.get("GEMINI_MAX_OUTPUT_TOKENS") or os.getenv("GEMINI_MAX_OUTPUT_TOKENS"))
        retry_tokens = _clean_env_value(selected_values.get("GEMINI_RETRY_OUTPUT_TOKENS") or os.getenv("GEMINI_RETRY_OUTPUT_TOKENS"))
        thinking_level = _clean_env_value(selected_values.get("GEMINI_THINKING_LEVEL") or os.getenv("GEMINI_THINKING_LEVEL"))
        max_context = _clean_env_value(selected_values.get("GEMINI_MAX_CONTEXT_CHARS") or os.getenv("GEMINI_MAX_CONTEXT_CHARS"))
        if model:
            settings.gemini_model = model
        if fallbacks:
            settings.gemini_fallback_models = fallbacks
        if thinking_level and thinking_level.lower() in {"minimal", "low", "medium", "high"}:
            settings.gemini_thinking_level = thinking_level.lower()
        for attr, value in (
            ("gemini_timeout_seconds", timeout),
            ("gemini_max_output_tokens", max_tokens),
            ("gemini_retry_output_tokens", retry_tokens),
            ("gemini_max_context_chars", max_context),
        ):
            if value:
                try:
                    setattr(settings, attr, int(value))
                except ValueError:
                    pass

    example_values = _read_simple_env(BACKEND_DIR / ".env.example")
    key_only_in_example = (
        not selected_key and _is_real_gemini_key(example_values.get("GEMINI_API_KEY", ""))
    )

    return {
        "configured": _is_real_gemini_key(settings.gemini_api_key),
        "configuration_source": source,
        "key_length": len(_clean_env_value(settings.gemini_api_key)) if settings.gemini_configured else 0,
        "checked_paths": [str(path) for path in checked],
        "existing_files": [str(path) for path in existing],
        "placeholder_files": placeholder_files,
        "key_only_in_env_example": key_only_in_example,
    }


settings = Settings()

# Vercel supplies secrets through process environment variables. When no
# persistent DATABASE_URL is configured, use an explicitly temporary SQLite
# fallback so health checks can still start; production deployments should
# connect a Marketplace Postgres database.
if settings.is_vercel:
    settings.deployment_platform = "vercel"
    marketplace_database_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("NEON_DATABASE_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
    )
    if marketplace_database_url:
        settings.database_url = marketplace_database_url
    else:
        settings.database_url = "sqlite:////tmp/wattzan/wattzan.db"
    if not os.getenv("MAX_UPLOAD_MB"):
        # Vercel Function request bodies are limited to 4.5 MB.
        settings.max_upload_mb = 4

# Initial load. The chatbot endpoints refresh again so a newly saved key is
# detected even when uvicorn did not restart after a .env edit.
refresh_gemini_settings()

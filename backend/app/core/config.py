# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Application settings loaded from environment variables and a .env file.

Every configuration value used by the backend lives here. Settings are read
once per process (``lru_cache``) and are engine-agnostic: the database engine
is chosen entirely through ``DATABASE_URL`` (SQLite or MySQL).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# InvoiceOps/backend/app/core/config.py
BACKEND_DIR = Path(__file__).resolve().parents[2]
# InvoiceOps/
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Backend configuration.

    Reads environment variables first, then a ``backend/.env`` file.
    """

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "InvoiceOps API"
    app_version: str = "0.1.0"
    app_env: str = "development"  # development | test | production
    debug: bool = False
    log_level: str = "INFO"
    log_file: str | None = None

    # --- Database ---
    database_url: str = f"sqlite:///{PROJECT_ROOT / 'var' / 'invoiceops.db'}"
    db_echo: bool = False

    # --- Auth ---
    secret_key: str = "dev-only-insecure-secret-key-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # --- Storage ---
    max_upload_mb: int = 25
    upload_dir: str = "var/uploads"

    # --- Master data & contracts (read-only inputs) ---
    master_data_dir: str | None = "../invoiceops-evaluation-dataset/master_data"
    contracts_dir: str = "contracts"

    # --- NVIDIA API (OpenAI compatible) ---
    nvidia_api_key: str = ""
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_text_model: str = "meta/llama-3.3-70b-instruct"
    nvidia_vision_model: str = "qwen/qwen2.5-vl-72b-instruct"
    llm_timeout_seconds: float = 30.0
    llm_retries: int = 2
    llm_temperature: float = 0.0

    # --- PDF tools ---
    pdftotext_bin: str = "pdftotext"
    pdftoppm_bin: str = "pdftoppm"

    # --- Seeded users (development convenience only) ---
    seed_reviewer_email: str = "reviewer@invoiceops.dev"
    seed_reviewer_password: str = "ReviewerPass2026"
    seed_reviewer_name: str = "Alex Reviewer"
    seed_approver_email: str = "approver@invoiceops.dev"
    seed_approver_password: str = "ApproverPass2026"
    seed_approver_name: str = "Jordan Approver"

    # ------------------------------------------------------------------ fields
    @field_validator(
        "log_file",
        "upload_dir",
        "master_data_dir",
        "contracts_dir",
        mode="before",
    )
    @classmethod
    def _resolve_relative_paths(cls, value: object) -> object:
        """Resolve paths relative to the InvoiceOps project root."""
        if value is None or value == "":
            return value
        raw = str(value)
        if raw.startswith("var/") or raw.startswith("var\\"):
            # Internal default storage path.
            return str(PROJECT_ROOT / raw)
        path = Path(raw)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        return str(path)

    @field_validator("database_url", mode="before")
    @classmethod
    def _expand_sqlite_url(cls, value: object) -> object:
        """Expand a relative sqlite path against the project root."""
        if not isinstance(value, str):
            return value
        if value.startswith("sqlite:///") and not value.startswith("sqlite:////"):
            tail = value[len("sqlite:///") :]
            if tail and tail != ":memory:":
                path = Path(tail)
                if not path.is_absolute():
                    return f"sqlite:///{PROJECT_ROOT / path}"
        return value

    # ------------------------------------------------------------------ props
    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.nvidia_api_key)

    @property
    def master_data_path(self) -> Path | None:
        if not self.master_data_dir:
            return None
        return Path(self.master_data_dir)

    @property
    def contracts_path(self) -> Path:
        return Path(self.contracts_dir)

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)

    @property
    def upload_max_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def validate_production(self) -> None:
        """Refuse obviously insecure production settings."""
        if self.is_production:
            if self.secret_key == "dev-only-insecure-secret-key-change-me":
                raise RuntimeError(
                    "SECRET_KEY must be set to a random value when APP_ENV=production"
                )
            if self.llm_enabled and "example" in self.nvidia_base_url:
                raise RuntimeError("NVIDIA_BASE_URL looks like a placeholder")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_production()
    return settings

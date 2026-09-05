# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Health and readiness endpoint (no authentication)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services.master_data import MasterData

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    database_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover - depends on runtime state
        database_ok = False

    master = MasterData(db)
    master_counts = master.counts()
    master_data_loaded = master.ready()

    return {
        "success": database_ok,
        "status": "ok" if database_ok else "degraded",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
        "database": "ok" if database_ok else "error",
        "master_data_loaded": master_data_loaded,
        "master_data_counts": master_counts,
        "llm_enabled": settings.llm_enabled,
    }

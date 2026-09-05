# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""FastAPI application factory for InvoiceOps.

Run locally:
    cd backend && uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(level=settings.log_level, log_file=settings.log_file)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Ensure storage directories exist before accepting traffic.
        settings.upload_path.mkdir(parents=True, exist_ok=True)
        # Master data lives in the database. Seed it with
        # `python -m app.import_master_data` or add records through the
        # master-data API; /health reports whether registers are populated.
        yield

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "InvoiceOps backend: AI-assisted vendor invoice pre-approval "
            "validation (deterministic checks + extraction repair via NVIDIA)."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()

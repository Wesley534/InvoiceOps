# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Aggregates all API routers under one FastAPI APIRouter."""

from fastapi import APIRouter

from app.api.routes import (
    auth,
    decisions,
    health,
    invoices,
    jobs,
    master_data,
    reports,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(invoices.router)
api_router.include_router(jobs.router)
api_router.include_router(reports.router)
api_router.include_router(decisions.router)
api_router.include_router(master_data.router)

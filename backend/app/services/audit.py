# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Audit logging: append-only writes for meaningful application actions."""

from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.user import User


def write_audit(
    db: Session,
    *,
    action: str,
    actor: Optional[User] = None,
    actor_email: Optional[str] = None,
    invoice_id: Optional[str] = None,
    job_id: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> AuditEvent:
    """Append an audit event. Never updated or deleted afterwards."""
    event = AuditEvent(
        action=action,
        actor_email=actor_email or (actor.email if actor else None),
        user_id=actor.id if actor else None,
        invoice_id=invoice_id,
        job_id=job_id,
        detail=detail,
    )
    db.add(event)
    return event

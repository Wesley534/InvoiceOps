# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""SQLAlchemy declarative base with portable naming conventions.

The naming convention keeps generated constraint/index names short and
stable so Alembic migrations behave identically on SQLite and MySQL.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import MetaData, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp for default column values."""
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    """UUID hex string primary key, generated in Python for engine portability."""
    return uuid4().hex


class UuidPkMixin:
    """String(32) UUID-hex primary key with an application-side default."""

    id: Mapped[str] = mapped_column(
        String(32), primary_key=True, default=new_uuid, sort_order=-1
    )


class TimestampMixin:
    """Created/updated audit timestamps written in UTC."""

    created_at: Mapped[datetime] = mapped_column(
        default=utcnow, nullable=False, sort_order=999
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=False, sort_order=1000
    )

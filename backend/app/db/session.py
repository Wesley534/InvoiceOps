# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Engine and session factory built from ``DATABASE_URL``.

One schema, two engines (SQLite or MySQL): the engine is created here from
the configured URL and everything else uses plain SQLAlchemy 2.0 so no SQL
is ever duplicated per engine.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.base import Base  # noqa: F401  (re-export for tooling/migrations)

_engine = None
_session_factory: sessionmaker | None = None


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def _create_engine():
    settings = get_settings()
    url = settings.database_url

    engine_kwargs = {"echo": settings.db_echo, "future": True}
    if _is_sqlite(url):
        # SQLite defaults: allow cross-thread use (background jobs run in a
        # worker thread) and keep a single in-process connection for in-memory
        # test databases.
        engine_kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" in url:
            engine_kwargs["poolclass"] = StaticPool
        else:
            # Make sure the parent directory of the sqlite file exists.
            from pathlib import Path

            db_path = Path(url.split("sqlite:///", 1)[1])
            db_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 1800

    engine = create_engine(url, **engine_kwargs)

    if _is_sqlite(url) and ":memory:" not in url:
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _record):  # pragma: no cover
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

    return engine


def engine():
    """Return the process-wide engine, creating it on first use."""
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


def session_factory() -> sessionmaker:
    """Return the process-wide session factory, creating it on first use."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=engine(), expire_on_commit=False, autoflush=False
        )
    return _session_factory


def create_session() -> Session:
    return session_factory()()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped session."""
    db = create_session()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables (used only by tests and the seed script)."""
    from app.db.base import Base  # noqa: F811

    Base.metadata.create_all(bind=engine())


def reset_db_for_tests() -> None:
    """Drop and recreate all tables (test helper)."""
    global _engine, _session_factory
    if _engine is not None:
        Base.metadata.drop_all(bind=_engine)
    _session_factory = None
    _engine = None
    Base.metadata.create_all(bind=engine())

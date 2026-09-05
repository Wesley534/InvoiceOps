# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Seed the reviewer and approver users (development convenience).

Run:  python -m app.initial_data
Uses the SEED_* environment variables from backend/.env when present.
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.security import hash_password
from app.db.session import create_session, init_db
from app.models.enums import UserRole
from app.models.user import User

logger = logging.getLogger("app.initial_data")


def seed_users() -> None:
    settings = get_settings()
    configure_logging(level="INFO")
    init_db()

    db = create_session()
    try:
        seeds = [
            {
                "email": settings.seed_reviewer_email,
                "name": settings.seed_reviewer_name,
                "password": settings.seed_reviewer_password,
                "role": UserRole.REVIEWER.value,
            },
            {
                "email": settings.seed_approver_email,
                "name": settings.seed_approver_name,
                "password": settings.seed_approver_password,
                "role": UserRole.APPROVER.value,
            },
        ]
        for seed in seeds:
            email = seed["email"].lower().strip()
            existing = db.scalar(select(User).where(User.email == email))
            if existing is not None:
                logger.info("User %s already exists; skipping", email)
                continue
            user = User(
                email=email,
                name=seed["name"],
                password_hash=hash_password(seed["password"]),
                role=seed["role"],
            )
            db.add(user)
            logger.info("Created %s user %s", seed["role"], email)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()

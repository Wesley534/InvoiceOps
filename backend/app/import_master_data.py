# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Seed the master-data tables from the configured CSV directory.

Run:  python -m app.import_master_data

Idempotent: existing records are updated by natural key, new ones created.
Without MASTER_DATA_DIR set the command prints a hint and exits 0 so it is
safe to run in container entrypoints that may legitimately start empty.
"""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import create_session
from app.services.master_data import MasterDataError
from app.services.master_import import load_from_directory

logger = logging.getLogger("app.import_master_data")


def import_master_data() -> bool:
    settings = get_settings()
    configure_logging(level="INFO")
    if settings.master_data_path is None or not settings.master_data_path.exists():
        logger.warning(
            "MASTER_DATA_DIR is not set or does not exist (%s); skipping import. "
            "Add records through the master-data API instead.",
            settings.master_data_path,
        )
        return False

    db = create_session()
    try:
        summary = load_from_directory(db, settings.master_data_path)
        logger.info(
            "Import done: %d vendors created/%d updated, %d POs created/%d updated, "
            "%d receipts created/%d updated, %d processed created/%d updated",
            summary.vendors_created,
            summary.vendors_updated,
            summary.pos_created,
            summary.pos_updated,
            summary.receipts_created,
            summary.receipts_updated,
            summary.processed_created,
            summary.processed_updated,
        )
        return True
    except MasterDataError as exc:
        logger.error("Master data import failed: %s", exc)
        raise SystemExit(1) from exc
    finally:
        db.close()


if __name__ == "__main__":
    import_master_data()

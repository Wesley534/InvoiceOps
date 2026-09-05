# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Document intake tools: PDF text extraction and page rendering.

The backend shell-outs to poppler-utils (``pdftotext`` / ``pdftoppm``),
which is a deterministic, free, offline dependency installed in the Docker
image. Extraction is application code; the LLM is only ever asked to repair
or complete ambiguous fields afterwards.
"""

from __future__ import annotations

import logging
import re
import subprocess
from pathlib import Path
from typing import List

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class PdfToolError(RuntimeError):
    """Raised when a poppler tool is missing or fails."""


def extract_text(path: Path, *, layout: bool = True, timeout_seconds: int = 45) -> str:
    """Extract the text layer of a PDF using ``pdftotext``.

    Returns an empty string for scanned/image-only PDFs (no text layer).
    """
    settings = get_settings()
    args = [settings.pdftotext_bin]
    if layout:
        args.append("-layout")
    args.extend([str(path), "-"])
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        raise PdfToolError(
            "pdftotext not found on PATH (%s). Install poppler-utils." % settings.pdftotext_bin
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise PdfToolError("pdftotext timed out on %s" % path) from exc
    if result.returncode != 0:
        stderr = (result.stderr or b"").decode("utf-8", errors="replace").strip()
        raise PdfToolError("pdftotext failed on %s: %s" % (path, stderr[-500:]))
    return (result.stdout or b"").decode("utf-8", errors="replace")


def render_pages(
    path: Path,
    *,
    first_page: int = 1,
    last_page: int = 3,
    dpi: int = 150,
) -> List[Path]:
    """Render PDF pages to PNGs for the vision path. Returns created files."""
    settings = get_settings()
    output_prefix = path.with_name(path.stem + "_page")
    args = [
        settings.pdftoppm_bin,
        "-f", str(first_page),
        "-l", str(last_page),
        "-r", str(dpi),
        "-png",
        str(path),
        str(output_prefix),
    ]
    try:
        result = subprocess.run(args, capture_output=True, timeout=120, check=False)
    except FileNotFoundError as exc:
        raise PdfToolError(
            "pdftoppm not found on PATH (%s). Install poppler-utils." % settings.pdftoppm_bin
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise PdfToolError("pdftoppm timed out on %s" % path) from exc
    if result.returncode != 0:
        stderr = (result.stderr or b"").decode("utf-8", errors="replace").strip()
        raise PdfToolError("pdftoppm failed on %s: %s" % (path, stderr[-500:]))
    return sorted(p for p in output_prefix.parent.glob(output_prefix.name + "*.png"))


_PAGE_NUMBER_RE = re.compile(r"-(\d+)\.png$")


def ordered_pages(paths: List[Path]) -> List[Path]:
    """Order rendered pages numerically (pdftoppm pads page numbers)."""
    return sorted(paths, key=lambda p: int(_PAGE_NUMBER_RE.search(p.name).group(1)))

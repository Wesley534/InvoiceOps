# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Shared response schemas (pagination, list envelopes)."""

from __future__ import annotations

from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Message(BaseModel):
    detail: str


class Page(BaseModel, Generic[T]):
    """Pagination metadata used by list endpoints. ``PageOut`` adds the API
    envelope fields (success / count / search echo) on top."""

    items: List[T]
    total: int
    page: int
    size: int
    pages: int


class PageOut(Page[T], Generic[T]):
    """Flat list response envelope.

    Every list endpoint returns this shape:

        {
          "success": true,
          "count": 25,        # items on this page
          "search": null,     # echoes the ?q= term when one was supplied
          "items": [...],
          "total": 88,
          "page": 1,
          "size": 25,
          "pages": 4
        }

    Rows inside ``items`` stay plain resource objects (no per-row envelope).
    """

    success: bool = True
    count: int = 0
    search: Optional[str] = None


def page_params(page: int = Field(1, ge=1), size: int = Field(25, ge=1, le=100)) -> tuple[int, int]:
    """Shared pagination query parameters."""
    return page, size

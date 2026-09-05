# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""LLMClient seam plus the NVIDIA (OpenAI-compatible) provider.

The application never asks the model for a decision, prose, or anything other
than schema-shaped field values. Callers own validation: the returned JSON is
re-checked against the extraction contract before it is trusted.
"""

from __future__ import annotations

import base64
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import get_settings
from app.services.llm.prompts import (
    SYSTEM_PROMPT,
    build_text_user_prompt,
    build_vision_user_prompt,
)

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the provider is unavailable or returns unusable output."""


def _data_uri(path: Path) -> str:
    mime = "image/png"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return "data:%s;base64,%s" % (mime, payload)


class LLMClient:
    """Provider seam: text repair and vision field extraction."""

    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = settings.llm_enabled
        self.base_url = settings.nvidia_base_url.rstrip("/")
        self.api_key = settings.nvidia_api_key
        self.text_model = settings.nvidia_text_model
        self.vision_model = settings.nvidia_vision_model
        self.timeout = settings.llm_timeout_seconds
        self.retries = settings.llm_retries
        self.temperature = settings.llm_temperature

    # ------------------------------------------------------------- transport
    def _chat(
        self,
        *,
        messages: List[Dict[str, Any]],
        model: str,
        json_mode: bool,
        max_tokens: int = 1500,
    ) -> Dict[str, Any]:
        """POST to the OpenAI-compatible chat/completions endpoint.

        Retries with exponential backoff on 429/5xx/network errors, up to
        ``self.retries + 1`` attempts.
        """
        if not self.enabled:
            raise LLMError("LLM is not enabled (no NVIDIA_API_KEY configured)")
        url = self.base_url + "/chat/completions"
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": "Bearer " + self.api_key,
            "Content-Type": "application/json",
        }

        last_error: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as http:
                    response = http.post(url, headers=headers, json=body)
                if response.status_code == 429 or response.status_code >= 500:
                    retry_after = float(response.headers.get("Retry-After", "0") or 0)
                    wait = retry_after or (2 ** attempt)
                    logger.warning(
                        "NVIDIA API returned %s; retrying in %.1fs (attempt %d)",
                        response.status_code,
                        wait,
                        attempt + 1,
                    )
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return self._parse_content(content)
            except httpx.TimeoutException as exc:
                last_error = LLMError("NVIDIA API timed out after %.0fs" % self.timeout)
                logger.warning("%s (attempt %d)", last_error, attempt + 1)
                if attempt < self.retries:
                    time.sleep(2 ** attempt)
                    continue
                raise last_error from exc
            except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
                last_error = LLMError("NVIDIA API request failed: %s" % exc)
                logger.warning("%s", last_error)
                if attempt < self.retries and not isinstance(exc, (httpx.HTTPStatusError,)):
                    time.sleep(2 ** attempt)
                    continue
                raise last_error from exc
        raise last_error or LLMError("NVIDIA API request failed")

    @staticmethod
    def _parse_content(content: str) -> Dict[str, Any]:
        text = content.strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            # Model occasionally wraps JSON in ```json fences.
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise LLMError("Model returned non-JSON content")
            parsed = json.loads(text[start : end + 1])
        if not isinstance(parsed, dict):
            raise LLMError("Model returned a non-object JSON value")
        return parsed

    # ------------------------------------------------------------ operations
    def repair_fields(self, document_text: str) -> Dict[str, Any]:
        """Text path: extract/repair fields from a clean text layer."""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_text_user_prompt(document_text)},
        ]
        return self._chat(messages=messages, model=self.text_model, json_mode=True)

    def vision_extract(self, page_images: List[Path]) -> Dict[str, Any]:
        """Vision path: extract fields from rendered page images."""
        content: List[Dict[str, Any]] = [
            {"type": "text", "text": build_vision_user_prompt()}
        ]
        for image in page_images:
            content.append(
                {"type": "image_url", "image_url": {"url": _data_uri(image)}}
            )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ]
        return self._chat(
            messages=messages, model=self.vision_model, json_mode=False, max_tokens=1800
        )

    @staticmethod
    def normalize_output(raw: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize model output into {fields, line_items, missing_fields, notes}."""
        fields = raw.get("fields", raw)
        if not isinstance(fields, dict):
            fields = {}
        if "fields" in raw:
            # {"fields": {"x": "v"}} -> keep values only (may also be value dicts)
            fields = {
                k: (v.get("value") if isinstance(v, dict) and "value" in v else v)
                for k, v in fields.items()
            }
        items = raw.get("line_items", [])
        if not isinstance(items, list):
            items = []
        missing = raw.get("missing_fields", [])
        if not isinstance(missing, list):
            missing = []
        notes = raw.get("notes", [])
        if not isinstance(notes, list):
            notes = []
        return {
            "fields": fields,
            "line_items": items,
            "missing_fields": missing,
            "notes": notes,
        }


_client_cache: Optional[LLMClient] = None


def get_client() -> LLMClient:
    global _client_cache
    if _client_cache is None:
        _client_cache = LLMClient()
    return _client_cache


def reset_client_cache() -> None:
    global _client_cache
    _client_cache = None

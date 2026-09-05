# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""JSON Schema validation against the versioned contracts in contracts/.

Every report the system produces must validate. Schemas are loaded from disk
with a registry so cross-file ``$ref`` (e.g. the validation report embedding
the extraction schema) resolves in-process.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import jsonschema
from referencing import Registry, Resource

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_REPORT_FILE = "validation_report.schema.json"
_EXTRACTION_FILE = "invoice_extraction.schema.json"


class ContractValidationError(RuntimeError):
    """Raised when an output fails its JSON Schema contract."""


def _load_schema(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise ContractValidationError("Contract file not found: %s" % path)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ContractValidationError("Invalid JSON in contract %s: %s" % (path, exc)) from exc


def _build_registry(schemas: Dict[str, Dict[str, Any]]) -> Registry:
    resources = {}
    for uri, schema in schemas.items():
        try:
            resources[uri] = Resource.from_contents(schema)
        except Exception:  # pragma: no cover - registry bookkeeping
            continue
    registry: Registry = Registry()
    if resources:
        registry = registry.with_resources(list(resources.items()))
    return registry


def _schemas_dir() -> Path:
    settings = get_settings()
    return settings.contracts_path


def _load_all() -> Dict[str, Dict[str, Any]]:
    directory = _schemas_dir()
    schemas: Dict[str, Dict[str, Any]] = {}
    for name in (_REPORT_FILE, _EXTRACTION_FILE):
        schema = _load_schema(directory / name)
        identifier = schema.get("$id") or name
        schemas[identifier] = schema
        schemas[name] = schema  # allow resolving by plain filename too
    return schemas


_SCHEMA_CACHE: Optional[Dict[str, Dict[str, Any]]] = None


def _get_schemas() -> Dict[str, Dict[str, Any]]:
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE is None:
        _SCHEMA_CACHE = _load_all()
    return _SCHEMA_CACHE


def reset_contract_cache() -> None:
    global _SCHEMA_CACHE
    _SCHEMA_CACHE = None


def validate_extraction(extraction: Dict[str, Any]) -> None:
    """Validate an extraction payload; no-op-free and strict."""
    schemas = _get_schemas()
    registry = _build_registry(schemas)
    validator = jsonschema.Draft202012Validator(
        schemas[_EXTRACTION_FILE], registry=registry
    )
    errors = sorted(validator.iter_errors(extraction), key=lambda e: list(e.path))
    if errors:
        first = errors[0]
        raise ContractValidationError(
            "Extraction contract violation: %s" % _describe(first)
        )


def validate_report(report: Dict[str, Any]) -> None:
    schemas = _get_schemas()
    registry = _build_registry(schemas)
    validator = jsonschema.Draft202012Validator(
        schemas[_REPORT_FILE], registry=registry
    )
    errors = sorted(validator.iter_errors(report), key=lambda e: list(e.path))
    if errors:
        raise ContractValidationError("Report contract violation: %s" % _describe(errors[0]))


def _describe(error: jsonschema.ValidationError) -> str:
    location = ".".join(str(part) for part in error.absolute_path) or "$"
    return "%s at %s (%s)" % (error.message, location, error.validator)

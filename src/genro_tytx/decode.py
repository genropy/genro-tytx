# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Decoding - TYTX JSON string to Python objects.

Uses json.loads() followed by recursive hydration.
"""

from __future__ import annotations

import json
from typing import Any

from .registry import SUFFIX_TO_TYPE

# Check for orjson availability
try:
    import orjson

    HAS_ORJSON = True
except ImportError:
    HAS_ORJSON = False

TYTX_MARKER = "::JS"
TYTX_PREFIX = "TYTX://"


def _hydrate_value(value: str) -> Any:
    """
    Hydrate a single TYTX-encoded string value (internal).

    Args:
        value: String like "100.50::N" or "2025-01-15::D"

    Returns:
        Python object (Decimal, date, etc.) or original string if not typed
    """
    if "::" not in value:
        return value

    # Find last :: to get suffix
    idx = value.rfind("::")
    raw_value = value[:idx]
    suffix = value[idx + 2 :]

    entry = SUFFIX_TO_TYPE.get(suffix)
    if entry is None:
        # Unknown suffix, return as-is
        return value

    _, deserializer = entry
    return deserializer(raw_value)


def _hydrate_recursive(value: Any) -> Any:
    """Recursively hydrate all typed values in a structure."""
    if isinstance(value, str):
        if "::" in value:
            return _hydrate_value(value)
        return value

    if isinstance(value, dict):
        return {k: _hydrate_recursive(v) for k, v in value.items()}

    if isinstance(value, list):
        return [_hydrate_recursive(item) for item in value]

    return value


def _has_type_suffix(data: str) -> bool:
    """Check if string ends with a valid type suffix (::XXX).

    Handles both raw JSON (ends with ::JS) and quoted scalars (ends with ::X").
    """
    # Handle quoted JSON scalar: "value::X"
    if data.endswith('"'):
        idx = data.rfind("::")
        if idx == -1:
            return False
        suffix = data[idx + 2 : -1]  # Strip trailing quote
        return suffix in SUFFIX_TO_TYPE
    # Handle struct marker: {...}::JS or [...]::JS
    idx = data.rfind("::")
    if idx == -1:
        return False
    suffix = data[idx + 2 :]
    return suffix in SUFFIX_TO_TYPE or suffix == "JS"


def from_text(data: str, *, use_orjson: bool | None = None) -> Any:
    """
    Decode a TYTX JSON string to Python objects.

    Args:
        data: JSON string with ::JS suffix (struct) or ::T suffix (scalar)
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        Python object with typed values hydrated

    Example:
        >>> from_text('{"price": "100.50::N"}::JS')
        {"price": Decimal("100.50")}
        >>> from_text('"2025-01-15::D"')
        date(2025, 1, 15)
    """
    # Strip whitespace (handles trailing newlines, etc.)
    data = data.strip()

    if use_orjson is None:
        use_orjson = HAS_ORJSON

    # Check if data has any type suffix
    if not _has_type_suffix(data):
        # Plain JSON, no TYTX
        if use_orjson and HAS_ORJSON:
            return orjson.loads(data)
        return json.loads(data)

    # Check for ::JS marker (struct)
    if data.endswith(TYTX_MARKER):
        data = data[: -len(TYTX_MARKER)]
        if use_orjson and HAS_ORJSON:
            parsed = orjson.loads(data)
        else:
            parsed = json.loads(data)
        return _hydrate_recursive(parsed)

    # Scalar with type suffix (e.g., "2025-01-15::D")
    if use_orjson and HAS_ORJSON:
        parsed = orjson.loads(data)
    else:
        parsed = json.loads(data)

    # parsed is now a string like "2025-01-15::D", hydrate it
    return _hydrate_recursive(parsed)


def from_json(data: str, *, use_orjson: bool | None = None) -> Any:
    """
    Decode a TYTX JSON string with protocol prefix to Python objects.

    Expects TYTX:// prefix per protocol spec.

    Args:
        data: JSON string with TYTX:// prefix and ::JS or ::T suffix
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        Python object with typed values hydrated

    Example:
        >>> from_json('TYTX://{"price": "100.50::N"}::JS')
        {"price": Decimal("100.50")}
        >>> from_json('TYTX://"2025-01-15::D"')
        date(2025, 1, 15)
    """
    # Strip whitespace first
    data = data.strip()

    # Strip TYTX:// prefix if present
    if data.startswith(TYTX_PREFIX):
        data = data[len(TYTX_PREFIX) :]

    # Delegate to from_text
    return from_text(data, use_orjson=use_orjson)

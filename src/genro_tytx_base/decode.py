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


def hydrate_value(value: str) -> Any:
    """
    Hydrate a single TYTX-encoded string value.

    Args:
        value: String like "100.50::D" or "2025-01-15::d"

    Returns:
        Python object (Decimal, date, etc.) or original string if not typed
    """
    if "::" not in value:
        return value

    # Find last :: to get suffix
    idx = value.rfind("::")
    raw_value = value[:idx]
    suffix = value[idx + 2:]

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
            return hydrate_value(value)
        return value

    if isinstance(value, dict):
        return {k: _hydrate_recursive(v) for k, v in value.items()}

    if isinstance(value, list):
        return [_hydrate_recursive(item) for item in value]

    return value


def from_tytx(data: str, *, use_orjson: bool | None = None) -> Any:
    """
    Decode a TYTX JSON string to Python objects.

    Args:
        data: JSON string, optionally with ::JS suffix
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        Python object with typed values hydrated

    Example:
        >>> from_tytx('{"price": "100.50::D"}::JS')
        {"price": Decimal("100.50")}
    """
    if use_orjson is None:
        use_orjson = HAS_ORJSON

    # Check for TYTX marker
    has_tytx = data.endswith(TYTX_MARKER)
    if has_tytx:
        data = data[:-len(TYTX_MARKER)]

    # Parse JSON
    if use_orjson and HAS_ORJSON:
        parsed = orjson.loads(data)
    else:
        parsed = json.loads(data)

    # Early exit if no TYTX marker
    if not has_tytx:
        return parsed

    # Hydrate typed values
    return _hydrate_recursive(parsed)

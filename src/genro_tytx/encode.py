# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Encoding - Python objects to TYTX JSON string.

Uses json.JSONEncoder.default or orjson.dumps(default=...) for performance.
"""

from __future__ import annotations

import json
from typing import Any

from .registry import TYPE_TO_SUFFIX

# Check for orjson availability
try:
    import orjson

    HAS_ORJSON = True
except ImportError:  # pragma: no cover
    HAS_ORJSON = False


def _serialize_value(value: Any) -> tuple[str, str] | None:
    """
    Serialize a value to TYTX format (internal).

    Returns (serialized_value, suffix) or None if type not registered.
    """
    entry = TYPE_TO_SUFFIX.get(type(value))
    if entry is None:
        return None
    suffix, serializer = entry
    return serializer(value), suffix


class _TYTXEncoder(json.JSONEncoder):
    """JSON encoder that tracks if special types were found."""

    __slots__ = ("has_special",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.has_special = False

    def default(self, obj: Any) -> str:
        result = _serialize_value(obj)
        if result is not None:
            self.has_special = True
            value, suffix = result
            return f"{value}::{suffix}"
        return super().default(obj)


class _OrjsonDefault:
    """Callable for orjson default parameter that tracks special types."""

    __slots__ = ("has_special",)

    def __init__(self):
        self.has_special = False

    def __call__(self, obj: Any) -> str:
        result = _serialize_value(obj)
        if result is not None:
            self.has_special = True
            value, suffix = result
            return f"{value}::{suffix}"
        raise TypeError(f"Object of type {type(obj).__name__} is not TYTX serializable")


def to_typed_text(value: Any, *, use_orjson: bool | None = None) -> str:
    """
    Encode a Python value to TYTX JSON string.

    Args:
        value: Python object to encode
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        JSON string. For dict/list with typed values: adds ::JS suffix.
        For scalar typed values: returns value with type suffix only (no ::JS).

    Example:
        >>> to_typed_text({"price": Decimal("100.50")})
        '{"price": "100.50::N"}::JS'
        >>> to_typed_text(date(2025, 1, 15))
        '"2025-01-15::D"'
    """
    # Check if root value is a typed scalar
    scalar_result = _serialize_value(value)
    if scalar_result is not None:
        serialized, suffix = scalar_result
        return f'"{serialized}::{suffix}"'

    if use_orjson is None:
        use_orjson = HAS_ORJSON

    if use_orjson and HAS_ORJSON:
        default_fn = _OrjsonDefault()
        # OPT_PASSTHROUGH_DATETIME forces date/datetime/time to go through default
        result = orjson.dumps(
            value,
            default=default_fn,
            option=orjson.OPT_PASSTHROUGH_DATETIME,
        ).decode("utf-8")
        if default_fn.has_special:
            return f"{result}::JS"
        return result
    else:
        encoder = _TYTXEncoder()
        result = encoder.encode(value)
        if encoder.has_special:
            return f"{result}::JS"
        return result


def to_typed_json(value: Any, *, use_orjson: bool | None = None) -> str:
    """
    Encode a Python value to TYTX JSON string with protocol prefix.

    Uses TYTX:// prefix for protocol identification per spec.

    Args:
        value: Python object to encode
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        JSON string with TYTX:// prefix. For dict/list with typed values: adds ::JS suffix.
        For scalar typed values: returns TYTX:// prefix + value with type suffix (no ::JS).

    Example:
        >>> to_typed_json({"price": Decimal("100.50")})
        'TYTX://{"price": "100.50::N"}::JS'
        >>> to_typed_json(date(2025, 1, 15))
        'TYTX://"2025-01-15::D"'
    """
    # Check if root value is a typed scalar
    scalar_result = _serialize_value(value)
    if scalar_result is not None:
        serialized, suffix = scalar_result
        return f'TYTX://"{serialized}::{suffix}"'

    if use_orjson is None:
        use_orjson = HAS_ORJSON

    if use_orjson and HAS_ORJSON:
        default_fn = _OrjsonDefault()
        result = orjson.dumps(
            value,
            default=default_fn,
            option=orjson.OPT_PASSTHROUGH_DATETIME,
        ).decode("utf-8")
        if default_fn.has_special:
            return f"TYTX://{result}::JS"
        return f"TYTX://{result}"
    else:
        encoder = _TYTXEncoder()
        result = encoder.encode(value)
        if encoder.has_special:
            return f"TYTX://{result}::JS"
        return f"TYTX://{result}"

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
except ImportError:
    HAS_ORJSON = False


def serialize_value(value: Any) -> tuple[str, str] | None:
    """
    Serialize a value to TYTX format.

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
        result = serialize_value(obj)
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
        result = serialize_value(obj)
        if result is not None:
            self.has_special = True
            value, suffix = result
            return f"{value}::{suffix}"
        raise TypeError(f"Object of type {type(obj).__name__} is not TYTX serializable")


def to_tytx(value: Any, *, use_orjson: bool | None = None) -> str:
    """
    Encode a Python value to TYTX JSON string.

    Args:
        value: Python object to encode
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        JSON string, with ::JS suffix if typed values present

    Example:
        >>> to_tytx({"price": Decimal("100.50")})
        '{"price": "100.50::D"}::JS'
    """
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

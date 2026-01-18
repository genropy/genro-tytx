# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Encoding - Python objects to TYTX format.

Supports multiple transports: json, xml, msgpack.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from .utils import raw_encode

# Check for orjson availability
try:
    import orjson

    HAS_ORJSON = True
except ImportError:  # pragma: no cover
    HAS_ORJSON = False

# Runtime control: set to False to force json stdlib even if orjson is available
USE_ORJSON = HAS_ORJSON


class _TYTXEncoder(json.JSONEncoder):
    """JSON encoder that tracks if special types were found."""

    __slots__ = ("has_special",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.has_special = False

    def default(self, obj: Any) -> str:
        encoded, result = raw_encode(obj)
        if encoded:
            self.has_special = True
            return result
        raise TypeError(f"Type is not JSON serializable: {type(obj).__name__}")


class _OrjsonDefault:
    """Callable for orjson default parameter that tracks special types."""

    __slots__ = ("has_special",)

    def __init__(self):
        self.has_special = False

    def __call__(self, obj: Any) -> str:
        encoded, result = raw_encode(obj)
        if encoded:
            self.has_special = True
            return result
        raise TypeError(f"Type is not JSON serializable: {type(obj).__name__}")


def _to_json(value: Any, force_suffix: bool = False) -> str:
    """
    Encode a Python value to TYTX JSON string (internal).

    Args:
        value: Python object to encode
        force_suffix: If True, add suffix for all types (int/bool/float)

    Returns:
        JSON string. For dict/list with typed values: adds ::JS suffix.
        For scalar typed values: returns value with type suffix only (no ::JS).
    """
    encoded, result = raw_encode(value, force_suffix)
    if encoded:
        return result

    # String: return as-is without JSON quoting
    if isinstance(value, str):
        return value

    if USE_ORJSON:
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


def _to_msgpack(value: Any) -> bytes:
    """Encode a Python value to TYTX MessagePack bytes (internal)."""
    from .msgpack import to_msgpack

    return to_msgpack(value)


def _to_raw_json(value: Any) -> str:
    """Encode a Python value to raw JSON string (no TYTX suffix)."""
    if USE_ORJSON:
        return orjson.dumps(value).decode("utf-8")
    return json.dumps(value)


def _to_raw_msgpack(value: Any) -> bytes:
    """Encode a Python value to raw MessagePack bytes (no TYTX processing)."""
    try:
        import msgpack
    except ImportError as e:
        raise ImportError("msgpack package required for msgpack transport") from e
    return msgpack.packb(value)


def to_tytx(
    value: Any,
    transport: Literal["json", "xml", "msgpack"] | None = None,
    *,
    raw: bool = False,
    qs: bool = False,
    _force_suffix: bool = False,
) -> str | bytes:
    """
    Encode a Python value to TYTX format.

    Args:
        value: Python object to encode
        transport: Output format - "json", "xml", or "msgpack"
        raw: If True, output raw format without TYTX type suffixes
        qs: If True, output as query string format (flat dict or list only)
        _force_suffix: Internal - force suffix for all types (int/bool/float)

    Returns:
        Encoded data (str for json/xml, bytes for msgpack)

    Example:
        >>> to_tytx({"price": Decimal("100.50")})
        '{"price": "100.50::N"}::JS'
        >>> to_tytx({"price": 100.50}, raw=True)
        '{"price": 100.5}'
        >>> to_tytx({"alfa": 33, "date": date(2025, 12, 14)}, qs=True)
        'alfa=33::L&date=2025-12-14::D::QS'
        >>> to_tytx({"root": {"value": Decimal("100")}}, transport="xml")
        '<?xml version="1.0" ?><tytx_root><root>100::N</root></tytx_root>'
    """
    if qs:
        from .qs import to_qs

        return f"{to_qs(value)}::QS"

    if raw:
        if transport is None or transport == "json":
            return _to_raw_json(value)
        elif transport == "msgpack":
            return _to_raw_msgpack(value)
        elif transport == "xml":
            raise ValueError("raw=True is not supported for XML transport")
        else:
            raise ValueError(f"Unknown transport: {transport}")

    if transport is None or transport == "json":
        result = _to_json(value, _force_suffix)
        if transport == "json":
            return f'"{result}"'
        return result
    elif transport == "xml":
        from .xml import to_xml

        result = to_xml(value)
        return f'<?xml version="1.0" ?><tytx_root>{result}</tytx_root>'
    elif transport == "msgpack":
        return _to_msgpack(value)
    else:
        raise ValueError(f"Unknown transport: {transport}")

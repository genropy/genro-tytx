# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Decoding - TYTX format to Python objects.

Supports multiple transports: json, xml, msgpack.
"""

from __future__ import annotations

import json
from typing import Any, Literal, cast

from .utils import raw_decode, walk

# Check for orjson availability
try:
    import orjson

    HAS_ORJSON = True
except ImportError:  # pragma: no cover
    HAS_ORJSON = False

TYTX_MARKER = "::JS"


def is_string(v):
    """Filter for string values."""
    return isinstance(v, str)


def _from_json(data: str, *, use_orjson: bool | None = None) -> Any:
    """
    Decode a TYTX JSON string to Python objects (internal).

    Args:
        data: JSON string with ::JS suffix (struct) or ::T suffix (scalar)
        use_orjson: Force orjson (True), stdlib json (False), or auto (None)

    Returns:
        Python object with typed values hydrated
    """
    # Try raw_decode first (scalar with type suffix, including ::QS)
    decoded, value = raw_decode(data)
    if decoded:
        return value

    if use_orjson is None:
        use_orjson = HAS_ORJSON
    jsloader = orjson.loads if use_orjson else json.loads

    if data.endswith("::JS"):
        data = data[:-4]
    try:
        parsed = jsloader(data)
    except (json.JSONDecodeError, orjson.JSONDecodeError):
        return data
    return walk(parsed, _decode_item, is_string)


def _decode_item(s):
    if "::" not in s:
        return s
    return raw_decode(s)[1]


def _from_xml(data: str) -> Any:
    """Decode a TYTX XML string to Python objects (internal)."""
    from .xml import from_xml

    result = from_xml(data)
    # If result is a string with TYTX suffix, hydrate it via JSON decoder
    if isinstance(result, str):
        return from_tytx(result)
    return result


def _from_msgpack(data: bytes) -> Any:
    """Decode TYTX MessagePack bytes to Python objects (internal)."""
    from .msgpack import from_msgpack

    return from_msgpack(data)


def from_tytx(
    data: str | bytes | None,
    transport: Literal["json", "xml", "msgpack"] | None = None,
    **kwargs,
) -> Any:
    """
    Decode TYTX format to Python objects.

    Args:
        data: Encoded data (str for json/xml, bytes for msgpack), or None
        transport: Input format - "json", "xml", or "msgpack"
        **kwargs: Additional arguments passed to transport-specific decoder

    Returns:
        Python object with typed values hydrated, or None if data is None

    Example:
        >>> from_tytx('{"price": "100.50::N"}::JS')
        {"price": Decimal("100.50")}
        >>> from_tytx('<root>100::N</root>', transport="xml")
        {"root": {"attrs": {}, "value": Decimal("100")}}
    """
    if data is None:
        return None

    if transport is None or transport == "json":
        if transport == "json":
            data = data[1:-1]  # Remove surrounding quotes
        return _from_json(cast(str, data), **kwargs)
    elif transport == "xml":
        return _from_xml(cast(str, data))
    elif transport == "msgpack":
        return _from_msgpack(cast(bytes, data))
    else:
        raise ValueError(f"Unknown transport: {transport}")

# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX MessagePack Encoding/Decoding.

MessagePack serializes typed values as strings with type suffix (e.g., "100.50::N").
On decode, these strings are hydrated back to Python types.
"""

from __future__ import annotations

from typing import Any

from .encode import _serialize_value
from .decode import _hydrate_recursive

# Check for msgpack availability
try:
    import msgpack

    HAS_MSGPACK = True
except ImportError:  # pragma: no cover
    HAS_MSGPACK = False


def _check_msgpack():  # pragma: no cover
    if not HAS_MSGPACK:
        raise ImportError(
            "msgpack is required for MessagePack support. "
            "Install with: pip install genro-tytx[msgpack]"
        )


def _default_encoder(obj: Any) -> str:
    """Default encoder for msgpack - converts typed values to TYTX strings."""
    result = _serialize_value(obj)
    if result is not None:
        serialized, suffix = result
        return f"{serialized}::{suffix}"
    raise TypeError(f"Object of type {type(obj).__name__} is not TYTX serializable")


def to_msgpack(value: Any) -> bytes:
    """
    Encode a Python value to TYTX MessagePack bytes.

    Args:
        value: Python object to encode

    Returns:
        MessagePack bytes with typed values as TYTX strings

    Example:
        >>> to_msgpack({"price": Decimal("100.50")})
        b'...'  # MessagePack bytes
    """
    _check_msgpack()
    return msgpack.packb(value, default=_default_encoder, strict_types=False)


def from_msgpack(data: bytes) -> Any:
    """
    Decode TYTX MessagePack bytes to Python objects.

    Args:
        data: MessagePack bytes

    Returns:
        Python object with typed values hydrated

    Example:
        >>> from_msgpack(packed_bytes)
        {"price": Decimal("100.50")}
    """
    _check_msgpack()
    parsed = msgpack.unpackb(data, raw=False)
    return _hydrate_recursive(parsed)

# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX MessagePack Encoding/Decoding.

MessagePack format uses ExtType(42, ...) for TYTX typed values.
The payload is the TYTX JSON string.
"""

from __future__ import annotations

from typing import Any

from .encode import to_typed_text
from .decode import from_text

# TYTX ExtType code
TYTX_EXT_CODE = 42

# Check for msgpack availability
try:
    import msgpack
    HAS_MSGPACK = True
except ImportError:
    HAS_MSGPACK = False


def _check_msgpack():
    if not HAS_MSGPACK:
        raise ImportError(
            "msgpack is required for MessagePack support. "
            "Install with: pip install genro-tytx-base[msgpack]"
        )


def _default_encoder(obj: Any) -> msgpack.ExtType:
    """Default encoder for msgpack - wraps non-native types in TYTX."""
    # Serialize the object to TYTX JSON and wrap in ExtType
    tytx_str = to_typed_text(obj)
    return msgpack.ExtType(TYTX_EXT_CODE, tytx_str.encode("utf-8"))


def _ext_hook(code: int, data: bytes) -> Any:
    """Ext hook for msgpack - unwraps TYTX ExtType."""
    if code == TYTX_EXT_CODE:
        return from_text(data.decode("utf-8"))
    return msgpack.ExtType(code, data)


def to_msgpack(value: Any) -> bytes:
    """
    Encode a Python value to TYTX MessagePack bytes.

    Args:
        value: Python object to encode

    Returns:
        MessagePack bytes with typed values wrapped in ExtType(42)

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
    return msgpack.unpackb(data, ext_hook=_ext_hook, raw=False)

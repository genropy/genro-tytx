# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX MessagePack Encoding/Decoding.

Uses MessagePack extension types to carry TYTX type information directly in the protocol:
- Ext -1: datetime (msgpack native Timestamp, tz-aware UTC)
- Ext  1: Decimal  (payload: UTF-8 string, e.g. "100.50")
- Ext  2: date     (payload: ISO "YYYY-MM-DD")
- Ext  3: time     (payload: ISO "HH:MM:SS.ffffff")
- Ext  4: registered custom type (payload: UTF-8 "SUFFIX:serialized",
          split at the first ":"; unknown suffixes on the receiving side
          degrade to the string "serialized::SUFFIX", like the json path)

Known limitation: packb only calls the default hook for types it cannot
serialize natively, so a registered custom type that subclasses dict/list/str
is carried natively and loses its type (same limitation as the json path).
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any

from .registry import SUFFIX_TO_TYPE, get_type_entry

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


def _default(obj: Any) -> Any:
    """Encode TYTX types as msgpack extension types."""
    if isinstance(obj, Decimal):
        return msgpack.ExtType(1, str(obj).encode("utf-8"))
    if isinstance(obj, datetime):
        # datetime must be checked before date (datetime is a subclass of date)
        if obj.tzinfo is None:
            obj = obj.replace(tzinfo=timezone.utc)
        return msgpack.Timestamp.from_datetime(obj)
    if isinstance(obj, date):
        return msgpack.ExtType(2, obj.isoformat().encode("utf-8"))
    if isinstance(obj, time):
        return msgpack.ExtType(3, obj.isoformat().encode("utf-8"))
    entry = get_type_entry(obj)  # same lookup as utils.raw_encode
    if entry is not None:
        suffix, serializer, _ = entry
        return msgpack.ExtType(4, f"{suffix}:{serializer(obj)}".encode())
    raise TypeError(f"Unknown type: {type(obj)}")


def _ext_hook(code: int, data: bytes) -> Any:
    """Decode msgpack extension types back to TYTX Python types."""
    if code == 1:
        return Decimal(data.decode("utf-8"))
    if code == 2:
        return date.fromisoformat(data.decode("utf-8"))
    if code == 3:
        return time.fromisoformat(data.decode("utf-8"))
    if code == 4:
        suffix, _, payload = data.decode("utf-8").partition(":")
        entry = SUFFIX_TO_TYPE.get(suffix)
        if entry is not None:
            _, deserializer = entry
            return deserializer(payload)
        # Unknown suffix on the receiving side: degrade to the same
        # pass-through string raw_decode gives on the json path.
        return f"{payload}::{suffix}"
    return msgpack.ExtType(code, data)


def to_msgpack(value: Any) -> bytes:
    """
    Encode a Python value to TYTX MessagePack bytes.

    Args:
        value: Python object to encode

    Returns:
        MessagePack bytes with TYTX types as extension types

    Example:
        >>> to_msgpack({"price": Decimal("100.50")})
        b'...'  # MessagePack bytes
    """
    _check_msgpack()
    return msgpack.packb(value, default=_default, strict_types=False)


def from_msgpack(data: bytes) -> Any:
    """
    Decode TYTX MessagePack bytes to Python objects.

    Args:
        data: MessagePack bytes

    Returns:
        Python object with TYTX extension types hydrated

    Example:
        >>> from_msgpack(packed_bytes)
        {"price": Decimal("100.50")}
    """
    _check_msgpack()
    return msgpack.unpackb(data, raw=False, ext_hook=_ext_hook, timestamp=3)

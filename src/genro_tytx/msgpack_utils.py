# Copyright 2025 Softwell S.r.l.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
MessagePack utilities for TYTX Protocol.

TYTX uses MessagePack ExtType code 42 for typed payloads.
The content is a UTF-8 encoded JSON string with typed values.
No TYTX:: prefix needed - ExtType(42) itself is the marker.

Usage:
    pip install genro-tytx[msgpack]

    from genro_tytx.msgpack_utils import packb, unpackb

    from decimal import Decimal
    from datetime import date

    data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}

    # Pack with TYTX types preserved
    packed = packb(data)

    # Unpack with types restored
    restored = unpackb(packed)
    # restored["price"] is Decimal("99.99"), not float!

Alternative usage with raw msgpack:
    import msgpack
    from genro_tytx.msgpack_utils import tytx_encoder, tytx_decoder

    # Manual packing
    packed = msgpack.packb(data, default=tytx_encoder)

    # Manual unpacking
    restored = msgpack.unpackb(packed, ext_hook=tytx_decoder)
"""

from __future__ import annotations

from typing import Any

# TYTX ExtType code (reserved)
TYTX_EXT_TYPE = 42

# Lazy import check
_msgpack_available: bool | None = None


def _check_msgpack() -> None:
    """Check if msgpack is available, raise ImportError if not."""
    global _msgpack_available
    if _msgpack_available is None:
        try:
            import msgpack  # noqa: F401

            _msgpack_available = True
        except ImportError:
            _msgpack_available = False

    if not _msgpack_available:
        raise ImportError(
            "msgpack is required for MessagePack support. "
            "Install it with: pip install genro-tytx[msgpack]"
        )


def _has_tytx_types(obj: Any) -> bool:
    """
    Check if object contains types that need TYTX encoding.

    Args:
        obj: Object to check.

    Returns:
        True if object contains Decimal, date, datetime, or time.
    """
    from datetime import date, datetime, time
    from decimal import Decimal

    if isinstance(obj, (Decimal, date, datetime, time)):
        return True
    if isinstance(obj, dict):
        return any(_has_tytx_types(v) for v in obj.values())
    if isinstance(obj, (list, tuple)):
        return any(_has_tytx_types(item) for item in obj)
    return False


def tytx_encoder(obj: Any) -> Any:
    """
    MessagePack encoder for TYTX types.

    Use as the `default` parameter for msgpack.packb().

    Objects containing TYTX types (Decimal, date, etc.) are wrapped
    in ExtType(42, ...) with UTF-8 encoded TYTX JSON content.

    Args:
        obj: Object to encode.

    Returns:
        msgpack.ExtType for TYTX types, or raises TypeError.

    Raises:
        TypeError: If object cannot be encoded.

    Example:
        import msgpack
        from genro_tytx.msgpack_utils import tytx_encoder

        packed = msgpack.packb(data, default=tytx_encoder)
    """
    _check_msgpack()
    import msgpack

    from .json_utils import as_typed_json

    if _has_tytx_types(obj):
        tytx_str = as_typed_json(obj)
        return msgpack.ExtType(TYTX_EXT_TYPE, tytx_str.encode("utf-8"))

    raise TypeError(f"Object of type {type(obj).__name__} is not MessagePack serializable")


def tytx_decoder(code: int, data: bytes) -> Any:
    """
    MessagePack decoder for TYTX ExtType.

    Use as the `ext_hook` parameter for msgpack.unpackb().

    ExtType(42, ...) is decoded as TYTX JSON and hydrated.

    Args:
        code: ExtType code.
        data: ExtType data (bytes).

    Returns:
        Hydrated Python object for TYTX types, or ExtType for unknown codes.

    Example:
        import msgpack
        from genro_tytx.msgpack_utils import tytx_decoder

        restored = msgpack.unpackb(packed, ext_hook=tytx_decoder)
    """
    _check_msgpack()
    import msgpack

    if code == TYTX_EXT_TYPE:
        json_str = data.decode("utf-8")

        from .json_utils import from_json

        return from_json(json_str)

    # Unknown ExtType - return as-is
    return msgpack.ExtType(code, data)


def packb(obj: Any, **kwargs: Any) -> bytes:
    """
    Pack Python object to MessagePack bytes with TYTX type support.

    TYTX types (Decimal, date, datetime, time) are preserved using
    ExtType(42, ...) with UTF-8 encoded TYTX JSON content.

    Args:
        obj: Python object to pack.
        **kwargs: Additional arguments passed to msgpack.packb().

    Returns:
        MessagePack bytes.

    Example:
        from decimal import Decimal
        from genro_tytx.msgpack_utils import packb, unpackb

        data = {"price": Decimal("99.99")}
        packed = packb(data)
        restored = unpackb(packed)
        # restored["price"] is Decimal("99.99")
    """
    _check_msgpack()
    import msgpack

    kwargs.setdefault("default", tytx_encoder)
    result: bytes = msgpack.packb(obj, **kwargs)
    return result


def unpackb(packed: bytes, **kwargs: Any) -> Any:
    """
    Unpack MessagePack bytes to Python object with TYTX type support.

    ExtType(42, ...) is decoded and hydrated to restore TYTX types.

    Args:
        packed: MessagePack bytes to unpack.
        **kwargs: Additional arguments passed to msgpack.unpackb().

    Returns:
        Python object with TYTX types restored.

    Example:
        from genro_tytx.msgpack_utils import packb, unpackb

        packed = packb({"price": Decimal("99.99")})
        restored = unpackb(packed)
        # restored["price"] is Decimal("99.99")
    """
    _check_msgpack()
    import msgpack

    kwargs.setdefault("ext_hook", tytx_decoder)
    return msgpack.unpackb(packed, **kwargs)


__all__ = [
    "TYTX_EXT_TYPE",
    "packb",
    "unpackb",
    "tytx_encoder",
    "tytx_decoder",
]

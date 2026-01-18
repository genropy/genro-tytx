# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
Type Registry for TYTX Base.

Maps Python types to/from TYTX suffixes.
Only scalar types are supported in base version.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any

# =============================================================================
# SERIALIZERS (Python type -> string)
# =============================================================================


def _serialize_decimal(v: Decimal) -> str:
    return str(v)


def _serialize_date(v: date) -> str:
    return v.isoformat()


def _serialize_datetime(v: datetime) -> str:
    """Serialize datetime with millisecond precision (3 decimal places).

    Microseconds are truncated to milliseconds for cross-language compatibility
    (JavaScript Date has millisecond precision).
    """
    if v.tzinfo is None:
        # Naive datetime -> DHZ format (UTC assumption)
        return v.isoformat(timespec="milliseconds") + "Z"
    # Aware datetime -> convert to UTC and use milliseconds
    utc_dt = v.astimezone(timezone.utc)
    return utc_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _serialize_time(v: time) -> str:
    """Serialize time with millisecond precision (3 decimal places).

    Microseconds are truncated to milliseconds for cross-language compatibility
    (JavaScript Date has millisecond precision).
    """
    return v.isoformat(timespec="milliseconds")


def _serialize_bool(v: bool) -> str:
    return "true" if v else "false"


def _serialize_int(v: int) -> str:
    return str(v)


def _serialize_float(v: float) -> str:
    return str(v)


def _serialize_none(v: None) -> str:
    return ""


# Type Registry: type -> (suffix, serializer, json_native)
# json_native=True means JSON handles it natively (no suffix needed in JSON)
TYPE_REGISTRY: dict[type, tuple[str, Callable[[Any], str], bool]] = {
    Decimal: ("N", _serialize_decimal, False),
    date: ("D", _serialize_date, False),
    datetime: ("DHZ", _serialize_datetime, False),
    time: ("H", _serialize_time, False),
    bool: ("B", _serialize_bool, True),
    int: ("L", _serialize_int, True),
    float: ("R", _serialize_float, True),
    type(None): ("NN", _serialize_none, True),
}


# =============================================================================
# DESERIALIZERS (string -> Python type)
# =============================================================================


def _deserialize_decimal(s: str) -> Decimal:
    return Decimal(s)


def _deserialize_date(s: str) -> date:
    return date.fromisoformat(s)


def _deserialize_datetime(s: str) -> datetime:
    # Handle Z suffix
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def _deserialize_time(s: str) -> time:
    return time.fromisoformat(s)


def _deserialize_bool(s: str) -> bool:
    return s.lower() == "true"


def _deserialize_int(s: str) -> int:
    return int(s)


def _deserialize_float(s: str) -> float:
    return float(s)


def _deserialize_str(s: str) -> str:
    return s


def _deserialize_none(s: str) -> None:
    return None


def _deserialize_qs(s: str) -> dict | list:
    from .qs import from_qs

    return from_qs(s)


# Suffix -> (type, deserializer) - includes all for decoding
# Accepts both DH (deprecated) and DHZ (canonical) for datetime
SUFFIX_TO_TYPE: dict[str, tuple[type, Callable[[str], Any]]] = {
    "N": (Decimal, _deserialize_decimal),
    "D": (date, _deserialize_date),
    "DH": (datetime, _deserialize_datetime),  # deprecated, still accepted
    "DHZ": (datetime, _deserialize_datetime),  # canonical
    "H": (time, _deserialize_time),
    "L": (int, _deserialize_int),
    "R": (float, _deserialize_float),
    "T": (str, _deserialize_str),
    "B": (bool, _deserialize_bool),
    "NN": (type(None), _deserialize_none),
    "QS": (dict, _deserialize_qs),
}

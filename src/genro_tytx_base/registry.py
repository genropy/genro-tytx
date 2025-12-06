# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
Type Registry for TYTX Base.

Maps Python types to/from TYTX suffixes.
Only scalar types are supported in base version.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any


# Serializers: type -> (suffix, serialize_fn)
# Deserializers: suffix -> (type, deserialize_fn)

def _serialize_decimal(v: Decimal) -> str:
    return str(v)

def _deserialize_decimal(s: str) -> Decimal:
    return Decimal(s)

def _serialize_date(v: date) -> str:
    return v.isoformat()

def _deserialize_date(s: str) -> date:
    return date.fromisoformat(s)

def _serialize_datetime(v: datetime) -> str:
    if v.tzinfo is None:
        # Naive datetime -> DHZ format (UTC assumption)
        return v.strftime("%Y-%m-%dT%H:%M:%S") + "Z"
    return v.isoformat()

def _deserialize_datetime(s: str) -> datetime:
    # Handle Z suffix
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)

def _serialize_time(v: time) -> str:
    return v.isoformat()

def _deserialize_time(s: str) -> time:
    return time.fromisoformat(s)

def _serialize_bool(v: bool) -> str:
    return "1" if v else "0"

def _deserialize_bool(s: str) -> bool:
    return s == "1"

def _serialize_int(v: int) -> str:
    return str(v)

def _deserialize_int(s: str) -> int:
    return int(s)


# JSON Registry - only non-native JSON types
# (bool, int, float, str, list, dict are native to JSON)
# Type codes: N=Decimal, D=date, DHZ=datetime (canonical), H=time
TYPE_TO_SUFFIX: dict[type, tuple[str, Callable[[Any], str]]] = {
    Decimal: ("N", _serialize_decimal),
    date: ("D", _serialize_date),
    datetime: ("DHZ", _serialize_datetime),
    time: ("H", _serialize_time),
}

# Suffix -> (type, deserializer) - includes all for decoding
# Accepts both DH (deprecated) and DHZ (canonical) for datetime
SUFFIX_TO_TYPE: dict[str, tuple[type, Callable[[str], Any]]] = {
    "N": (Decimal, _deserialize_decimal),
    "D": (date, _deserialize_date),
    "DH": (datetime, _deserialize_datetime),   # deprecated, still accepted
    "DHZ": (datetime, _deserialize_datetime),  # canonical
    "H": (time, _deserialize_time),
    "B": (bool, _deserialize_bool),
    "I": (int, _deserialize_int),
}

# XML Registry - includes bool and int (everything is string in XML)
# Same type codes as JSON: N=Decimal, D=date, DHZ=datetime, H=time
XML_TYPE_TO_SUFFIX: dict[type, tuple[str, Callable[[Any], str]]] = {
    Decimal: ("N", _serialize_decimal),
    date: ("D", _serialize_date),
    datetime: ("DHZ", _serialize_datetime),
    time: ("H", _serialize_time),
    bool: ("B", _serialize_bool),
    int: ("I", _serialize_int),
}


def register_type(
    python_type: type,
    suffix: str,
    serializer: Callable[[Any], str],
    deserializer: Callable[[str], Any],
) -> None:
    """Register a custom scalar type."""
    TYPE_TO_SUFFIX[python_type] = (suffix, serializer)
    SUFFIX_TO_TYPE[suffix] = (python_type, deserializer)


def get_suffix(python_type: type) -> str | None:
    """Get TYTX suffix for a Python type."""
    entry = TYPE_TO_SUFFIX.get(python_type)
    return entry[0] if entry else None


def get_type(suffix: str) -> type | None:
    """Get Python type for a TYTX suffix."""
    entry = SUFFIX_TO_TYPE.get(suffix)
    return entry[0] if entry else None

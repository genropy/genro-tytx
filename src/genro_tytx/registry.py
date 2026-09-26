# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
Type Registry for TYTX Base.

Maps Python types to/from TYTX suffixes.
Only scalar types are supported in base version.
"""

from __future__ import annotations

import base64
import re
from collections.abc import Callable
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any

# A type code is one or more uppercase ASCII letters ("N", "QS", "DHZ"). No
# length limit. The grammar rules out ":" so a code can never be confused with
# the "::" suffix separator or with the ":" that splits the msgpack ext-4
# payload. Validated with fullmatch: "$" alone would accept a trailing newline.
SUFFIX_PATTERN = re.compile(r"[A-Z]+")

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


def _serialize_raw(v: bytes) -> str:
    """Standard base64 (RFC 4648, padded). Text transports only: msgpack
    carries bytes as its native bin type and never reaches this hook."""
    return base64.b64encode(v).decode("ascii")


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
    bytes: ("RAW", _serialize_raw, False),
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


def _deserialize_raw(s: str) -> bytes:
    return base64.b64decode(s, validate=True)


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
    "RAW": (bytes, _deserialize_raw),
}


# =============================================================================
# CUSTOM TYPE REGISTRATION
# =============================================================================

# Classes added through register_type. Only these are matched through their
# subclasses; built-in types keep the exact-type lookup.
CUSTOM_TYPES: set[type] = set()

# Suffix -> subtype dictionary. TYTX stores it and never reads it: the type
# that owns the suffix decides its content (for "X": symbolic name -> class).
SUBTYPE_DICTS: dict[str, dict[str, Any]] = {}


def get_type_entry(value: Any) -> tuple[str, Callable[[Any], str], bool] | None:
    """Return the registry entry (suffix, serializer, json_native) for a value.

    The exact type wins. Otherwise the nearest ancestor registered through
    register_type is used, so an unregistered subclass of a custom type
    travels under that type's suffix. Returns None when nothing matches.
    """
    entry = TYPE_REGISTRY.get(type(value))
    if entry is not None:
        return entry
    for ancestor in type(value).__mro__[1:]:
        if ancestor in CUSTOM_TYPES:
            return TYPE_REGISTRY[ancestor]
    return None


def set_subtype_dict(suffix: str, subtypes: dict[str, Any]) -> None:
    """Store the subtype dictionary of a suffix, replacing the previous one.

    Nothing is checked: the suffix need not be registered and the content is
    up to the type that owns the suffix. To extend it, read it with
    get_subtype_dict, add the entries and set it again.
    """
    SUBTYPE_DICTS[suffix] = subtypes


def get_subtype_dict(suffix: str) -> dict[str, Any]:
    """Return the subtype dictionary stored for a suffix, or {} if none was set."""
    return SUBTYPE_DICTS.get(suffix, {})


def register_type(
    cls: type,
    suffix: str,
    serializer: Callable[[Any], str],
    deserializer: Callable[[str], Any],
    json_native: bool = False,
) -> None:
    """Register a custom type for TYTX serialization.

    Lets an external package (e.g. genro-bag) extend TYTX without creating a
    circular dependency: the package calls this at its own import time.

    The exact type is matched first. An unregistered subclass of a class
    registered here travels under that class's suffix, written by the
    serializer (for register_class, the subclass's own to_tytx); built-in
    types keep the exact-type rule. The concrete class of a subclass is the
    type's own business, carried through its subtype dictionary
    (set_subtype_dict). Re-registering the same class replaces its hooks;
    reusing a suffix owned by a different type is an error.

    Args:
        cls: The Python type to register
        suffix: The TYTX suffix: uppercase ASCII letters (e.g. "X" for Bag)
        serializer: Pre-JSON hook - converts obj to string
        deserializer: Post-JSON hook - converts string back to obj
        json_native: If True, skip suffix when value is JSON-native

    Raises:
        ValueError: if the suffix does not match SUFFIX_PATTERN, or is already
            registered for a different type
    """
    if not isinstance(suffix, str) or not SUFFIX_PATTERN.fullmatch(suffix):
        raise ValueError(
            f"TYTX suffix {suffix!r} is invalid: expected uppercase ASCII letters only"
        )
    existing = SUFFIX_TO_TYPE.get(suffix)
    if existing is not None and existing[0] is not cls:
        raise ValueError(
            f"TYTX suffix {suffix!r} is already registered for {existing[0].__name__}"
        )
    TYPE_REGISTRY[cls] = (suffix, serializer, json_native)
    SUFFIX_TO_TYPE[suffix] = (cls, deserializer)
    CUSTOM_TYPES.add(cls)


def register_class(cls: type) -> type:
    """Register a class that declares its own TYTX hooks. Usable as a decorator.

    Reads from the class:
        __tytx_suffix__: the TYTX suffix (e.g. "X")
        to_tytx(self) -> str: instance to string
        from_tytx(cls, s) -> obj: classmethod, string to instance
        __tytx_json_native__: optional bool, default False

    Returns the class unchanged so it can be used as a decorator.

    Raises:
        AttributeError: if __tytx_suffix__, to_tytx or from_tytx is missing
    """
    if not callable(getattr(cls, "to_tytx", None)):
        raise AttributeError(f"{cls.__name__} is missing a to_tytx method")
    register_type(
        cls,
        cls.__tytx_suffix__,
        lambda obj: obj.to_tytx(),
        cls.from_tytx,
        getattr(cls, "__tytx_json_native__", False),
    )
    return cls

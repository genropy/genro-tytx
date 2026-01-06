# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Utilities.

Provides:
- walk: recursive data structure transformation
- tytx_equivalent: semantic equivalence for roundtrip testing
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .registry import SUFFIX_TO_TYPE, TYPE_REGISTRY


def raw_encode(value: Any, force_suffix: bool = False) -> tuple[bool, str]:
    """Encode a scalar value to TYTX string with suffix.

    Args:
        value: Python scalar value (Decimal, date, datetime, time)
        force_suffix: If True, force suffix for all types (including int/bool/float)

    Returns:
        (True, "serialized::SUFFIX") if type is registered and needs suffix
        (False, str(value)) if type not registered or json_native without force
    """
    entry = TYPE_REGISTRY.get(type(value))
    if entry is None:
        return (False, str(value))
    suffix, serializer, json_native = entry
    if json_native and not force_suffix:
        return (False, str(value))
    return (True, f"{serializer(value)}::{suffix}")


def raw_decode(s: str) -> tuple[bool, Any]:
    """Decode a string with TYTX suffix.

    Args:
        s: String possibly ending with ::XX where XX is a registered suffix

    Returns:
        (True, decoded_value) if suffix found and decoded
        (False, original_value) if no valid suffix
    """
    if "::" not in s:
        return (False, s)
    value, suffix = s.rsplit("::", 1)
    entry = SUFFIX_TO_TYPE.get(suffix)
    if entry is None:
        return (False, s)
    _, decoder = entry
    return (True, decoder(value))


def walk(data: Any, callback, filtercb) -> Any:
    """Walk a data structure and apply callback to values matching filtercb.

    Args:
        data: Data structure to walk
        callback: Function to apply to matching values
        filtercb: Filter function. Applies callback when filtercb(value) is True.
    """
    if isinstance(data, dict):
        return {k: walk(v, callback, filtercb) for k, v in data.items()}
    if isinstance(data, list):
        return [walk(item, callback, filtercb) for item in data]
    if filtercb(data):
        return callback(data)
    return data


def _truncate_to_millis(dt: datetime) -> datetime:
    """Truncate microseconds to milliseconds (TYTX precision)."""
    millis = dt.microsecond // 1000 * 1000
    return dt.replace(microsecond=millis)


def datetime_equivalent(a: datetime, b: datetime) -> bool:
    """
    Check if two datetimes represent the same instant in time.

    TYTX serializes all datetimes as UTC (DHZ) with millisecond precision.
    On deserialization, naive datetimes become aware (UTC). This function
    handles the semantic equivalence for roundtrip comparison where:
    - a = original datetime (naive, treated as UTC)
    - b = decoded datetime (always aware UTC)

    Args:
        a: Original datetime (before roundtrip)
        b: Decoded datetime (after roundtrip, always aware UTC)

    Returns:
        True if both represent the same instant in time (within ms precision)

    Example:
        >>> naive = datetime(2025, 1, 15, 10, 30)
        >>> aware = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        >>> datetime_equivalent(naive, aware)
        True
    """
    # Truncate to milliseconds (TYTX precision)
    a = _truncate_to_millis(a)
    b = _truncate_to_millis(b)

    # Treat naive as UTC
    return a.replace(tzinfo=timezone.utc) == b.replace(tzinfo=timezone.utc)


def tytx_equivalent(a: Any, b: Any) -> bool:
    """
    Check if two values are semantically equivalent after TYTX roundtrip.

    Handles special cases:
    - datetime: naive vs aware UTC equivalence
    - XML attrs/value wrappers: unwraps and compares values
    - dict/list: recursive comparison
    - other types: standard equality

    Args:
        a: Original value (before roundtrip)
        b: Decoded value (after roundtrip)

    Returns:
        True if values are semantically equivalent

    Example:
        >>> original = {"dt": datetime(2025, 1, 15, 10, 30)}
        >>> decoded = {"dt": datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)}
        >>> tytx_equivalent(original, decoded)
        True
    """
    # Fast path: identical values
    if a == b:
        return True

    # datetime special case: naive vs aware UTC equivalence
    if isinstance(a, datetime) and isinstance(b, datetime):
        return datetime_equivalent(a, b)

    # dict: recursive comparison (needed to find nested datetimes)
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(
            tytx_equivalent(a[k], b[k]) for k in a
        )

    # list: recursive comparison (needed to find nested datetimes)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(
            tytx_equivalent(ai, bi) for ai, bi in zip(a, b, strict=True)
        )

    return False  # pragma: no cover

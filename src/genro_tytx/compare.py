# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Value Comparison Utilities.

Provides semantic equivalence functions for TYTX roundtrip testing.
Due to UTC normalization, some types need special comparison logic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _truncate_to_millis(dt: datetime) -> datetime:
    """Truncate microseconds to milliseconds (TYTX precision)."""
    millis = dt.microsecond // 1000 * 1000
    return dt.replace(microsecond=millis)


def datetime_equivalent(a: datetime, b: datetime) -> bool:
    """
    Check if two datetimes represent the same instant in time.

    TYTX serializes all datetimes as UTC (DHZ) with millisecond precision.
    On deserialization, naive datetimes become aware (UTC). This function
    handles the semantic equivalence:

    - naive vs aware UTC → equivalent if same wall-clock time
    - aware vs aware → equivalent if same instant (timezone-aware comparison)
    - microseconds truncated to milliseconds (TYTX precision limit)

    Args:
        a: First datetime
        b: Second datetime

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

    # Both naive: direct comparison
    if a.tzinfo is None and b.tzinfo is None:
        return a == b

    # Both aware: normalize to UTC and compare (handles different timezones)
    if a.tzinfo is not None and b.tzinfo is not None:
        return a.astimezone(timezone.utc) == b.astimezone(timezone.utc)

    # Mixed: treat naive as UTC
    if a.tzinfo is None:
        a = a.replace(tzinfo=timezone.utc)
    if b.tzinfo is None:
        b = b.replace(tzinfo=timezone.utc)

    return a == b


def _is_xml_wrapper(d: dict) -> bool:
    """Check if dict is an XML attrs/value wrapper."""
    return (
        isinstance(d, dict)
        and set(d.keys()) == {"attrs", "value"}
        and isinstance(d.get("attrs"), dict)
    )


def _unwrap_xml_value(v: Any) -> Any:
    """Recursively unwrap XML attrs/value structures, preserving attrs for comparison."""
    if _is_xml_wrapper(v):
        # Recursively unwrap attrs and value
        unwrapped_attrs = {k: _unwrap_xml_value(val) for k, val in v["attrs"].items()}
        unwrapped_value = _unwrap_xml_value(v["value"])
        # If attrs is non-empty, preserve the wrapper structure
        if unwrapped_attrs:
            return {"attrs": unwrapped_attrs, "value": unwrapped_value}
        # If attrs is empty, simplify to just the value
        return unwrapped_value
    if isinstance(v, dict):
        return {k: _unwrap_xml_value(val) for k, val in v.items()}
    if isinstance(v, list):
        return [_unwrap_xml_value(item) for item in v]
    return v


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
    # Unwrap XML attrs/value structures if present
    a = _unwrap_xml_value(a)
    b = _unwrap_xml_value(b)

    # datetime special case FIRST (before generic equality)
    # because datetime with different timezones representing same instant
    # would fail a == b but should be considered equivalent
    if isinstance(a, datetime) and isinstance(b, datetime):
        return datetime_equivalent(a, b)

    # Same type, same value (for non-datetime types)
    if a == b:
        return True

    # dict: recursive comparison
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(tytx_equivalent(a[k], b[k]) for k in a.keys())

    # list: recursive comparison
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(tytx_equivalent(ai, bi) for ai, bi in zip(a, b))

    return False

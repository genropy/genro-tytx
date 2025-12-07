# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Value Comparison Utilities.

Provides semantic equivalence functions for TYTX roundtrip testing.
Due to UTC normalization, some types need special comparison logic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def datetime_equivalent(a: datetime, b: datetime) -> bool:
    """
    Check if two datetimes represent the same instant in time.

    TYTX serializes all datetimes as UTC (DHZ). On deserialization,
    naive datetimes become aware (UTC). This function handles
    the semantic equivalence:

    - naive vs aware UTC → equivalent if same wall-clock time
    - aware vs aware → equivalent if same instant (timezone-aware comparison)

    Args:
        a: First datetime
        b: Second datetime

    Returns:
        True if both represent the same instant in time

    Example:
        >>> naive = datetime(2025, 1, 15, 10, 30)
        >>> aware = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        >>> datetime_equivalent(naive, aware)
        True
    """
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


def tytx_equivalent(a: Any, b: Any) -> bool:
    """
    Check if two values are semantically equivalent after TYTX roundtrip.

    Handles special cases:
    - datetime: naive vs aware UTC equivalence
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

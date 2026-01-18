# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Query String Encoding/Decoding.

QS format is a flat key=value structure separated by &:
    alfa=33::L&date=2025-12-14::D::QS → {"alfa": 33, "date": date(2025, 12, 14)}
    alfa&beta&gamma::QS → ["alfa", "beta", "gamma"]

Rules:
- All items with = → dict
- All items without = → list
- Mixed → error (use ::JS embedded for complex structures)
"""

from __future__ import annotations

from typing import Any

from .utils import raw_encode


def to_qs(value: dict[str, Any] | list[str]) -> str:
    """
    Encode a Python dict or list to TYTX QS string.

    Args:
        value: dict with scalar values or list of strings

    Returns:
        QS string with typed values marked

    Example:
        >>> to_qs({"alfa": 33, "date": date(2025, 12, 14)})
        'alfa=33::L&date=2025-12-14::D'
        >>> to_qs(["alfa", "beta", "gamma"])
        'alfa&beta&gamma'
    """
    if isinstance(value, list):
        return "&".join(str(item) for item in value)

    if isinstance(value, dict):
        parts = []
        for k, v in value.items():
            encoded, result = raw_encode(v, force_suffix=True)
            if encoded:
                parts.append(f"{k}={result}")
            else:
                parts.append(f"{k}={v}")
        return "&".join(parts)

    raise TypeError(f"to_qs expects dict or list, got {type(value).__name__}")


def from_qs(data: str) -> dict[str, Any] | list[Any]:
    """
    Decode a TYTX QS string to Python dict or list.

    Args:
        data: QS string (without ::QS suffix)

    Returns:
        dict if all items have =, list if none have =

    Raises:
        ValueError: if mixed (some with =, some without)

    Example:
        >>> from_qs('alfa=33::L&date=2025-12-14::D')
        {"alfa": 33, "date": date(2025, 12, 14)}
        >>> from_qs('alfa&beta&gamma')
        ["alfa", "beta", "gamma"]
    """
    from .decode import from_tytx

    if not data:
        return []

    parts = data.split("&")
    has_eq = [("=" in p) for p in parts]

    all_with_eq = all(has_eq)
    none_with_eq = not any(has_eq)

    if not all_with_eq and not none_with_eq:
        raise ValueError("QS format error: mixed items with and without '='")

    if none_with_eq:
        # List mode: decode each item
        return [from_tytx(p) for p in parts]

    # Dict mode: split key=value and decode values
    result = {}
    for part in parts:
        key, value = part.split("=", 1)
        result[key] = from_tytx(value)
    return result

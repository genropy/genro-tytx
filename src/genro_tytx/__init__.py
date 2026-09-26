# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Base - Typed Text Protocol for Scalar Types

Minimal implementation supporting:
- Scalar types: Decimal, date, datetime, time, bool, int
- Encoders/Decoders: JSON, XML, MessagePack

Usage:
    from genro_tytx import to_tytx, from_tytx

    # Encode
    data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
    json_str = to_tytx(data)
    # '{"price": "100.50::N", "date": "2025-01-15::D"}::JS'

    # Decode
    result = from_tytx(json_str)
    # {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
"""

from .decode import from_tytx, json_loads
from .encode import json_dumps, to_tytx
from .msgpack import from_msgpack, to_msgpack
from .qs import from_qs, to_qs
from .registry import (
    SUFFIX_PATTERN,
    SUFFIX_TO_TYPE,
    TYPE_REGISTRY,
    get_subtype_dict,
    register_class,
    register_type,
    set_subtype_dict,
)
from .xml import from_xml, to_xml

__version__ = "0.15.0"

__all__ = [
    # Unified API
    "to_tytx",
    "from_tytx",
    # Untyped JSON codec
    "json_dumps",
    "json_loads",
    # Transport-specific
    "to_xml",
    "from_xml",
    "to_msgpack",
    "from_msgpack",
    "to_qs",
    "from_qs",
    # Registry (for extensibility)
    "SUFFIX_PATTERN",
    "SUFFIX_TO_TYPE",
    "TYPE_REGISTRY",
    "register_type",
    "register_class",
    "set_subtype_dict",
    "get_subtype_dict",
    # Version
    "__version__",
]

# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Base - Typed Text Protocol for Scalar Types

Minimal implementation supporting:
- Scalar types: Decimal, date, datetime, time, bool, int
- Encoders/Decoders: JSON, XML, MessagePack
- HTTP utilities

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

from .registry import (
    SUFFIX_TO_TYPE,
    TYPE_REGISTRY,
)
from .encode import to_tytx
from .decode import from_tytx
from .xml import to_xml, from_xml
from .msgpack import to_msgpack, from_msgpack
from .http import asgi_data, wsgi_data
from .utils import datetime_equivalent, tytx_equivalent, walk

__version__ = "0.7.0"

__all__ = [
    # Unified API
    "to_tytx",
    "from_tytx",
    # XML
    "to_xml",
    "from_xml",
    # MessagePack
    "to_msgpack",
    "from_msgpack",
    # Registry
    "SUFFIX_TO_TYPE",
    "TYPE_REGISTRY",
    # Utilities
    "datetime_equivalent",
    "tytx_equivalent",
    "walk",
    # HTTP
    "asgi_data",
    "wsgi_data",
    # Version
    "__version__",
]

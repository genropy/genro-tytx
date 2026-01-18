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

from .decode import from_tytx
from .encode import to_tytx
from .http import asgi_data, wsgi_data
from .msgpack import from_msgpack, to_msgpack
from .qs import from_qs, to_qs
from .registry import (
    SUFFIX_TO_TYPE,
    TYPE_REGISTRY,
)
from .xml import from_xml, to_xml

__version__ = "0.7.4"

__all__ = [
    # Unified API
    "to_tytx",
    "from_tytx",
    # Transport-specific
    "to_xml",
    "from_xml",
    "to_msgpack",
    "from_msgpack",
    "to_qs",
    "from_qs",
    # HTTP
    "asgi_data",
    "wsgi_data",
    # Registry (for extensibility)
    "SUFFIX_TO_TYPE",
    "TYPE_REGISTRY",
    # Version
    "__version__",
]

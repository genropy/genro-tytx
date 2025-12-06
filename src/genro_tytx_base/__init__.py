# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Base - Typed Text Protocol for Scalar Types

Minimal implementation supporting:
- Scalar types: Decimal, date, datetime, time, bool, int
- Encoders/Decoders: JSON, XML, MessagePack
- HTTP utilities

Usage:
    from genro_tytx_base import to_tytx, from_tytx

    # Encode
    data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
    json_str = to_tytx(data)
    # '{"price": "100.50::D", "date": "2025-01-15::d"}::JS'

    # Decode
    result = from_tytx(json_str)
    # {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
"""

from .registry import (
    SUFFIX_TO_TYPE,
    TYPE_TO_SUFFIX,
    register_type,
    get_suffix,
    get_type,
)
from .encode import to_tytx, serialize_value
from .decode import from_tytx, hydrate_value
from .xml import to_xml, from_xml
from .msgpack import to_msgpack, from_msgpack
from .http import (
    MIME_JSON,
    MIME_TYTX_JSON,
    MIME_XML,
    MIME_TYTX_XML,
    MIME_MSGPACK,
    MIME_TYTX_MSGPACK,
    get_content_type,
    encode_body,
    decode_body,
    make_headers,
)

__version__ = "0.1.0"

__all__ = [
    # JSON (core)
    "to_tytx",
    "from_tytx",
    "serialize_value",
    "hydrate_value",
    # XML
    "to_xml",
    "from_xml",
    # MessagePack
    "to_msgpack",
    "from_msgpack",
    # HTTP
    "MIME_JSON",
    "MIME_TYTX_JSON",
    "MIME_XML",
    "MIME_TYTX_XML",
    "MIME_MSGPACK",
    "MIME_TYTX_MSGPACK",
    "get_content_type",
    "encode_body",
    "decode_body",
    "make_headers",
    # Registry
    "SUFFIX_TO_TYPE",
    "TYPE_TO_SUFFIX",
    "register_type",
    "get_suffix",
    "get_type",
    # Version
    "__version__",
]

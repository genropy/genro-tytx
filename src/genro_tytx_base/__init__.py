# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Base - Typed Text Protocol for Scalar Types

Minimal implementation supporting:
- Scalar types: Decimal, date, datetime, time, bool, int
- Encoders/Decoders: JSON, XML, MessagePack
- HTTP utilities

Usage:
    from genro_tytx_base import to_typed_text, from_text

    # Encode
    data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
    json_str = to_typed_text(data)
    # '{"price": "100.50::N", "date": "2025-01-15::D"}::JS'

    # Decode
    result = from_text(json_str)
    # {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
"""

from .registry import (
    SUFFIX_TO_TYPE,
    TYPE_TO_SUFFIX,
    register_type,
    get_suffix,
    get_type,
)
from .encode import to_typed_text, to_typed_json
from .decode import from_text, from_json
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
    "to_typed_text",
    "to_typed_json",
    "from_text",
    "from_json",
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

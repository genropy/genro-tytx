# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX HTTP Utilities.

Content-Type headers and request/response helpers for TYTX payloads.
"""

from __future__ import annotations

from typing import Any

from .encode import to_typed_text
from .decode import from_text
from .xml import to_xml, from_xml
from .msgpack import to_msgpack, from_msgpack

# MIME types
MIME_JSON = "application/json"
MIME_TYTX_JSON = "application/vnd.tytx+json"
MIME_XML = "application/xml"
MIME_TYTX_XML = "application/vnd.tytx+xml"
MIME_MSGPACK = "application/msgpack"
MIME_TYTX_MSGPACK = "application/vnd.tytx+msgpack"


def get_content_type(format: str = "json", tytx: bool = True) -> str:
    """
    Get the Content-Type header value.

    Args:
        format: "json", "xml", or "msgpack"
        tytx: Use TYTX-specific MIME type

    Returns:
        MIME type string
    """
    if format == "json":
        return MIME_TYTX_JSON if tytx else MIME_JSON
    if format == "xml":
        return MIME_TYTX_XML if tytx else MIME_XML
    if format == "msgpack":
        return MIME_TYTX_MSGPACK if tytx else MIME_MSGPACK
    raise ValueError(f"Unknown format: {format}")


def encode_body(value: Any, format: str = "json") -> str | bytes:
    """
    Encode a value for HTTP body.

    Args:
        value: Python object to encode
        format: "json", "xml", or "msgpack"

    Returns:
        Encoded body (str for JSON/XML, bytes for msgpack)
    """
    if format == "json":
        return to_typed_text(value)
    if format == "xml":
        return to_xml(value)
    if format == "msgpack":
        return to_msgpack(value)
    raise ValueError(f"Unknown format: {format}")


def decode_body(
    data: str | bytes,
    content_type: str | None = None,
    format: str | None = None,
) -> Any:
    """
    Decode an HTTP body.

    Args:
        data: Body content (str or bytes)
        content_type: Content-Type header value (optional)
        format: Explicit format override (optional)

    Returns:
        Decoded Python object
    """
    # Determine format
    if format is None:
        if content_type is None:
            format = "json"
        elif "msgpack" in content_type:
            format = "msgpack"
        elif "xml" in content_type:
            format = "xml"
        else:
            format = "json"

    if format == "json":
        if isinstance(data, bytes):
            data = data.decode("utf-8")
        return from_text(data)

    if format == "xml":
        if isinstance(data, bytes):
            data = data.decode("utf-8")
        return from_xml(data)

    if format == "msgpack":
        if isinstance(data, str):  # pragma: no cover
            data = data.encode("utf-8")
        return from_msgpack(data)

    raise ValueError(f"Unknown format: {format}")


def make_headers(
    format: str = "json",
    tytx: bool = True,
    accept: bool = True,
) -> dict[str, str]:
    """
    Create HTTP headers for TYTX requests.

    Args:
        format: "json", "xml", or "msgpack"
        tytx: Use TYTX-specific MIME types
        accept: Include Accept header

    Returns:
        Headers dict
    """
    content_type = get_content_type(format, tytx)
    headers = {"Content-Type": content_type}
    if accept:
        headers["Accept"] = content_type
    return headers

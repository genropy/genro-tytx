# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX HTTP utilities.

Functions to decode TYTX values from ASGI and WSGI requests.
"""

from __future__ import annotations

from collections.abc import Callable
from http.cookies import SimpleCookie
from typing import Any, Literal
from urllib.parse import parse_qs

from .decode import from_tytx


def _get_transport(content_type: str) -> Literal["json", "xml", "msgpack"] | None:
    """Get TYTX transport from content-type header."""
    if "json" in content_type:
        return "json"
    elif "xml" in content_type:
        return "xml"
    elif "msgpack" in content_type:
        return "msgpack"
    return None


def _decode_qs(query_string: str) -> dict[str, Any]:
    """Decode query string with TYTX values."""
    if not query_string:
        return {}

    parsed = parse_qs(query_string, keep_blank_values=True)
    result: dict[str, Any] = {}

    for key, values in parsed.items():
        if len(values) == 1:
            result[key] = from_tytx(values[0])
        else:
            result[key] = [from_tytx(v) for v in values]

    return result


def _decode_cookies(cookie_header: str) -> dict[str, Any]:
    """Decode cookie header string with TYTX values."""
    if not cookie_header:
        return {}

    cookies = SimpleCookie()
    cookies.load(cookie_header)

    return {key: from_tytx(morsel.value) for key, morsel in cookies.items()}


def _decode_body(body: bytes, content_type: str) -> Any:
    """Decode body bytes based on content-type."""
    transport = _get_transport(content_type)
    if not transport or not body:
        return None

    if transport == "msgpack":
        return from_tytx(body, transport=transport)
    return from_tytx(body.decode("utf-8"), transport=transport)


# ASGI


async def asgi_data(scope: dict[str, Any], receive: Callable) -> dict[str, Any]:
    """Decode ASGI request into a dict with query, headers, cookies and body."""
    # Extract headers
    headers = {}
    cookie_header = ""
    content_type = ""

    for name, value in scope.get("headers", []):
        key = name.decode("latin-1").lower()
        if key == "cookie":
            cookie_header = value.decode("latin-1")
        else:
            headers[key] = from_tytx(value.decode("latin-1"))
            if key == "content-type":
                content_type = value.decode("latin-1").lower()

    # Read body
    body = b""
    if content_type:
        while True:
            message = await receive()
            body += message.get("body", b"")
            if not message.get("more_body", False):  # pragma: no branch
                break

    return {
        "query": _decode_qs(scope.get("query_string", b"").decode("latin-1")),
        "headers": headers,
        "cookies": _decode_cookies(cookie_header),
        "body": _decode_body(body, content_type),
    }


# WSGI


def wsgi_data(environ: dict[str, Any]) -> dict[str, Any]:
    """Decode WSGI environ into a dict with query, headers, cookies and body."""
    # Extract headers
    headers = {}
    content_type = ""

    for key, value in environ.items():
        if key.startswith("HTTP_") and key != "HTTP_COOKIE":
            header_name = key[5:].lower().replace("_", "-")
            headers[header_name] = from_tytx(value)
        elif key == "CONTENT_TYPE":
            headers["content-type"] = from_tytx(value)
            content_type = value.lower()
        elif key == "CONTENT_LENGTH":
            headers["content-length"] = from_tytx(value)

    # Read body
    body = b""
    if content_type:
        try:
            content_length = int(environ.get("CONTENT_LENGTH", 0))
        except (ValueError, TypeError):
            content_length = 0

        if content_length > 0:
            wsgi_input = environ.get("wsgi.input")
            if wsgi_input:
                body = wsgi_input.read(content_length)

    return {
        "query": _decode_qs(environ.get("QUERY_STRING", "")),
        "headers": headers,
        "cookies": _decode_cookies(environ.get("HTTP_COOKIE", "")),
        "body": _decode_body(body, content_type),
    }

# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX Middleware for ASGI and WSGI.

Automatic encoding/decoding of TYTX values in HTTP requests and responses.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from datetime import date, datetime, time
from http.cookies import SimpleCookie
from typing import Any, Callable
from urllib.parse import parse_qs, urlencode

from .encode import to_typed_text
from .decode import from_text
from .registry import SUFFIX_TO_TYPE
from .http import MIME_TYTX_JSON

# Type suffix pattern: value::CODE
TYPE_SUFFIX_PATTERN = re.compile(r"^(.+)::([A-Z]+)$")


def _serialize_value(value: Any) -> str:
    """Serialize a single value with TYTX suffix if typed."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return f"{value.isoformat()}::D"
    if isinstance(value, datetime):
        return f"{value.isoformat().replace('+00:00', 'Z')}::DHZ"
    if isinstance(value, time):
        formatted = value.strftime("%H:%M:%S")
        if value.microsecond:
            formatted += f".{value.microsecond // 1000:03d}"
        return f"{formatted}::H"
    if isinstance(value, Decimal):
        return f"{value}::N"
    if isinstance(value, bool):
        return f"{'1' if value else '0'}::B"
    return str(value)


def _parse_value(value: str) -> Any:
    """Parse a single value, hydrating if it has TYTX suffix."""
    match = TYPE_SUFFIX_PATTERN.match(value)
    if not match:
        return value

    raw, code = match.groups()
    type_def = SUFFIX_TO_TYPE.get(code)
    if type_def:
        _, deserializer = type_def
        return deserializer(raw)
    return value


def encode_query_string(params: dict[str, Any]) -> str:
    """
    Encode a dict to URL query string with TYTX values.

    Args:
        params: Dict of parameter names to values

    Returns:
        URL-encoded query string

    Example:
        >>> encode_query_string({"date": date(2025, 1, 15), "limit": 10})
        'date=2025-01-15::D&limit=10'
    """
    encoded = {}
    for key, value in params.items():
        if value is None:
            continue
        encoded[key] = _serialize_value(value)
    return urlencode(encoded)


def decode_query_string(query_string: str) -> dict[str, Any]:
    """
    Decode a URL query string with TYTX values.

    Args:
        query_string: URL query string (without leading ?)

    Returns:
        Dict with decoded values

    Example:
        >>> decode_query_string("date=2025-01-15::D&limit=10")
        {'date': date(2025, 1, 15), 'limit': '10'}
    """
    if not query_string:
        return {}

    parsed = parse_qs(query_string, keep_blank_values=True)
    result: dict[str, Any] = {}

    for key, values in parsed.items():
        if len(values) == 1:
            result[key] = _parse_value(values[0])
        else:
            result[key] = [_parse_value(v) for v in values]

    return result


def encode_header_value(value: Any) -> str:
    """
    Encode a value for use in HTTP header.

    Args:
        value: Value to encode

    Returns:
        String with TYTX suffix if typed

    Example:
        >>> encode_header_value(time(10, 30))
        '10:30:00::H'
    """
    return _serialize_value(value)


def decode_header_value(value: str) -> Any:
    """
    Decode a single header value with TYTX suffix.

    Args:
        value: Header value string

    Returns:
        Decoded value (native type if TYTX suffix present)

    Example:
        >>> decode_header_value("10:30:00::H")
        datetime.time(10, 30)
    """
    return _parse_value(value)


def _decode_cookies(cookie_header: str) -> dict[str, Any]:
    """Decode cookies, hydrating TYTX values."""
    if not cookie_header:
        return {}

    cookies = SimpleCookie()
    cookies.load(cookie_header)

    result = {}
    for key, morsel in cookies.items():
        result[key] = _parse_value(morsel.value)

    return result


def _decode_headers(
    headers: list[tuple[bytes, bytes]], prefix: str
) -> dict[str, Any]:
    """Decode headers with given prefix, hydrating TYTX values."""
    result = {}
    prefix_lower = prefix.lower()

    for name, value in headers:
        name_str = name.decode("latin-1").lower()
        if name_str.startswith(prefix_lower):
            # Remove prefix for the key
            key = name_str[len(prefix_lower) :]
            result[key] = _parse_value(value.decode("latin-1"))

    return result


async def _read_body(receive: Callable) -> bytes:
    """Read complete body from ASGI receive."""
    body = b""
    while True:
        message = await receive()
        body += message.get("body", b"")
        if not message.get("more_body", False):
            break
    return body


class TYTXMiddleware:
    """
    ASGI middleware for automatic TYTX encoding/decoding.

    Decodes TYTX values from:
    - Query string parameters
    - Headers with configurable prefix
    - Cookies
    - JSON body

    Encodes responses:
    - JSON responses are encoded with TYTX

    Example:
        app = TYTXMiddleware(your_app)
    """

    def __init__(
        self,
        app: Any,
        decode_query: bool = True,
        decode_headers: bool = True,
        decode_cookies: bool = True,
        decode_body: bool = True,
        encode_response: bool = True,
        header_prefix: str = "x-tytx-",
    ) -> None:
        self.app = app
        self.decode_query = decode_query
        self.decode_headers = decode_headers
        self.decode_cookies = decode_cookies
        self.decode_body = decode_body
        self.encode_response = encode_response
        self.header_prefix = header_prefix

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable,
        send: Callable,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Decode request
        tytx: dict[str, Any] = {}

        # Query string
        if self.decode_query:
            qs = scope.get("query_string", b"").decode("latin-1")
            tytx["query"] = decode_query_string(qs)

        # Headers
        headers = scope.get("headers", [])
        if self.decode_headers:
            tytx["headers"] = _decode_headers(headers, self.header_prefix)

        # Cookies
        if self.decode_cookies:
            cookie_header = ""
            for name, value in headers:
                if name.lower() == b"cookie":
                    cookie_header = value.decode("latin-1")
                    break
            tytx["cookies"] = _decode_cookies(cookie_header)

        # Body - need to buffer it
        body_bytes = b""
        body_received = False

        async def receive_wrapper() -> dict[str, Any]:
            nonlocal body_bytes, body_received
            if not body_received:
                body_bytes = await _read_body(receive)
                body_received = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        # Decode body if JSON
        if self.decode_body:
            # Check content-type
            content_type = ""
            for name, value in headers:
                if name.lower() == b"content-type":
                    content_type = value.decode("latin-1").lower()
                    break

            if "json" in content_type or "tytx" in content_type:
                body_bytes = await _read_body(receive)
                body_received = True
                if body_bytes:
                    try:
                        tytx["body"] = from_text(body_bytes.decode("utf-8"))
                    except (json.JSONDecodeError, ValueError):
                        tytx["body"] = None
                else:
                    tytx["body"] = None

        # Add tytx to scope
        scope["tytx"] = tytx

        # Response handling
        if not self.encode_response:
            await self.app(scope, receive_wrapper, send)
            return

        # Buffer response to potentially encode it
        response_started = False
        response_headers: list[tuple[bytes, bytes]] = []
        response_body = b""
        response_status = 200

        async def send_wrapper(message: dict[str, Any]) -> None:
            nonlocal response_started, response_headers, response_body, response_status

            if message["type"] == "http.response.start":
                response_started = True
                response_status = message.get("status", 200)
                response_headers = list(message.get("headers", []))

            elif message["type"] == "http.response.body":
                response_body += message.get("body", b"")

                if not message.get("more_body", False):
                    # Check if we should encode
                    content_type = ""
                    for i, (name, value) in enumerate(response_headers):
                        if name.lower() == b"content-type":
                            content_type = value.decode("latin-1").lower()
                            break

                    # Encode JSON responses
                    if response_body and "json" in content_type:
                        try:
                            data = json.loads(response_body.decode("utf-8"))
                            encoded = to_typed_text(data)
                            response_body = encoded.encode("utf-8")

                            # Update content-type
                            new_headers = []
                            for name, value in response_headers:
                                if name.lower() == b"content-type":
                                    new_headers.append(
                                        (name, MIME_TYTX_JSON.encode("latin-1"))
                                    )
                                elif name.lower() == b"content-length":
                                    new_headers.append(
                                        (name, str(len(response_body)).encode("latin-1"))
                                    )
                                else:
                                    new_headers.append((name, value))
                            response_headers = new_headers
                        except (json.JSONDecodeError, ValueError):
                            pass

                    # Send response
                    await send({
                        "type": "http.response.start",
                        "status": response_status,
                        "headers": response_headers,
                    })
                    await send({
                        "type": "http.response.body",
                        "body": response_body,
                    })

        await self.app(scope, receive_wrapper, send_wrapper)


class TYTXWSGIMiddleware:
    """
    WSGI middleware for automatic TYTX encoding/decoding.

    Same functionality as TYTXMiddleware but for WSGI applications.

    Example:
        app.wsgi_app = TYTXWSGIMiddleware(app.wsgi_app)
    """

    def __init__(
        self,
        app: Any,
        decode_query: bool = True,
        decode_headers: bool = True,
        decode_cookies: bool = True,
        decode_body: bool = True,
        encode_response: bool = True,
        header_prefix: str = "x-tytx-",
    ) -> None:
        self.app = app
        self.decode_query = decode_query
        self.decode_headers = decode_headers
        self.decode_cookies = decode_cookies
        self.decode_body = decode_body
        self.encode_response = encode_response
        self.header_prefix = header_prefix

    def __call__(
        self,
        environ: dict[str, Any],
        start_response: Callable,
    ) -> Any:
        # Decode request
        tytx: dict[str, Any] = {}

        # Query string
        if self.decode_query:
            qs = environ.get("QUERY_STRING", "")
            tytx["query"] = decode_query_string(qs)

        # Headers
        if self.decode_headers:
            prefix_http = "HTTP_" + self.header_prefix.upper().replace("-", "_")
            headers_dict = {}
            for key, value in environ.items():
                if key.startswith(prefix_http):
                    header_key = key[len(prefix_http) :].lower().replace("_", "-")
                    headers_dict[header_key] = _parse_value(value)
            tytx["headers"] = headers_dict

        # Cookies
        if self.decode_cookies:
            cookie_header = environ.get("HTTP_COOKIE", "")
            tytx["cookies"] = _decode_cookies(cookie_header)

        # Body
        if self.decode_body:
            content_type = environ.get("CONTENT_TYPE", "").lower()
            if "json" in content_type or "tytx" in content_type:
                try:
                    content_length = int(environ.get("CONTENT_LENGTH", 0) or 0)
                    if content_length > 0:
                        body = environ["wsgi.input"].read(content_length)
                        tytx["body"] = from_text(body.decode("utf-8"))
                    else:
                        tytx["body"] = None
                except (json.JSONDecodeError, ValueError):
                    tytx["body"] = None

        # Add tytx to environ
        environ["tytx"] = tytx

        if not self.encode_response:
            return self.app(environ, start_response)

        # Capture response
        response_body: list[bytes] = []
        response_headers: list[tuple[str, str]] = []
        response_status = ""

        def capture_start_response(
            status: str, headers: list[tuple[str, str]], exc_info: Any = None
        ) -> Callable:
            nonlocal response_status, response_headers
            response_status = status
            response_headers = list(headers)
            return lambda s: response_body.append(s)

        # Get response
        result = self.app(environ, capture_start_response)
        for chunk in result:
            response_body.append(chunk)
        if hasattr(result, "close"):
            result.close()

        body_bytes = b"".join(response_body)

        # Check if we should encode
        content_type = ""
        for name, value in response_headers:
            if name.lower() == "content-type":
                content_type = value.lower()
                break

        if body_bytes and "json" in content_type:
            try:
                data = json.loads(body_bytes.decode("utf-8"))
                encoded = to_typed_text(data)
                body_bytes = encoded.encode("utf-8")

                # Update headers
                new_headers = []
                for name, value in response_headers:
                    if name.lower() == "content-type":
                        new_headers.append((name, MIME_TYTX_JSON))
                    elif name.lower() == "content-length":
                        new_headers.append((name, str(len(body_bytes))))
                    else:
                        new_headers.append((name, value))
                response_headers = new_headers
            except (json.JSONDecodeError, ValueError):
                pass

        start_response(response_status, response_headers)
        return [body_bytes]

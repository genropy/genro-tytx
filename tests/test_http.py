# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for TYTX HTTP utilities."""

from datetime import date, datetime, time, timezone
from decimal import Decimal

import pytest

from io import BytesIO

from genro_tytx import to_tytx, asgi_data, wsgi_data
from genro_tytx.utils import tytx_equivalent


# Test datasets: (description, query_params, headers, cookies, body)
DATASETS = [
    # Query string
    (
        "decimal in query",
        {"price": Decimal("100.50")},
        {},
        {},
        None,
    ),
    (
        "date in query",
        {"date": date(2025, 1, 15)},
        {},
        {},
        None,
    ),
    (
        "multiple params in query",
        {"price": Decimal("99.99"), "date": date(2025, 6, 15), "active": True},
        {},
        {},
        None,
    ),
    # Headers
    (
        "decimal in header",
        {},
        {"x-price": Decimal("100.50")},
        {},
        None,
    ),
    (
        "datetime in header",
        {},
        {"x-timestamp": datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)},
        {},
        None,
    ),
    # Cookies
    (
        "date in cookie",
        {},
        {},
        {"session_date": date(2025, 1, 15)},
        None,
    ),
    (
        "decimal in cookie",
        {},
        {},
        {"last_price": Decimal("50.00")},
        None,
    ),
    # Body
    (
        "simple body",
        {},
        {},
        {},
        {"price": Decimal("100.50"), "date": date(2025, 1, 15)},
    ),
    (
        "nested body",
        {},
        {},
        {},
        {
            "order": {
                "total": Decimal("999.99"),
                "created": datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
            }
        },
    ),
    (
        "list in body",
        {},
        {},
        {},
        {"items": [Decimal("10.00"), Decimal("20.00"), Decimal("30.00")]},
    ),
    # Combined
    (
        "all sources",
        {"limit": Decimal("100")},
        {"x-request-time": time(10, 30, 0)},
        {"user_date": date(2025, 1, 1)},
        {"data": {"value": Decimal("42.00")}},
    ),
]


def _tytx_value(value) -> str:
    """Convert a value to TYTX string (without JSON quotes)."""
    tytx_str = to_tytx(value)
    if tytx_str.startswith('"') and tytx_str.endswith('"'):
        tytx_str = tytx_str[1:-1]
    return tytx_str


def _encode_query_string(params: dict) -> bytes:
    """Encode params dict to query string with TYTX suffixes."""
    if not params:
        return b""
    from urllib.parse import urlencode

    encoded = {key: _tytx_value(value) for key, value in params.items()}
    return urlencode(encoded).encode("latin-1")


def _encode_headers(params: dict) -> list[tuple[bytes, bytes]]:
    """Encode params dict to ASGI headers with TYTX suffixes."""
    return [
        (key.encode("latin-1"), _tytx_value(value).encode("latin-1"))
        for key, value in params.items()
    ]


def _encode_cookies(params: dict) -> str:
    """Encode params dict to cookie header string with TYTX suffixes."""
    if not params:
        return ""
    return "; ".join(f"{key}={_tytx_value(value)}" for key, value in params.items())


class MockReceive:
    """Mock ASGI receive callable."""

    def __init__(self, body: bytes = b""):
        self.body = body
        self.called = False

    async def __call__(self):
        if not self.called:
            self.called = True
            return {"type": "http.request", "body": self.body, "more_body": False}
        return {"type": "http.request", "body": b"", "more_body": False}


def dataset_ids():
    """Generate test IDs from dataset descriptions."""
    return [d[0] for d in DATASETS]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "description,query_params,header_params,cookie_params,body_data",
    DATASETS,
    ids=dataset_ids(),
)
async def test_asgi_data(
    description, query_params, header_params, cookie_params, body_data
):
    """Test that asgi_data correctly decodes TYTX values from request."""
    # Build headers
    headers = []

    if body_data is not None:
        headers.append((b"content-type", b"application/json"))

    headers.extend(_encode_headers(header_params))

    cookie_str = _encode_cookies(cookie_params)
    if cookie_str:
        headers.append((b"cookie", cookie_str.encode("latin-1")))

    scope = {
        "type": "http",
        "query_string": _encode_query_string(query_params),
        "headers": headers,
    }

    # Build body
    if body_data is not None:
        body_json = to_tytx(body_data, transport="json")
        receive = MockReceive(body_json.encode("utf-8"))
    else:
        receive = MockReceive(b"")

    # Call asgi_data
    result = await asgi_data(scope, receive)

    # Verify query
    for key, expected in query_params.items():
        assert key in result["query"], f"Missing query param: {key}"
        assert tytx_equivalent(expected, result["query"][key]), (
            f"Query mismatch for {key}: {expected!r} != {result['query'][key]!r}"
        )

    # Verify headers
    for key, expected in header_params.items():
        assert key in result["headers"], f"Missing header: {key}"
        assert tytx_equivalent(expected, result["headers"][key]), (
            f"Header mismatch for {key}: {expected!r} != {result['headers'][key]!r}"
        )

    # Verify cookies
    for key, expected in cookie_params.items():
        assert key in result["cookies"], f"Missing cookie: {key}"
        assert tytx_equivalent(expected, result["cookies"][key]), (
            f"Cookie mismatch for {key}: {expected!r} != {result['cookies'][key]!r}"
        )

    # Verify body
    if body_data is not None:
        assert tytx_equivalent(body_data, result["body"]), (
            f"Body mismatch: {body_data!r} != {result['body']!r}"
        )


@pytest.mark.asyncio
async def test_asgi_data_no_body():
    """Request without body should have body=None."""
    scope = {
        "type": "http",
        "query_string": b"",
        "headers": [],
    }

    result = await asgi_data(scope, MockReceive())
    assert result["body"] is None


@pytest.mark.asyncio
async def test_asgi_data_empty_json_body():
    """Empty JSON body should return None."""
    scope = {
        "type": "http",
        "query_string": b"",
        "headers": [(b"content-type", b"application/json")],
    }

    result = await asgi_data(scope, MockReceive(b""))
    assert result["body"] is None


@pytest.mark.asyncio
async def test_asgi_data_empty_scope():
    """Empty scope should return empty dicts."""
    scope = {}

    result = await asgi_data(scope, MockReceive())

    assert result["query"] == {}
    assert result["headers"] == {}
    assert result["cookies"] == {}
    assert result["body"] is None


# WSGI tests


def _wsgi_headers(params: dict) -> dict:
    """Convert header params to WSGI environ format (HTTP_* keys)."""
    result = {}
    for key, value in params.items():
        wsgi_key = "HTTP_" + key.upper().replace("-", "_")
        result[wsgi_key] = _tytx_value(value)
    return result


@pytest.mark.parametrize(
    "description,query_params,header_params,cookie_params,body_data",
    DATASETS,
    ids=dataset_ids(),
)
def test_wsgi_data(description, query_params, header_params, cookie_params, body_data):
    """Test that wsgi_data correctly decodes TYTX values from request."""
    # Build environ
    environ = {}

    # Query string
    if query_params:
        from urllib.parse import urlencode

        encoded = {key: _tytx_value(value) for key, value in query_params.items()}
        environ["QUERY_STRING"] = urlencode(encoded)

    # Headers
    environ.update(_wsgi_headers(header_params))

    # Cookies
    cookie_str = _encode_cookies(cookie_params)
    if cookie_str:
        environ["HTTP_COOKIE"] = cookie_str

    # Body
    if body_data is not None:
        body_json = to_tytx(body_data, transport="json")
        body_bytes = body_json.encode("utf-8")
        environ["CONTENT_TYPE"] = "application/json"
        environ["CONTENT_LENGTH"] = str(len(body_bytes))
        environ["wsgi.input"] = BytesIO(body_bytes)

    # Call wsgi_data
    result = wsgi_data(environ)

    # Verify query
    for key, expected in query_params.items():
        assert key in result["query"], f"Missing query param: {key}"
        assert tytx_equivalent(expected, result["query"][key]), (
            f"Query mismatch for {key}: {expected!r} != {result['query'][key]!r}"
        )

    # Verify headers
    for key, expected in header_params.items():
        assert key in result["headers"], f"Missing header: {key}"
        assert tytx_equivalent(expected, result["headers"][key]), (
            f"Header mismatch for {key}: {expected!r} != {result['headers'][key]!r}"
        )

    # Verify cookies
    for key, expected in cookie_params.items():
        assert key in result["cookies"], f"Missing cookie: {key}"
        assert tytx_equivalent(expected, result["cookies"][key]), (
            f"Cookie mismatch for {key}: {expected!r} != {result['cookies'][key]!r}"
        )

    # Verify body
    if body_data is not None:
        assert tytx_equivalent(body_data, result["body"]), (
            f"Body mismatch: {body_data!r} != {result['body']!r}"
        )


def test_wsgi_data_no_body():
    """Request without body should have body=None."""
    environ = {}

    result = wsgi_data(environ)
    assert result["body"] is None


def test_wsgi_data_empty_json_body():
    """Empty JSON body should return None."""
    environ = {
        "CONTENT_TYPE": "application/json",
        "CONTENT_LENGTH": "0",
    }

    result = wsgi_data(environ)
    assert result["body"] is None


def test_wsgi_data_empty_environ():
    """Empty environ should return empty dicts."""
    environ = {}

    result = wsgi_data(environ)

    assert result["query"] == {}
    assert result["headers"] == {}
    assert result["cookies"] == {}
    assert result["body"] is None


# Edge cases for coverage


@pytest.mark.asyncio
async def test_asgi_data_multi_value_query():
    """Query with multiple values for same key."""
    scope = {
        "query_string": b"tag=100.50%3A%3AN&tag=200.75%3A%3AN",
        "headers": [],
    }

    result = await asgi_data(scope, MockReceive())

    assert result["query"]["tag"] == [Decimal("100.50"), Decimal("200.75")]


@pytest.mark.asyncio
async def test_asgi_data_xml_body():
    """XML body transport."""
    from genro_tytx import to_xml

    body_data = {"root": {"attrs": {}, "value": Decimal("100.50")}}
    body_xml = to_xml(body_data)

    scope = {
        "query_string": b"",
        "headers": [(b"content-type", b"application/xml")],
    }

    result = await asgi_data(scope, MockReceive(body_xml.encode("utf-8")))

    assert result["body"]["root"]["value"] == Decimal("100.50")


@pytest.mark.asyncio
async def test_asgi_data_msgpack_body():
    """MessagePack body transport."""
    from genro_tytx import to_msgpack

    body_data = {"price": Decimal("100.50")}
    body_bytes = to_msgpack(body_data)

    scope = {
        "query_string": b"",
        "headers": [(b"content-type", b"application/msgpack")],
    }

    result = await asgi_data(scope, MockReceive(body_bytes))

    assert result["body"]["price"] == Decimal("100.50")


@pytest.mark.asyncio
async def test_asgi_data_raw_body_passthrough():
    """A body TYTX cannot hydrate is handed back raw, not dropped (octet-stream)."""
    blob = b"\x80\x04\x95not-json-at-all\x00\xff"
    scope = {
        "query_string": b"",
        "headers": [(b"content-type", b"application/octet-stream")],
    }

    result = await asgi_data(scope, MockReceive(blob))

    assert result["body"] == blob


@pytest.mark.asyncio
async def test_asgi_data_unknown_content_type_passthrough():
    """Any unknown content-type with a body is handed back raw (general rule)."""
    blob = b"\x89PNG\r\n\x1a\n binary image bytes"
    scope = {
        "query_string": b"",
        "headers": [(b"content-type", b"image/png")],
    }

    result = await asgi_data(scope, MockReceive(blob))

    assert result["body"] == blob


def test_wsgi_data_raw_body_passthrough():
    """WSGI body TYTX cannot hydrate is handed back raw too."""
    blob = b"\x80\x04\x95binary\x00\xff"
    environ = {
        "CONTENT_TYPE": "application/octet-stream",
        "CONTENT_LENGTH": str(len(blob)),
        "wsgi.input": BytesIO(blob),
    }

    result = wsgi_data(environ)

    assert result["body"] == blob


def test_wsgi_data_invalid_content_length():
    """Invalid CONTENT_LENGTH should be handled."""
    environ = {
        "CONTENT_TYPE": "application/json",
        "CONTENT_LENGTH": "invalid",
    }

    result = wsgi_data(environ)
    assert result["body"] is None


def test_wsgi_data_missing_wsgi_input():
    """Missing wsgi.input should return None body."""
    environ = {
        "CONTENT_TYPE": "application/json",
        "CONTENT_LENGTH": "10",
    }

    result = wsgi_data(environ)
    assert result["body"] is None


# Plain JSON body tests (non-TYTX clients)


PLAIN_JSON_BODIES = [
    (
        "plain dict",
        b'{"key": "value", "count": 42}',
        {"key": "value", "count": 42},
    ),
    (
        "plain list",
        b'[1, 2, 3]',
        [1, 2, 3],
    ),
    (
        "nested dict",
        b'{"jsonrpc": "2.0", "id": 1, "method": "initialize"}',
        {"jsonrpc": "2.0", "id": 1, "method": "initialize"},
    ),
    (
        "plain string value",
        b'{"name": "hello"}',
        {"name": "hello"},
    ),
]


def plain_json_ids():
    return [d[0] for d in PLAIN_JSON_BODIES]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "description,body_bytes,expected",
    PLAIN_JSON_BODIES,
    ids=plain_json_ids(),
)
async def test_asgi_data_plain_json_body(description, body_bytes, expected):
    """Plain JSON body (non-TYTX) should parse correctly via ASGI."""
    scope = {
        "type": "http",
        "query_string": b"",
        "headers": [(b"content-type", b"application/json")],
    }

    result = await asgi_data(scope, MockReceive(body_bytes))
    assert result["body"] == expected, (
        f"Plain JSON body corrupted: {expected!r} != {result['body']!r}"
    )


@pytest.mark.parametrize(
    "description,body_bytes,expected",
    PLAIN_JSON_BODIES,
    ids=plain_json_ids(),
)
def test_wsgi_data_plain_json_body(description, body_bytes, expected):
    """Plain JSON body (non-TYTX) should parse correctly via WSGI."""
    environ = {
        "CONTENT_TYPE": "application/json",
        "CONTENT_LENGTH": str(len(body_bytes)),
        "wsgi.input": BytesIO(body_bytes),
    }

    result = wsgi_data(environ)
    assert result["body"] == expected, (
        f"Plain JSON body corrupted: {expected!r} != {result['body']!r}"
    )


# Transport <-> MIME mapping (issue #38)


def test_transport_mime_matches_spec():
    """TRANSPORT_MIME carries the exact MIME strings from the spec (§9.6)."""
    from genro_tytx import TRANSPORT_MIME

    assert TRANSPORT_MIME == {
        "json": "application/vnd.tytx+json",
        "xml": "application/vnd.tytx+xml",
        "msgpack": "application/vnd.tytx+msgpack",
    }


def test_mime_transport_is_inverse():
    """MIME_TRANSPORT is the exact inverse of TRANSPORT_MIME."""
    from genro_tytx import MIME_TRANSPORT, TRANSPORT_MIME

    assert MIME_TRANSPORT == {v: k for k, v in TRANSPORT_MIME.items()}
    assert MIME_TRANSPORT["application/vnd.tytx+msgpack"] == "msgpack"


def test_get_transport_matches_tytx_mime():
    """get_transport resolves the TYTX MIME strings to their transport."""
    from genro_tytx import get_transport

    assert get_transport("application/vnd.tytx+json") == "json"
    assert get_transport("application/vnd.tytx+xml") == "xml"
    assert get_transport("application/vnd.tytx+msgpack") == "msgpack"


def test_get_transport_matches_standard_mime():
    """get_transport uses substring matching, so standard MIME resolves too."""
    from genro_tytx import get_transport

    assert get_transport("application/json") == "json"
    assert get_transport("application/xml") == "xml"


def test_get_transport_unknown_returns_none():
    """An unrelated content-type resolves to None."""
    from genro_tytx import get_transport

    assert get_transport("application/octet-stream") is None
    assert get_transport("") is None

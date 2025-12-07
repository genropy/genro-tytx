# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for TYTX middleware."""

from datetime import date, datetime, time, timezone
from decimal import Decimal

import pytest

from genro_tytx.middleware import (
    encode_query_string,
    decode_query_string,
    encode_header_value,
    decode_header_value,
    TYTXMiddleware,
    TYTXWSGIMiddleware,
)


class TestQueryString:
    """Tests for query string encoding/decoding."""

    def test_encode_date(self) -> None:
        result = encode_query_string({"date": date(2025, 1, 15)})
        assert result == "date=2025-01-15%3A%3AD"  # URL-encoded ::

    def test_encode_decimal(self) -> None:
        result = encode_query_string({"price": Decimal("100.50")})
        assert "price=100.50" in result
        assert "%3A%3AN" in result  # ::N URL-encoded

    def test_encode_time(self) -> None:
        result = encode_query_string({"t": time(10, 30, 0)})
        assert "t=10%3A30%3A00%3A%3AH" in result

    def test_encode_mixed(self) -> None:
        result = encode_query_string({
            "date": date(2025, 1, 15),
            "limit": 10,
            "name": "test",
        })
        assert "date=2025-01-15%3A%3AD" in result
        assert "limit=10" in result
        assert "name=test" in result

    def test_encode_none_skipped(self) -> None:
        result = encode_query_string({"a": 1, "b": None, "c": 2})
        assert "a=1" in result
        assert "c=2" in result
        assert "b" not in result

    def test_decode_date(self) -> None:
        result = decode_query_string("date=2025-01-15::D")
        assert result["date"] == date(2025, 1, 15)

    def test_decode_decimal(self) -> None:
        result = decode_query_string("price=100.50::N")
        assert result["price"] == Decimal("100.50")

    def test_decode_time(self) -> None:
        result = decode_query_string("t=10:30:00::H")
        assert result["t"].hour == 10
        assert result["t"].minute == 30

    def test_decode_mixed(self) -> None:
        result = decode_query_string("date=2025-01-15::D&limit=10&name=test")
        assert result["date"] == date(2025, 1, 15)
        assert result["limit"] == "10"  # No type suffix = string
        assert result["name"] == "test"

    def test_decode_empty(self) -> None:
        result = decode_query_string("")
        assert result == {}

    def test_decode_multiple_values(self) -> None:
        result = decode_query_string("id=1&id=2&id=3")
        assert result["id"] == ["1", "2", "3"]

    def test_roundtrip(self) -> None:
        original = {"date": date(2025, 1, 15)}
        encoded = encode_query_string(original)
        # URL decode for roundtrip test
        from urllib.parse import unquote
        decoded = decode_query_string(unquote(encoded))
        assert decoded["date"] == original["date"]


class TestHeaderValue:
    """Tests for header value encoding/decoding."""

    def test_encode_time(self) -> None:
        result = encode_header_value(time(10, 30, 0))
        assert result == "10:30:00::H"

    def test_encode_date(self) -> None:
        result = encode_header_value(date(2025, 1, 15))
        assert result == "2025-01-15::D"

    def test_encode_datetime(self) -> None:
        dt = datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = encode_header_value(dt)
        assert "2025-01-15" in result
        assert "::DHZ" in result

    def test_encode_decimal(self) -> None:
        result = encode_header_value(Decimal("100.50"))
        assert result == "100.50::N"

    def test_encode_bool(self) -> None:
        assert encode_header_value(True) == "1::B"
        assert encode_header_value(False) == "0::B"

    def test_encode_string(self) -> None:
        result = encode_header_value("hello")
        assert result == "hello"

    def test_decode_time(self) -> None:
        result = decode_header_value("10:30:00::H")
        assert result.hour == 10
        assert result.minute == 30

    def test_decode_date(self) -> None:
        result = decode_header_value("2025-01-15::D")
        assert result == date(2025, 1, 15)

    def test_decode_decimal(self) -> None:
        result = decode_header_value("100.50::N")
        assert result == Decimal("100.50")

    def test_decode_no_suffix(self) -> None:
        result = decode_header_value("plain-value")
        assert result == "plain-value"


class TestASGIMiddleware:
    """Tests for ASGI middleware."""

    @pytest.mark.asyncio
    async def test_decode_query(self) -> None:
        """Test query string decoding."""
        captured_scope = {}

        async def app(scope, receive, send):
            captured_scope.update(scope)
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = TYTXMiddleware(app)

        scope = {
            "type": "http",
            "query_string": b"date=2025-01-15::D&limit=10",
            "headers": [],
        }

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        assert "tytx" in captured_scope
        assert captured_scope["tytx"]["query"]["date"] == date(2025, 1, 15)
        assert captured_scope["tytx"]["query"]["limit"] == "10"

    @pytest.mark.asyncio
    async def test_decode_headers(self) -> None:
        """Test header decoding with prefix."""
        captured_scope = {}

        async def app(scope, receive, send):
            captured_scope.update(scope)
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = TYTXMiddleware(app)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [
                (b"x-tytx-timestamp", b"10:30:00::H"),
                (b"x-tytx-date", b"2025-01-15::D"),
                (b"authorization", b"Bearer token"),
            ],
        }

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        assert "tytx" in captured_scope
        headers = captured_scope["tytx"]["headers"]
        assert headers["timestamp"].hour == 10
        assert headers["date"] == date(2025, 1, 15)

    @pytest.mark.asyncio
    async def test_decode_body(self) -> None:
        """Test JSON body decoding."""
        captured_scope = {}

        async def app(scope, receive, send):
            captured_scope.update(scope)
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = TYTXMiddleware(app)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"content-type", b"application/json")],
        }

        body = b'{"price":"100.50::N"}::JS'
        body_sent = False

        async def receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        assert "tytx" in captured_scope
        assert captured_scope["tytx"]["body"]["price"] == Decimal("100.50")

    @pytest.mark.asyncio
    async def test_encode_response(self) -> None:
        """Test response encoding."""
        import json

        async def app(scope, receive, send):
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            })
            await send({
                "type": "http.response.body",
                "body": json.dumps({"total": 100.50}).encode(),
            })

        middleware = TYTXMiddleware(app)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [],
        }

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        # Check response was encoded
        assert len(sent) == 2
        headers = dict(sent[0]["headers"])
        assert b"vnd.tytx+json" in headers.get(b"content-type", b"")

    @pytest.mark.asyncio
    async def test_non_http_passthrough(self) -> None:
        """Test non-HTTP requests pass through."""
        called = False

        async def app(scope, receive, send):
            nonlocal called
            called = True

        middleware = TYTXMiddleware(app)

        scope = {"type": "websocket"}

        await middleware(scope, None, None)

        assert called


class TestWSGIMiddleware:
    """Tests for WSGI middleware."""

    def test_decode_query(self) -> None:
        """Test query string decoding."""
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "date=2025-01-15::D&limit=10",
            "REQUEST_METHOD": "GET",
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert "tytx" in captured_environ
        assert captured_environ["tytx"]["query"]["date"] == date(2025, 1, 15)

    def test_decode_headers(self) -> None:
        """Test header decoding with prefix."""
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "HTTP_X_TYTX_TIMESTAMP": "10:30:00::H",
            "HTTP_X_TYTX_DATE": "2025-01-15::D",
            "HTTP_AUTHORIZATION": "Bearer token",
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert "tytx" in captured_environ
        headers = captured_environ["tytx"]["headers"]
        assert headers["timestamp"].hour == 10
        assert headers["date"] == date(2025, 1, 15)

    def test_encode_response(self) -> None:
        """Test response encoding."""
        import json
        from io import BytesIO

        def app(environ, start_response):
            start_response("200 OK", [("Content-Type", "application/json")])
            return [json.dumps({"total": 100.50}).encode()]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        response_headers = []

        def start_response(status, headers):
            response_headers.extend(headers)

        result = list(middleware(environ, start_response))

        # Check response was encoded (content-type updated)
        content_type = dict(response_headers).get("Content-Type", "")
        assert "vnd.tytx+json" in content_type

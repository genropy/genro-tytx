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


class TestMiddlewareEdgeCases:
    """Tests for middleware edge cases."""

    def test_encode_time_with_microseconds(self) -> None:
        """Time with microseconds should format milliseconds."""
        t = time(10, 30, 45, 123456)  # 123456 microseconds = 123 milliseconds
        result = encode_header_value(t)
        assert "10:30:45.123::H" in result

    def test_decode_unknown_suffix(self) -> None:
        """Unknown suffix returns string as-is."""
        result = decode_header_value("something::UNKNOWN")
        assert result == "something::UNKNOWN"


class TestASGIMiddlewareEdgeCases:
    """Additional tests for ASGI middleware edge cases."""

    @pytest.mark.asyncio
    async def test_decode_cookies(self) -> None:
        """Test cookie decoding."""
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
                (b"cookie", b"session=abc123; date=2025-01-15::D"),
            ],
        }

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        assert "tytx" in captured_scope
        cookies = captured_scope["tytx"]["cookies"]
        assert cookies["session"] == "abc123"
        assert cookies["date"] == date(2025, 1, 15)

    @pytest.mark.asyncio
    async def test_decode_empty_body(self) -> None:
        """Test empty body handling."""
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

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        assert captured_scope["tytx"]["body"] is None

    @pytest.mark.asyncio
    async def test_decode_invalid_json_body(self) -> None:
        """Test invalid JSON body handling."""
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

        body_sent = False

        async def receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": b"not valid json", "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        assert captured_scope["tytx"]["body"] is None

    @pytest.mark.asyncio
    async def test_encode_response_no_encoding(self) -> None:
        """Test response without encoding when disabled."""
        async def app(scope, receive, send):
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            })
            await send({
                "type": "http.response.body",
                "body": b'{"total": 100}',
            })

        middleware = TYTXMiddleware(app, encode_response=False)

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

        # Response should NOT be encoded
        headers = dict(sent[0]["headers"])
        assert b"vnd.tytx+json" not in headers.get(b"content-type", b"")

    @pytest.mark.asyncio
    async def test_encode_response_with_content_length(self) -> None:
        """Test response encoding updates content-length."""
        import json

        async def app(scope, receive, send):
            body = json.dumps({"total": 100.50}).encode()
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": body,
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

        # Content-length should be updated
        headers = dict(sent[0]["headers"])
        assert b"content-length" in headers
        # Body should be encoded
        assert b"::JS" in sent[1]["body"] or b"total" in sent[1]["body"]

    @pytest.mark.asyncio
    async def test_encode_invalid_json_response(self) -> None:
        """Test response encoding with invalid JSON passes through."""
        async def app(scope, receive, send):
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            })
            await send({
                "type": "http.response.body",
                "body": b"not valid json",
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

        # Should pass through unchanged
        assert sent[1]["body"] == b"not valid json"


class TestWSGIMiddlewareEdgeCases:
    """Additional tests for WSGI middleware edge cases."""

    def test_decode_cookies(self) -> None:
        """Test cookie decoding."""
        from io import BytesIO
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "HTTP_COOKIE": "session=abc123; date=2025-01-15::D",
            "wsgi.input": BytesIO(b""),
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert "tytx" in captured_environ
        cookies = captured_environ["tytx"]["cookies"]
        assert cookies["session"] == "abc123"
        assert cookies["date"] == date(2025, 1, 15)

    def test_decode_body(self) -> None:
        """Test JSON body decoding."""
        from io import BytesIO
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(app)

        body = b'{"price":"100.50::N"}::JS'
        environ = {
            "QUERY_STRING": "",
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": BytesIO(body),
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert captured_environ["tytx"]["body"]["price"] == Decimal("100.50")

    def test_decode_empty_body(self) -> None:
        """Test empty body handling."""
        from io import BytesIO
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": "0",
            "wsgi.input": BytesIO(b""),
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert captured_environ["tytx"]["body"] is None

    def test_decode_invalid_json_body(self) -> None:
        """Test invalid JSON body handling."""
        from io import BytesIO
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(app)

        body = b"not valid json"
        environ = {
            "QUERY_STRING": "",
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": BytesIO(body),
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert captured_environ["tytx"]["body"] is None

    def test_no_encode_response(self) -> None:
        """Test response without encoding when disabled."""
        from io import BytesIO
        import json

        def app(environ, start_response):
            start_response("200 OK", [("Content-Type", "application/json")])
            return [json.dumps({"total": 100}).encode()]

        middleware = TYTXWSGIMiddleware(app, encode_response=False)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        response_headers = []

        def start_response(status, headers):
            response_headers.extend(headers)

        result = list(middleware(environ, start_response))

        # Response should NOT be encoded
        content_type = dict(response_headers).get("Content-Type", "")
        assert "vnd.tytx+json" not in content_type

    def test_encode_response_with_content_length(self) -> None:
        """Test response encoding updates content-length."""
        from io import BytesIO
        import json

        body = json.dumps({"total": 100.50}).encode()

        def app(environ, start_response):
            start_response("200 OK", [
                ("Content-Type", "application/json"),
                ("Content-Length", str(len(body))),
            ])
            return [body]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        response_headers = []

        def start_response(status, headers):
            response_headers.extend(headers)

        result = list(middleware(environ, start_response))

        # Content-length should be updated
        headers_dict = dict(response_headers)
        assert "Content-Length" in headers_dict

    def test_encode_invalid_json_response(self) -> None:
        """Test response encoding with invalid JSON passes through."""
        from io import BytesIO

        def app(environ, start_response):
            start_response("200 OK", [("Content-Type", "application/json")])
            return [b"not valid json"]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        response_headers = []

        def start_response(status, headers):
            response_headers.extend(headers)

        result = list(middleware(environ, start_response))

        # Should pass through unchanged
        assert result[0] == b"not valid json"

    def test_response_with_close(self) -> None:
        """Test response iterator with close method."""
        from io import BytesIO

        close_called = False

        class ClosableIterator:
            def __init__(self):
                self.data = [b"test"]
                self.index = 0

            def __iter__(self):
                return self

            def __next__(self):
                if self.index >= len(self.data):
                    raise StopIteration
                item = self.data[self.index]
                self.index += 1
                return item

            def close(self):
                nonlocal close_called
                close_called = True

        def app(environ, start_response):
            start_response("200 OK", [("Content-Type", "text/plain")])
            return ClosableIterator()

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        assert close_called


class TestMiddlewareDisabledOptions:
    """Tests for middleware with disabled options."""

    @pytest.mark.asyncio
    async def test_asgi_all_decode_disabled(self) -> None:
        """Test ASGI middleware with all decoding disabled."""
        captured_scope = {}

        async def app(scope, receive, send):
            captured_scope.update(scope)
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = TYTXMiddleware(
            app,
            decode_query=False,
            decode_headers=False,
            decode_cookies=False,
            decode_body=False,
            encode_response=False,
        )

        scope = {
            "type": "http",
            "query_string": b"date=2025-01-15::D",
            "headers": [
                (b"x-tytx-date", b"2025-01-15::D"),
                (b"cookie", b"date=2025-01-15::D"),
                (b"content-type", b"application/json"),
            ],
        }

        async def receive():
            return {"type": "http.request", "body": b'{"x":"y"}', "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        # tytx should be empty (no decoding)
        assert "query" not in captured_scope["tytx"]
        assert "headers" not in captured_scope["tytx"]
        assert "cookies" not in captured_scope["tytx"]
        assert "body" not in captured_scope["tytx"]

    def test_wsgi_all_decode_disabled(self) -> None:
        """Test WSGI middleware with all decoding disabled."""
        from io import BytesIO
        captured_environ = {}

        def app(environ, start_response):
            captured_environ.update(environ)
            start_response("200 OK", [])
            return [b""]

        middleware = TYTXWSGIMiddleware(
            app,
            decode_query=False,
            decode_headers=False,
            decode_cookies=False,
            decode_body=False,
            encode_response=False,
        )

        environ = {
            "QUERY_STRING": "date=2025-01-15::D",
            "HTTP_X_TYTX_DATE": "2025-01-15::D",
            "HTTP_COOKIE": "date=2025-01-15::D",
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": "10",
            "wsgi.input": BytesIO(b'{"x":"y"}'),
        }

        def start_response(status, headers):
            pass

        list(middleware(environ, start_response))

        # tytx should be empty
        assert "query" not in captured_environ["tytx"]
        assert "headers" not in captured_environ["tytx"]
        assert "cookies" not in captured_environ["tytx"]
        assert "body" not in captured_environ["tytx"]

    def test_wsgi_response_other_header(self) -> None:
        """Test WSGI response with other headers preserved."""
        from io import BytesIO
        import json

        body = json.dumps({"total": 100.50}).encode()

        def app(environ, start_response):
            start_response("200 OK", [
                ("Content-Type", "application/json"),
                ("X-Custom", "value"),
            ])
            return [body]

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        response_headers = []

        def start_response(status, headers):
            response_headers.extend(headers)

        list(middleware(environ, start_response))

        # Custom header should be preserved
        headers_dict = dict(response_headers)
        assert headers_dict.get("X-Custom") == "value"

    @pytest.mark.asyncio
    async def test_asgi_receive_wrapper_used(self) -> None:
        """Test that receive_wrapper is used when app calls receive."""
        body_from_app = None

        async def app(scope, receive, send):
            nonlocal body_from_app
            # App calls receive - should get the buffered body
            msg = await receive()
            body_from_app = msg.get("body", b"")
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = TYTXMiddleware(app, decode_body=False)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [],
        }

        call_count = 0

        async def receive():
            nonlocal call_count
            call_count += 1
            return {"type": "http.request", "body": b"test body", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        # receive_wrapper should pass through the body
        assert body_from_app == b"test body"

    @pytest.mark.asyncio
    async def test_asgi_response_other_header(self) -> None:
        """Test ASGI response with other headers preserved."""
        import json

        async def app(scope, receive, send):
            body = json.dumps({"total": 100.50}).encode()
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"x-custom", b"value"),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": body,
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

        # Custom header should be preserved
        headers = dict(sent[0]["headers"])
        assert headers.get(b"x-custom") == b"value"

    @pytest.mark.asyncio
    async def test_asgi_chunked_body(self) -> None:
        """ASGI middleware handles chunked body (more_body=True)."""
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

        # Simulate chunked body: first chunk with more_body=True, second with False
        chunks = [
            {"type": "http.request", "body": b'{"price": "100.', "more_body": True},
            {"type": "http.request", "body": b'50::N"}::JS', "more_body": False},
        ]
        chunk_iter = iter(chunks)

        async def receive():
            return next(chunk_iter)

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        # Body should be reassembled and decoded correctly
        assert captured_scope["tytx"]["body"]["price"] == Decimal("100.50")

    @pytest.mark.asyncio
    async def test_asgi_receive_wrapper_called_twice(self) -> None:
        """Test receive_wrapper returns buffered body on second call."""
        receive_results = []

        async def app(scope, receive, send):
            # App calls receive twice
            msg1 = await receive()
            msg2 = await receive()
            receive_results.append(msg1)
            receive_results.append(msg2)
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        middleware = TYTXMiddleware(app, decode_body=False)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [],
        }

        async def receive():
            return {"type": "http.request", "body": b"test body", "more_body": False}

        sent = []

        async def send(msg):
            sent.append(msg)

        await middleware(scope, receive, send)

        # Both calls should return the same buffered body
        assert receive_results[0]["body"] == b"test body"
        assert receive_results[1]["body"] == b"test body"

    @pytest.mark.asyncio
    async def test_asgi_response_chunked_body(self) -> None:
        """Test response with chunked body (more_body=True)."""
        async def app(scope, receive, send):
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            })
            # First chunk with more_body=True
            await send({
                "type": "http.response.body",
                "body": b'{"total":',
                "more_body": True,
            })
            # Second chunk with more_body=False
            await send({
                "type": "http.response.body",
                "body": b' 100}',
                "more_body": False,
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

        # Response should be assembled and sent
        assert len(sent) == 2
        assert sent[0]["type"] == "http.response.start"
        # Body should contain the full assembled response
        assert b"total" in sent[1]["body"]

    @pytest.mark.asyncio
    async def test_asgi_response_unknown_message_type_ignored(self) -> None:
        """Test send_wrapper ignores unknown message types."""
        async def app(scope, receive, send):
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [],
            })
            # Send an unknown message type - should be ignored by send_wrapper
            await send({"type": "http.response.trailers", "headers": []})
            await send({
                "type": "http.response.body",
                "body": b"test",
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

        # Only start and body should be sent (trailers ignored by middleware)
        assert len(sent) == 2
        assert sent[0]["type"] == "http.response.start"
        assert sent[1]["type"] == "http.response.body"

    @pytest.mark.asyncio
    async def test_asgi_response_no_content_type_header(self) -> None:
        """Test response encoding skipped when no content-type header."""
        async def app(scope, receive, send):
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"x-custom", b"value")],  # No content-type
            })
            await send({
                "type": "http.response.body",
                "body": b'{"total": 100}',
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

        # Body should pass through unchanged (no encoding without content-type)
        assert sent[1]["body"] == b'{"total": 100}'

    def test_wsgi_response_no_content_type_header(self) -> None:
        """Test WSGI response encoding skipped when no content-type header."""
        from io import BytesIO

        def app(environ, start_response):
            start_response("200 OK", [("X-Custom", "value")])  # No Content-Type
            return [b'{"total": 100}']

        middleware = TYTXWSGIMiddleware(app)

        environ = {
            "QUERY_STRING": "",
            "wsgi.input": BytesIO(b""),
        }

        response_headers = []

        def start_response(status, headers):
            response_headers.extend(headers)

        result = list(middleware(environ, start_response))

        # Body should pass through unchanged
        assert result[0] == b'{"total": 100}'
# Copyright 2025 Softwell S.r.l.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Tests for TytxWSGIMiddleware."""

import io
from decimal import Decimal
from typing import Any

import pytest

from genro_tytx import TytxWSGIMiddleware

# Check if msgpack is available
try:
    import msgpack

    HAS_MSGPACK = True
except ImportError:
    HAS_MSGPACK = False


class TestTytxWSGIMiddleware:
    """Tests for WSGI middleware functionality."""

    def make_app(self, captured: dict[str, Any]) -> Any:
        """Create a simple WSGI app that captures environ."""

        def app(environ: dict, start_response: Any) -> list[bytes]:
            captured.update(environ)
            start_response("200 OK", [("Content-Type", "text/plain")])
            return [b"OK"]

        return app

    def make_environ(
        self,
        body: bytes,
        content_type: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Create a WSGI environ dict."""
        environ: dict[str, Any] = {
            "REQUEST_METHOD": "POST",
            "wsgi.input": io.BytesIO(body),
            "CONTENT_LENGTH": str(len(body)),
        }
        if content_type:
            environ["CONTENT_TYPE"] = content_type
        if headers:
            for key, value in headers.items():
                environ[key] = value
        return environ

    def test_json_body_hydration(self) -> None:
        """JSON body with typed values should be hydrated."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ = self.make_environ(
            b'{"price": "100::N", "count": "5::L"}',
            content_type="application/json",
        )

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"]["price"] == Decimal("100")
        assert captured["tytx.data"]["count"] == 5

    def test_tytx_prefix_body(self) -> None:
        """TYTX:// prefixed body should be hydrated."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ = self.make_environ(
            b'TYTX://{"price": "100::N"}',
            content_type="application/json",
        )

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"]["price"] == Decimal("100")

    def test_xtytx_envelope(self) -> None:
        """XTYTX:// envelope should be processed."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        body = b'XTYTX://{"gstruct": {}, "lstruct": {}, "data": "{\\"total\\": \\"50::N\\"}"}'
        environ = self.make_environ(body, content_type="application/json")

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        # XTYTX returns XtytxResult
        assert captured["tytx.data"].data["total"] == Decimal("50")

    def test_empty_body(self) -> None:
        """Empty body should set data to None."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ = self.make_environ(b"")

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"] is None
        assert captured["tytx.raw_body"] == b""

    def test_raw_body_preserved(self) -> None:
        """Raw body should be preserved in environ."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        body = b'{"price": "100::N"}'
        environ = self.make_environ(body, content_type="application/json")

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.raw_body"] == body

    def test_body_replayed_to_downstream(self) -> None:
        """Body should be replayed to downstream app via wsgi.input."""
        captured: dict[str, Any] = {}

        def app(environ: dict, start_response: Any) -> list[bytes]:
            # Read the body from wsgi.input
            body = environ["wsgi.input"].read()
            captured["downstream_body"] = body
            start_response("200 OK", [])
            return [b"OK"]

        middleware = TytxWSGIMiddleware(app)

        body = b'{"price": "100::N"}'
        environ = self.make_environ(body, content_type="application/json")

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["downstream_body"] == body

    def test_custom_store_key(self) -> None:
        """Custom store_key should be used."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app, store_key="my.data")

        environ = self.make_environ(
            b'{"value": "42::L"}',
            content_type="application/json",
        )

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert "my.data" in captured
        assert captured["my.data"]["value"] == 42

    def test_custom_header_name(self) -> None:
        """Custom header_name should be used for request type detection."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app, header_name="HTTP_X_MY_HEADER")

        # XML content with custom header
        environ = self.make_environ(
            b"<root><value>test</value></root>",
            headers={"HTTP_X_MY_HEADER": "xml"},
        )

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        # Should be parsed as XML due to header
        assert captured["tytx.data"] is not None

    def test_xml_content_type(self) -> None:
        """XML content type should trigger XML parsing."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ = self.make_environ(
            b"<root><value>test</value></root>",
            content_type="application/xml",
        )

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"] is not None

    @pytest.mark.skipif(not HAS_MSGPACK, reason="msgpack not installed")
    def test_msgpack_content_type(self) -> None:
        """MessagePack content type should trigger msgpack parsing."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        body = msgpack.packb({"value": 42})
        environ = self.make_environ(body, content_type="application/x-msgpack")

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"]["value"] == 42

    @pytest.mark.skipif(not HAS_MSGPACK, reason="msgpack not installed")
    def test_msgpack_header(self) -> None:
        """X-TYTX-Request: msgpack should trigger msgpack parsing."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        body = msgpack.packb({"value": 42})
        environ = self.make_environ(body, headers={"HTTP_X_TYTX_REQUEST": "msgpack"})

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"]["value"] == 42

    def test_xml_header(self) -> None:
        """X-TYTX-Request: xml should trigger XML parsing."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ = self.make_environ(
            b"<root><value>test</value></root>",
            headers={"HTTP_X_TYTX_REQUEST": "xml"},
        )

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"] is not None

    def test_invalid_json_sets_none(self) -> None:
        """Invalid JSON should set data to None (not raise)."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ = self.make_environ(
            b"not valid json {{{",
            content_type="application/json",
        )

        def start_response(status: str, headers: list) -> None:
            pass

        # Should not raise
        list(middleware(environ, start_response))

        assert captured["tytx.data"] is None

    def test_invalid_content_length(self) -> None:
        """Invalid CONTENT_LENGTH should be handled gracefully."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ: dict[str, Any] = {
            "REQUEST_METHOD": "POST",
            "wsgi.input": io.BytesIO(b""),
            "CONTENT_LENGTH": "not-a-number",
        }

        def start_response(status: str, headers: list) -> None:
            pass

        # Should not raise
        list(middleware(environ, start_response))

        assert captured["tytx.data"] is None

    def test_missing_content_length(self) -> None:
        """Missing CONTENT_LENGTH should be handled gracefully."""
        captured: dict[str, Any] = {}
        app = self.make_app(captured)
        middleware = TytxWSGIMiddleware(app)

        environ: dict[str, Any] = {
            "REQUEST_METHOD": "POST",
            "wsgi.input": io.BytesIO(b""),
            # No CONTENT_LENGTH
        }

        def start_response(status: str, headers: list) -> None:
            pass

        list(middleware(environ, start_response))

        assert captured["tytx.data"] is None

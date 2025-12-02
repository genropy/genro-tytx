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

"""Tests for TytxASGIMiddleware."""

from decimal import Decimal
from typing import Any

import pytest

from genro_tytx import TytxASGIMiddleware


class TestTytxASGIMiddleware:
    """Tests for ASGI middleware functionality."""

    @pytest.fixture
    def captured_scope(self) -> dict[str, Any]:
        """Fixture to capture scope from middleware."""
        return {}

    def make_app(self, captured: dict[str, Any]) -> Any:
        """Create a simple ASGI app that captures scope."""

        async def app(scope: dict, receive: Any, send: Any) -> None:
            captured.update(scope)
            # Send minimal response
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [],
                }
            )
            await send({"type": "http.response.body", "body": b""})

        return app

    def make_receive(self, body: bytes) -> Any:
        """Create a receive callable that returns the body."""
        sent = False

        async def receive() -> dict[str, Any]:
            nonlocal sent
            if sent:
                return {"type": "http.request", "body": b"", "more_body": False}
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        return receive

    async def make_send(self) -> Any:
        """Create a no-op send callable."""

        async def send(message: dict[str, Any]) -> None:
            pass

        return send

    @pytest.mark.asyncio
    async def test_json_mode_detection(self, captured_scope: dict) -> None:
        """Plain JSON body should set mode to 'json'."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {
            "type": "http",
            "headers": [(b"content-type", b"application/json")],
            "query_string": b"",
        }
        body = b'{"price": "100::N"}'

        await middleware(scope, self.make_receive(body), await self.make_send())

        assert captured_scope["tytx.mode"] == "json"
        assert captured_scope["tytx.data"]["price"] == Decimal("100")

    @pytest.mark.asyncio
    async def test_tytx_mode_detection(self, captured_scope: dict) -> None:
        """TYTX:// prefix should set mode to 'tytx'."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {
            "type": "http",
            "headers": [(b"content-type", b"application/json")],
            "query_string": b"",
        }
        body = b'TYTX://{"price": "100::N"}'

        await middleware(scope, self.make_receive(body), await self.make_send())

        assert captured_scope["tytx.mode"] == "tytx"
        assert captured_scope["tytx.data"]["price"] == Decimal("100")

    @pytest.mark.asyncio
    async def test_xtytx_mode_detection(self, captured_scope: dict) -> None:
        """XTYTX:// prefix should set mode to 'xtytx'."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {
            "type": "http",
            "headers": [(b"content-type", b"application/json")],
            "query_string": b"",
        }
        # Valid XTYTX envelope with required gstruct and lstruct fields
        body = b'XTYTX://{"gstruct": {}, "lstruct": {}, "data": "{\\"total\\": \\"50::N\\"}"}'

        await middleware(scope, self.make_receive(body), await self.make_send())

        assert captured_scope["tytx.mode"] == "xtytx"
        # Check the result contains data
        assert captured_scope["tytx.data"].data["total"] == Decimal("50")

    @pytest.mark.asyncio
    async def test_empty_body_mode_none(self, captured_scope: dict) -> None:
        """Empty body should set mode to None."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {
            "type": "http",
            "headers": [],
            "query_string": b"",
        }

        await middleware(scope, self.make_receive(b""), await self.make_send())

        assert captured_scope["tytx.mode"] is None
        assert captured_scope["tytx.data"] is None

    @pytest.mark.asyncio
    async def test_query_hydration_disabled_by_default(
        self, captured_scope: dict
    ) -> None:
        """Query hydration should be disabled by default."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {
            "type": "http",
            "headers": [],
            "query_string": b"price=100::N&date=2025-01-15::D",
        }

        await middleware(scope, self.make_receive(b"{}"), await self.make_send())

        assert "tytx.query" not in captured_scope

    @pytest.mark.asyncio
    async def test_query_hydration_enabled(self, captured_scope: dict) -> None:
        """Query hydration should work when enabled."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app, hydrate_query=True)

        scope = {
            "type": "http",
            "headers": [],
            "query_string": b"price=100::N&count=5::L",
        }

        await middleware(scope, self.make_receive(b"{}"), await self.make_send())

        assert "tytx.query" in captured_scope
        assert captured_scope["tytx.query"]["price"] == Decimal("100")
        assert captured_scope["tytx.query"]["count"] == 5

    @pytest.mark.asyncio
    async def test_query_hydration_multi_value(self, captured_scope: dict) -> None:
        """Multi-value query params should be returned as lists."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app, hydrate_query=True)

        scope = {
            "type": "http",
            "headers": [],
            "query_string": b"id=1::L&id=2::L&id=3::L",
        }

        await middleware(scope, self.make_receive(b"{}"), await self.make_send())

        assert captured_scope["tytx.query"]["id"] == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_query_hydration_empty(self, captured_scope: dict) -> None:
        """Empty query string should return empty dict."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app, hydrate_query=True)

        scope = {
            "type": "http",
            "headers": [],
            "query_string": b"",
        }

        await middleware(scope, self.make_receive(b"{}"), await self.make_send())

        assert captured_scope["tytx.query"] == {}

    @pytest.mark.asyncio
    async def test_non_http_passthrough(self, captured_scope: dict) -> None:
        """Non-HTTP requests should pass through unchanged."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {"type": "websocket"}

        await middleware(scope, self.make_receive(b""), await self.make_send())

        assert "tytx.mode" not in captured_scope
        assert "tytx.data" not in captured_scope

    @pytest.mark.asyncio
    async def test_raw_body_preserved(self, captured_scope: dict) -> None:
        """Raw body should be preserved in scope."""
        app = self.make_app(captured_scope)
        middleware = TytxASGIMiddleware(app)

        scope = {
            "type": "http",
            "headers": [],
            "query_string": b"",
        }
        body = b'{"price": "100::N"}'

        await middleware(scope, self.make_receive(body), await self.make_send())

        assert captured_scope["tytx.raw_body"] == body

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

"""
Cross-Language HTTP Test Server using TytxASGIMiddleware.

This server uses the actual ASGI middleware to hydrate TYTX requests,
demonstrating real-world middleware usage for cross-language testing.

Run with: python -m tests.test_cross_middleware_server
"""

from __future__ import annotations

import asyncio
import json
from datetime import date, datetime, time as dt_time
from decimal import Decimal
from typing import Any

from genro_tytx import TytxASGIMiddleware
from genro_tytx.json_utils import as_typed_json
from genro_tytx.msgpack_utils import packb

PORT = 8767

# Test data with all TYTX types
TEST_DATA: dict[str, Any] = {
    "integer": 42,
    "float": 3.14159,
    "decimal": Decimal("99.99"),
    "string": "hello world",
    "boolean": True,
    "date": date(2025, 1, 15),
    "datetime": datetime(2025, 1, 15, 10, 30, 45),
    "time": dt_time(14, 30, 0),
    "null": None,
    "array": [1, 2, 3],
    "nested": {"x": 10, "y": 20},
}


async def app(scope: dict[str, Any], receive: Any, send: Any) -> None:
    """ASGI application that uses middleware-hydrated data."""
    if scope["type"] != "http":
        return

    path = scope.get("path", "/")
    method = scope.get("method", "GET")

    # Health check
    if path == "/health":
        await send_text(send, "ok")
        return

    # GET endpoints - serve test data
    if method == "GET":
        if path == "/json":
            await send_json(send, TEST_DATA)
            return
        if path == "/msgpack":
            await send_msgpack(send, TEST_DATA)
            return
        if path == "/text/integer":
            await send_typed_text(send, 42)
            return
        if path == "/text/decimal":
            await send_typed_text(send, Decimal("99.99"))
            return
        if path == "/text/date":
            await send_typed_text(send, date(2025, 1, 15))
            return

    # POST echo endpoints - use middleware-hydrated data
    if method == "POST":
        # Data was hydrated by TytxASGIMiddleware and stored in scope["tytx.data"]
        data = scope.get("tytx.data")
        mode = scope.get("tytx.mode")

        if path == "/echo/json" or path == "/echo":
            await send_json(send, data)
            return
        if path == "/echo/msgpack":
            await send_msgpack(send, data)
            return
        if path == "/echo/text":
            await send_typed_text(send, data)
            return

    # 404
    await send_error(send, 404, "Not found")


async def send_json(send: Any, data: Any) -> None:
    """Send JSON response with TYTX types."""
    body = as_typed_json(data).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})


async def send_msgpack(send: Any, data: Any) -> None:
    """Send msgpack response."""
    body = packb(data)
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [
            (b"content-type", b"application/x-msgpack"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})


async def send_typed_text(send: Any, value: Any) -> None:
    """Send typed text response."""
    from genro_tytx import registry
    body = registry.as_typed_text(value).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [
            (b"content-type", b"text/plain"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})


async def send_text(send: Any, text: str) -> None:
    """Send plain text response."""
    body = text.encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [
            (b"content-type", b"text/plain"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})


async def send_error(send: Any, status: int, message: str) -> None:
    """Send error response."""
    body = message.encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"content-type", b"text/plain"),
            (b"content-length", str(len(body)).encode()),
        ],
    })
    await send({"type": "http.response.body", "body": body})


# Wrap app with ASGI middleware
middleware_app = TytxASGIMiddleware(app, hydrate_query=True)


class SimpleASGIServer:
    """Simple ASGI server using asyncio for testing."""

    def __init__(self, app: Any, host: str = "127.0.0.1", port: int = PORT) -> None:
        self.app = app
        self.host = host
        self.port = port
        self.server: asyncio.Server | None = None

    async def handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        """Handle a single HTTP client connection."""
        try:
            # Read request line
            request_line = await reader.readline()
            if not request_line:
                return
            parts = request_line.decode("latin-1").strip().split(" ")
            if len(parts) < 3:
                return
            method, path, _ = parts[0], parts[1], parts[2]

            # Parse path and query string
            query_string = b""
            if "?" in path:
                path, qs = path.split("?", 1)
                query_string = qs.encode("latin-1")

            # Read headers
            headers: list[tuple[bytes, bytes]] = []
            content_length = 0
            while True:
                line = await reader.readline()
                if line in (b"\r\n", b"\n", b""):
                    break
                if b":" in line:
                    key, value = line.decode("latin-1").strip().split(":", 1)
                    headers.append((key.strip().lower().encode("latin-1"), value.strip().encode("latin-1")))
                    if key.strip().lower() == "content-length":
                        content_length = int(value.strip())

            # Read body
            body = b""
            if content_length > 0:
                body = await reader.read(content_length)

            # Build ASGI scope
            scope: dict[str, Any] = {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": method,
                "path": path,
                "query_string": query_string,
                "headers": headers,
                "server": (self.host, self.port),
            }

            # ASGI receive
            body_sent = False
            async def receive() -> dict[str, Any]:
                nonlocal body_sent
                if body_sent:
                    return {"type": "http.request", "body": b"", "more_body": False}
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}

            # ASGI send
            response_started = False
            response_body = b""
            response_status = 200
            response_headers: list[tuple[bytes, bytes]] = []

            async def send(message: dict[str, Any]) -> None:
                nonlocal response_started, response_body, response_status, response_headers
                if message["type"] == "http.response.start":
                    response_started = True
                    response_status = message.get("status", 200)
                    response_headers = message.get("headers", [])
                elif message["type"] == "http.response.body":
                    response_body += message.get("body", b"")

            # Call ASGI app
            await self.app(scope, receive, send)

            # Write response
            response = f"HTTP/1.1 {response_status} OK\r\n"
            for key, value in response_headers:
                response += f"{key.decode('latin-1')}: {value.decode('latin-1')}\r\n"
            response += "\r\n"
            writer.write(response.encode("latin-1"))
            writer.write(response_body)
            await writer.drain()

        except Exception as e:
            print(f"Error handling request: {e}")
        finally:
            writer.close()
            await writer.wait_closed()

    async def start(self) -> int:
        """Start the server and return the port."""
        self.server = await asyncio.start_server(
            self.handle_client, self.host, self.port
        )
        print(f"TYTX ASGI Middleware Test Server running on http://{self.host}:{self.port}")
        print("Endpoints:")
        print("  GET  /json        - All types as TYTX JSON")
        print("  GET  /msgpack     - All types as msgpack")
        print("  GET  /text/*      - Single typed values")
        print("  POST /echo/json   - Echo JSON (hydrated by middleware)")
        print("  POST /echo/msgpack- Echo msgpack (hydrated by middleware)")
        print("Press Ctrl+C to stop...")
        return self.port

    async def serve_forever(self) -> None:
        """Run the server forever."""
        if self.server:
            async with self.server:
                await self.server.serve_forever()

    def stop(self) -> None:
        """Stop the server."""
        if self.server:
            self.server.close()


async def main() -> None:
    """Run the server."""
    server = SimpleASGIServer(middleware_app, port=PORT)
    await server.start()
    try:
        await server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.stop()


if __name__ == "__main__":
    asyncio.run(main())

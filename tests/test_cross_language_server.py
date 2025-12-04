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
Python HTTP server for cross-language testing.

This module provides a simple HTTP server that exposes TYTX endpoints
for testing round-trip compatibility between Python and JavaScript.

Run standalone: python -m tests.test_cross_language_server
"""

from __future__ import annotations

import json
import threading
from datetime import date, datetime, time
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from genro_tytx import as_typed_json, from_json, registry
from genro_tytx.msgpack_utils import packb, unpackb
from genro_tytx.xml_utils import as_typed_xml, from_xml


def _to_xml_structure(value: Any) -> dict[str, Any]:
    """Convert a simple value to XML structure {attrs: {}, value: ...}."""
    if isinstance(value, dict):
        # Dict becomes children
        children = {}
        for k, v in value.items():
            children[k] = _to_xml_structure(v)
        return {"attrs": {}, "value": children}
    elif isinstance(value, list):
        # List becomes repeated elements
        return [_to_xml_structure(item) for item in value]
    else:
        # Scalar value
        return {"attrs": {}, "value": value}


def _from_xml_structure(value: Any) -> Any:
    """Extract values from XML structure {attrs: {}, value: ...}."""
    if isinstance(value, dict):
        if "attrs" in value and "value" in value:
            # This is an XML node
            inner = value["value"]
            if isinstance(inner, dict):
                # Children dict
                result = {}
                for k, v in inner.items():
                    result[k] = _from_xml_structure(v)
                return result
            else:
                # Scalar value
                return inner
        else:
            # Regular dict
            result = {}
            for k, v in value.items():
                result[k] = _from_xml_structure(v)
            return result
    elif isinstance(value, list):
        return [_from_xml_structure(item) for item in value]
    else:
        return value


# Test data with all TYTX types
TEST_DATA: dict[str, Any] = {
    "integer": 42,
    "float": 3.14159,
    "decimal": Decimal("99.99"),
    "string": "hello world",
    "boolean": True,
    "date": date(2025, 1, 15),
    "datetime": datetime(2025, 1, 15, 10, 30, 45),
    "time": time(14, 30, 0),
    "null": None,
    "array": [1, 2, 3],
    "nested": {"x": 10, "y": 20},
}


class TytxTestHandler(BaseHTTPRequestHandler):
    """HTTP handler for TYTX test endpoints."""

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress logging."""
        pass

    def _send_json_response(self, data: Any, typed: bool = True) -> None:
        """Send JSON response with TYTX types."""
        if typed:
            body = as_typed_json(data).encode("utf-8")
        else:
            body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_msgpack_response(self, data: Any) -> None:
        """Send msgpack response."""
        body = packb(data)
        self.send_response(200)
        self.send_header("Content-Type", "application/x-msgpack")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_xml_response(self, data: Any) -> None:
        """Send XML response with TYTX types."""
        # Convert data to XML structure recursively
        xml_data = {"root": _to_xml_structure(data)}
        body = as_typed_xml(xml_data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text_response(self, value: Any) -> None:
        """Send typed text response."""
        body = registry.as_typed_text(value).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        """Read request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(content_length)

    def do_GET(self) -> None:
        """Handle GET requests."""
        if self.path == "/json":
            self._send_json_response(TEST_DATA)
        elif self.path == "/msgpack":
            self._send_msgpack_response(TEST_DATA)
        elif self.path == "/xml":
            self._send_xml_response(TEST_DATA)
        elif self.path == "/text/integer":
            self._send_text_response(42)
        elif self.path == "/text/decimal":
            self._send_text_response(Decimal("99.99"))
        elif self.path == "/text/date":
            self._send_text_response(date(2025, 1, 15))
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        """Handle POST requests - echo back with TYTX types."""
        body = self._read_body()
        content_type = self.headers.get("Content-Type", "")

        try:
            if "msgpack" in content_type:
                data = unpackb(body)
            elif "xml" in content_type:
                data = from_xml(body.decode("utf-8"))
            elif "json" in content_type:
                data = from_json(body.decode("utf-8"))
            else:
                # Text
                data = registry.from_text(body.decode("utf-8"))
        except Exception as e:
            self.send_error(400, str(e))
            return

        # Echo back in same format
        if self.path == "/echo/json":
            self._send_json_response(data)
        elif self.path == "/echo/msgpack":
            self._send_msgpack_response(data)
        elif self.path == "/echo/xml":
            # For XML echo, we need to extract the value from the XML structure
            # from_xml returns {root: {attrs: {}, value: {...}}}
            if isinstance(data, dict) and "root" in data:
                root_val = data["root"].get("value", data["root"])
                # Extract values from the XML structure
                flat_data = _from_xml_structure(root_val)
                self._send_xml_response(flat_data)
            else:
                self._send_xml_response(data)
        elif self.path == "/echo/text":
            self._send_text_response(data)
        else:
            self._send_json_response(data)


class TytxTestServer:
    """Test server that can be started/stopped."""

    def __init__(self, port: int = 0) -> None:
        self.port = port
        self.server: HTTPServer | None = None
        self.thread: threading.Thread | None = None

    def start(self) -> int:
        """Start server and return actual port."""
        self.server = HTTPServer(("127.0.0.1", self.port), TytxTestHandler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.daemon = True
        self.thread.start()
        return self.port

    def stop(self) -> None:
        """Stop server."""
        if self.server:
            self.server.shutdown()
            self.server = None
        if self.thread:
            self.thread.join(timeout=1)
            self.thread = None

    @property
    def base_url(self) -> str:
        """Get server base URL."""
        return f"http://127.0.0.1:{self.port}"


if __name__ == "__main__":
    # Run standalone for manual testing
    server = TytxTestServer(port=8765)
    port = server.start()
    print(f"TYTX Test Server running on http://127.0.0.1:{port}")
    print("Endpoints:")
    print("  GET  /json        - All types as TYTX JSON")
    print("  GET  /msgpack     - All types as msgpack")
    print("  GET  /xml         - All types as TYTX XML")
    print("  GET  /text/*      - Single typed values")
    print("  POST /echo/json   - Echo JSON with TYTX types")
    print("  POST /echo/msgpack- Echo msgpack")
    print("Press Ctrl+C to stop...")
    try:
        while True:
            pass
    except KeyboardInterrupt:
        server.stop()
        print("\nServer stopped.")

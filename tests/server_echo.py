# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Echo server for cross-language HTTP roundtrip tests (JS → Python → JS)."""

import http.server
import socketserver
import sys
from typing import Any

from genro_tytx import to_tytx, from_tytx


def get_transport(content_type: str) -> str | None:
    """Get transport from Content-Type header."""
    if not content_type:
        return None
    ct = content_type.lower()
    if "json" in ct:
        return "json"
    if "xml" in ct:
        return "xml"
    if "msgpack" in ct:
        return "msgpack"
    return None


CONTENT_TYPES = {
    "json": "application/json",
    "xml": "application/xml",
    "msgpack": "application/msgpack",
}


class EchoHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler that echoes TYTX data through decode/encode roundtrip."""

    def do_POST(self) -> None:
        """Handle POST request."""
        if self.path == "/echo":
            self._handle_echo()
        else:
            self.send_error(404, "Not Found")

    def do_GET(self) -> None:
        """Handle GET request."""
        if self.path == "/health":
            self._send_response(b'{"status": "ok"}', "application/json")
        else:
            self.send_error(404, "Not Found")

    def _handle_echo(self) -> None:
        """Echo TYTX data through decode/encode roundtrip."""
        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", 0))

        # Read body
        body = self.rfile.read(content_length) if content_length > 0 else b""

        # Get transport
        transport = get_transport(content_type)
        if not transport:
            self.send_error(400, "Unknown Content-Type")
            return

        try:
            # Decode
            if transport == "msgpack":
                decoded = from_tytx(body, transport=transport)
            else:
                decoded = from_tytx(body.decode("utf-8"), transport=transport)

            # Encode
            encoded = to_tytx(decoded, transport=transport)

            # Send response
            if transport == "msgpack":
                self._send_response(encoded, CONTENT_TYPES[transport])
            else:
                self._send_response(encoded.encode("utf-8"), CONTENT_TYPES[transport])

        except Exception as e:
            self.send_error(500, str(e))

    def _send_response(self, body: bytes, content_type: str) -> None:
        """Send HTTP response."""
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress logging."""
        pass


def run_server(port: int = 3457) -> None:
    """Run the echo server."""
    with socketserver.TCPServer(("", port), EchoHandler) as httpd:
        print(f"Echo server listening on port {port}")
        httpd.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3457
    run_server(port)

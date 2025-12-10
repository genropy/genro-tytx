# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
End-to-End Tests for TYTX HTTP Integration (Python Client).

Tests real HTTP communication between Python client and ASGI/WSGI servers.
"""

import asyncio
import json
import multiprocessing
import socket
import time
import urllib.request
import urllib.parse
from datetime import date, datetime, time as dt_time, timezone
from decimal import Decimal
from typing import Any

import pytest

from genro_tytx import to_tytx, from_tytx

# Helper functions to replace missing library exports

def encode_query_string(params: dict) -> str:
    """Encode params to query string with TYTX suffixes."""
    encoded = {}
    for k, v in params.items():
        val = to_tytx(v)
        # Remove quotes added by JSON encoding for query params
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        encoded[k] = val
    return urllib.parse.urlencode(encoded)

def encode_body(data: dict, format="json") -> str:
    return to_tytx(data, transport=format)

def decode_body(body: str, content_type: str = "") -> Any:
    return from_tytx(body)


def find_free_port() -> int:
    """Find a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for_server(host: str, port: int, timeout: float = 5.0) -> bool:
    """Wait for server to be ready."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.1)
    return False


def run_asgi_server(port: int) -> None:
    """Run ASGI server in a subprocess."""
    import uvicorn
    from server_asgi import app as asgi_app
    
    # We need to run uvicorn with the app object directly
    # Since we can't pass 'server_asgi:app' string easily if paths are weird,
    # we use the object.
    config = uvicorn.Config(asgi_app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    asyncio.run(server.serve())


class HTTPClient:
    """Simple HTTP client for testing."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def get(self, path: str, query: dict[str, Any] | None = None) -> dict[str, Any]:
        """Make GET request with TYTX query string."""
        url = f"{self.base_url}{path}"
        if query:
            qs = encode_query_string(query)
            url = f"{url}?{qs}"

        req = urllib.request.Request(url)
        req.add_header("Accept", "application/vnd.tytx+json")

        with urllib.request.urlopen(req) as response:
            content_type = response.headers.get("Content-Type", "")
            body = response.read().decode("utf-8")
            return decode_body(body, content_type=content_type)

    def post(
        self,
        path: str,
        data: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Make POST request with TYTX body."""
        url = f"{self.base_url}{path}"
        body = encode_body(data, format="json")
        if isinstance(body, str):
            body = body.encode("utf-8")

        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", "application/vnd.tytx+json")
        req.add_header("Accept", "application/vnd.tytx+json")

        if headers:
            for key, value in headers.items():
                req.add_header(key, value)

        with urllib.request.urlopen(req) as response:
            content_type = response.headers.get("Content-Type", "")
            body = response.read().decode("utf-8")
            return decode_body(body, content_type=content_type)


@pytest.fixture(scope="module")
def asgi_server():
    """Start ASGI server for tests."""
    port = find_free_port()
    process = multiprocessing.Process(target=run_asgi_server, args=(port,))
    process.start()

    if not wait_for_server("127.0.0.1", port):
        process.terminate()
        pytest.skip("ASGI server failed to start (uvicorn not installed?)")

    yield f"http://127.0.0.1:{port}"

    process.terminate()
    process.join(timeout=2)


class TestASGIServer:
    """End-to-end tests with ASGI server."""

    def test_health(self, asgi_server: str) -> None:
        """Test health endpoint."""
        client = HTTPClient(asgi_server)
        result = client.get("/health")
        assert result["status"] == "ok"

    def test_get_types(self, asgi_server: str) -> None:
        """Test receiving typed values from server."""
        client = HTTPClient(asgi_server)
        result = client.get("/types")

        assert isinstance(result["decimal"], Decimal)
        assert result["decimal"] == Decimal("123.456")

        assert isinstance(result["date"], date)
        assert result["date"] == date(2025, 6, 15)

        assert isinstance(result["datetime"], datetime)
        assert result["datetime"].year == 2025
        assert result["datetime"].month == 6

        assert isinstance(result["time"], dt_time)
        assert result["time"].hour == 14
        assert result["time"].minute == 45

        assert result["string"] == "hello"
        assert result["integer"] == 42
        assert result["boolean"] is True
        assert result["null"] is None

    def test_query_string_date(self, asgi_server: str) -> None:
        """Test sending date in query string."""
        client = HTTPClient(asgi_server)
        result = client.get("/echo", query={"date": date(2025, 1, 15)})

        query_data = result["query"]
        assert query_data["date"]["_type"] == "date"
        assert query_data["date"]["value"] == "2025-01-15"

    def test_query_string_decimal(self, asgi_server: str) -> None:
        """Test sending Decimal in query string."""
        client = HTTPClient(asgi_server)
        result = client.get("/echo", query={"price": Decimal("99.99")})

        query_data = result["query"]
        assert query_data["price"]["_type"] == "Decimal"
        assert query_data["price"]["value"] == "99.99"

    def test_query_string_mixed(self, asgi_server: str) -> None:
        """Test sending mixed types in query string."""
        client = HTTPClient(asgi_server)
        result = client.get("/echo", query={
            "date": date(2025, 3, 20),
            "price": Decimal("150.00"),
            "limit": 10,
            "name": "test",
        })

        query_data = result["query"]
        assert query_data["date"]["_type"] == "date"
        assert query_data["price"]["_type"] == "Decimal"
        assert query_data["limit"] == 10  # Plain values parsed as int correctly
        # Wait, int gets 'L' suffix? No, JSON native.
        # to_tytx(10) -> "10". 
        # So "limit": "10" in query string.
        # But _decode_qs logic parses it if it looks like TYTX?
        # to_tytx(10) is just "10".
        # _decode_qs parses it. But "10" is not "10::L".
        # So it remains string "10". Correct.
        assert query_data["name"] == "test"

    def test_post_body_types(self, asgi_server: str) -> None:
        """Test sending typed values in POST body."""
        client = HTTPClient(asgi_server)
        result = client.post("/echo", data={
            "price": Decimal("100.50"),
            "date": date(2025, 6, 15),
            "datetime": datetime(2025, 6, 15, 10, 30, tzinfo=timezone.utc),
        })

        body_data = result["body"]
        assert body_data["price"]["_type"] == "Decimal"
        assert body_data["price"]["value"] == "100.50"
        assert body_data["date"]["_type"] == "date"
        assert body_data["datetime"]["_type"] == "datetime"

    def test_compute_with_decimals(self, asgi_server: str) -> None:
        """Test server computation with Decimal values."""
        client = HTTPClient(asgi_server)
        result = client.post("/compute", data={
            "price": Decimal("100.00"),
            "quantity": 5,
            "tax_rate": Decimal("0.22"),
        })

        assert isinstance(result["subtotal"], Decimal)
        assert result["subtotal"] == Decimal("500.00")

        assert isinstance(result["tax"], Decimal)
        assert result["tax"] == Decimal("110.00")

        assert isinstance(result["total"], Decimal)
        assert result["total"] == Decimal("610.00")

        assert isinstance(result["computed_at"], datetime)

    def test_roundtrip_all_types(self, asgi_server: str) -> None:
        """Test complete roundtrip of all supported types."""
        client = HTTPClient(asgi_server)

        # Send typed values, server echoes them back (as serialized JSON with _type)
        # Wait, the /echo endpoint returns special format: {"_type":...}
        # It doesn't return TYTX encoded body directly for the *values*.
        # It returns a JSON structure DESCRIBING the values.
        # So we verify the description.
        
        original = {
            "decimal": Decimal("999.123456"),
            "date": date(2025, 12, 31),
            "datetime": datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
            "time": dt_time(12, 30, 45),
        }

        result = client.post("/echo", data=original)
        body_data = result["body"]

        # Verify types were correctly transmitted
        assert body_data["decimal"]["value"] == "999.123456"
        assert body_data["date"]["value"] == "2025-12-31"
        assert "2025-12-31" in body_data["datetime"]["value"]
        assert body_data["time"]["value"] == "12:30:45"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

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
Cross-Language HTTP Round-Trip Tests using ASGI Middleware.

These tests verify TYTX compatibility between Python and JavaScript
using a Python server with TytxASGIMiddleware.

Run with: CROSS_LANG=1 pytest tests/test_cross_middleware.py -v
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pytest
import urllib.request
import urllib.error

from genro_tytx import from_json, registry
from genro_tytx.http_utils import fetch_typed, fetch_typed_request

# Skip all tests if CROSS_LANG env var is not set
pytestmark = pytest.mark.skipif(
    not os.environ.get("CROSS_LANG"), reason="CROSS_LANG not set"
)

# Server configuration - using ASGI middleware server
JS_SERVER_PORT = 8766  # JS server
MIDDLEWARE_SERVER_PORT = 8767  # Python ASGI middleware server
JS_BASE_URL = f"http://127.0.0.1:{JS_SERVER_PORT}"
MIDDLEWARE_BASE_URL = f"http://127.0.0.1:{MIDDLEWARE_SERVER_PORT}"

# Server process reference
_server_process: subprocess.Popen[bytes] | None = None


def start_middleware_server() -> None:
    """Start the Python ASGI middleware test server."""
    global _server_process
    if _server_process is not None:
        return

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    _server_process = subprocess.Popen(
        ["python", "-m", "tests.test_cross_middleware_server"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=project_root,
    )

    # Wait for server to start
    for _ in range(20):
        try:
            with urllib.request.urlopen(f"{MIDDLEWARE_BASE_URL}/health", timeout=1) as resp:
                if resp.read() == b"ok":
                    return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.25)

    stop_middleware_server()
    raise RuntimeError("ASGI middleware server failed to start")


def stop_middleware_server() -> None:
    """Stop the ASGI middleware test server."""
    global _server_process
    if _server_process is not None:
        _server_process.terminate()
        _server_process.wait(timeout=5)
        _server_process = None


def wait_for_server(url: str) -> bool:
    """Check if server is available."""
    for _ in range(20):
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=1) as resp:
                if resp.read() == b"ok":
                    return True
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.25)
    return False


@pytest.fixture(scope="module", autouse=True)
def middleware_server():
    """Start middleware server for the test module."""
    try:
        start_middleware_server()
    except RuntimeError:
        # Server may already be running externally
        if not wait_for_server(MIDDLEWARE_BASE_URL):
            pytest.skip(f"ASGI middleware server not available at {MIDDLEWARE_BASE_URL}")
    yield
    stop_middleware_server()


# =============================================================================
# JS → Python Middleware → Python: Test that middleware hydrates correctly
# =============================================================================


class TestJSToMiddlewareRoundtrip:
    """Test JS sends to Python middleware, middleware hydrates, response back."""

    def test_echo_integer_via_middleware(self) -> None:
        """JS sends integer, middleware hydrates, echoes back."""
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/json",
            body={"value": 12345},
            send_as="json",
            expect="json",
        )
        assert result["value"] == 12345

    def test_echo_decimal_via_middleware(self) -> None:
        """JS sends decimal, middleware hydrates correctly."""
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/json",
            body={"value": Decimal("99.99")},
            send_as="json",
            expect="json",
        )
        assert abs(float(result["value"]) - 99.99) < 0.01

    def test_echo_date_via_middleware(self) -> None:
        """Middleware hydrates date correctly."""
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/json",
            body={"created": date(2025, 1, 15)},
            send_as="json",
            expect="json",
        )
        assert isinstance(result["created"], date)
        assert result["created"].year == 2025

    def test_echo_datetime_via_middleware(self) -> None:
        """Middleware hydrates datetime correctly."""
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/json",
            body={"timestamp": datetime(2025, 6, 15, 14, 30, 45)},
            send_as="json",
            expect="json",
        )
        assert isinstance(result["timestamp"], datetime)
        assert result["timestamp"].hour == 14

    def test_echo_nested_via_middleware(self) -> None:
        """Middleware hydrates nested objects correctly."""
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/json",
            body={"user": {"id": 123, "name": "test"}},
            send_as="json",
            expect="json",
        )
        assert result["user"]["id"] == 123
        assert result["user"]["name"] == "test"

    def test_echo_msgpack_via_middleware(self) -> None:
        """Middleware hydrates msgpack correctly."""
        input_data: dict[str, Any] = {
            "id": 456,
            "value": 3.14,
            "timestamp": datetime(2025, 6, 1, 12, 0, 0),
        }
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/msgpack",
            body=input_data,
            send_as="msgpack",
            expect="msgpack",
        )
        assert result["id"] == 456
        assert abs(result["value"] - 3.14) < 0.01
        assert isinstance(result["timestamp"], datetime)

    def test_get_json_from_middleware(self) -> None:
        """GET JSON from middleware server."""
        result = fetch_typed(f"{MIDDLEWARE_BASE_URL}/json")
        assert result["integer"] == 42
        assert isinstance(result["date"], date)
        assert isinstance(result["datetime"], datetime)

    def test_get_typed_text_from_middleware(self) -> None:
        """GET typed text from middleware server."""
        result = fetch_typed(f"{MIDDLEWARE_BASE_URL}/text/integer")
        assert result == 42

    def test_complex_roundtrip_via_middleware(self) -> None:
        """Complex data roundtrip through middleware."""
        input_data: dict[str, Any] = {
            "id": 999,
            "price": Decimal("149.99"),
            "created": datetime(2025, 3, 20, 8, 15, 30),
            "active": True,
            "tags": ["premium", "featured"],
            "details": {"weight": 2.5, "dimensions": {"width": 10, "height": 20}},
        }
        result = fetch_typed_request(
            f"{MIDDLEWARE_BASE_URL}/echo/json",
            body=input_data,
            send_as="json",
            expect="json",
        )

        assert result["id"] == 999
        assert abs(float(result["price"]) - 149.99) < 0.01
        assert isinstance(result["created"], datetime)
        assert result["active"] is True
        assert result["tags"] == ["premium", "featured"]
        assert result["details"]["dimensions"]["width"] == 10

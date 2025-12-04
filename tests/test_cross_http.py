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
Cross-Language HTTP Round-Trip Tests.

These tests verify TYTX compatibility between Python and JavaScript
by making HTTP requests to a JavaScript test server.

Run with: CROSS_LANG=1 pytest tests/test_cross_http.py -v
"""

from __future__ import annotations

import os
import subprocess
import time
from datetime import date, datetime, time as dt_time
from decimal import Decimal
from typing import Any

import pytest
import urllib.request
import urllib.error

from genro_tytx import from_json, registry
from genro_tytx.http_utils import fetch_typed, fetch_typed_request
from genro_tytx.msgpack_utils import unpackb


def _extract_xml_values(data: Any) -> Any:
    """
    Extract values from XML structure {attrs: {}, value: ...}.

    XML parsing returns nested dicts with 'attrs' and 'value' keys.
    This function flattens it to get the actual data values.
    """
    if data is None:
        return None
    if isinstance(data, list):
        return [_extract_xml_values(item) for item in data]
    if isinstance(data, dict):
        if "attrs" in data and "value" in data:
            inner = data["value"]
            if inner is None:
                return None
            if isinstance(inner, dict):
                # Check if it's another XML node or actual data
                if "attrs" in inner and "value" in inner:
                    return _extract_xml_values(inner)
                # It's children - extract recursively
                return {k: _extract_xml_values(v) for k, v in inner.items()}
            return inner
        return {k: _extract_xml_values(v) for k, v in data.items()}
    return data


# Skip all tests if CROSS_LANG env var is not set
pytestmark = pytest.mark.skipif(
    not os.environ.get("CROSS_LANG"), reason="CROSS_LANG not set"
)

# Server configuration
JS_SERVER_PORT = 8766
JS_BASE_URL = f"http://127.0.0.1:{JS_SERVER_PORT}"

# Server process reference
_server_process: subprocess.Popen[bytes] | None = None


def start_js_server() -> None:
    """Start the JavaScript test server."""
    global _server_process
    if _server_process is not None:
        return

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    server_path = os.path.join(project_root, "js", "test", "server.js")

    _server_process = subprocess.Popen(
        ["node", server_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=project_root,
        env={**os.environ, "PORT": str(JS_SERVER_PORT)},
    )

    # Wait for server to start
    for _ in range(20):
        try:
            with urllib.request.urlopen(f"{JS_BASE_URL}/health", timeout=1) as resp:
                if resp.read() == b"ok":
                    return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.25)

    stop_js_server()
    raise RuntimeError("JavaScript server failed to start")


def stop_js_server() -> None:
    """Stop the JavaScript test server."""
    global _server_process
    if _server_process is not None:
        _server_process.terminate()
        _server_process.wait(timeout=5)
        _server_process = None


def wait_for_server() -> bool:
    """Check if server is available."""
    for _ in range(20):
        try:
            with urllib.request.urlopen(f"{JS_BASE_URL}/health", timeout=1) as resp:
                if resp.read() == b"ok":
                    return True
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.25)
    return False


@pytest.fixture(scope="module", autouse=True)
def js_server():
    """Start JS server for the test module."""
    try:
        start_js_server()
    except RuntimeError:
        # Server may already be running externally
        if not wait_for_server():
            pytest.skip(f"JavaScript server not available at {JS_BASE_URL}")
    yield
    stop_js_server()


# =============================================================================
# JS → Python: GET JSON endpoint
# =============================================================================


class TestJSServesPythonReceivesJSON:
    """Test JS serves JSON, Python receives and hydrates."""

    def test_hydrates_integer(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert result["integer"] == 42
        assert isinstance(result["integer"], int)

    def test_hydrates_float(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert abs(result["float"] - 3.14159) < 0.0001

    def test_hydrates_string(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert result["string"] == "hello world"

    def test_hydrates_boolean(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert result["boolean"] is True

    def test_hydrates_date(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert isinstance(result["date"], date)
        assert result["date"].year == 2025
        assert result["date"].month == 1
        assert result["date"].day == 15

    def test_hydrates_datetime(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert isinstance(result["datetime"], datetime)
        assert result["datetime"].hour == 10
        assert result["datetime"].minute == 30

    def test_hydrates_null(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert result["null"] is None

    def test_hydrates_array(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert result["array"] == [1, 2, 3]

    def test_hydrates_nested(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/json")
        assert result["nested"]["x"] == 10
        assert result["nested"]["y"] == 20


# =============================================================================
# JS → Python: GET msgpack endpoint
# =============================================================================


class TestJSServesPythonReceivesMsgpack:
    """Test JS serves msgpack, Python receives and hydrates."""

    def test_msgpack_hydrates_integer(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert result["integer"] == 42
        assert isinstance(result["integer"], int)

    def test_msgpack_hydrates_float(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert abs(result["float"] - 3.14159) < 0.0001

    def test_msgpack_hydrates_string(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert result["string"] == "hello world"

    def test_msgpack_hydrates_boolean(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert result["boolean"] is True

    def test_msgpack_hydrates_date(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert isinstance(result["date"], date)
        assert result["date"].year == 2025
        assert result["date"].month == 1
        assert result["date"].day == 15

    def test_msgpack_hydrates_datetime(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert isinstance(result["datetime"], datetime)
        assert result["datetime"].hour == 10
        assert result["datetime"].minute == 30

    def test_msgpack_hydrates_null(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert result["null"] is None

    def test_msgpack_hydrates_array(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert result["array"] == [1, 2, 3]

    def test_msgpack_hydrates_nested(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/msgpack")
        assert result["nested"]["x"] == 10
        assert result["nested"]["y"] == 20


# =============================================================================
# JS → Python: GET typed text endpoints
# =============================================================================


class TestJSServesPythonReceivesText:
    """Test JS serves typed text, Python receives and hydrates."""

    def test_typed_integer(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/text/integer")
        assert result == 42
        assert isinstance(result, int)

    def test_typed_decimal(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/text/decimal")
        # JS sends float, Python receives as Decimal or float
        assert abs(float(result) - 99.99) < 0.01

    def test_typed_date(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/text/date")
        assert isinstance(result, date)
        assert result.year == 2025
        assert result.month == 1
        assert result.day == 15


# =============================================================================
# Python → JS → Python: POST echo JSON
# =============================================================================


class TestPythonJSPythonJSONEcho:
    """Test Python sends, JS echoes, Python receives - JSON format."""

    def test_roundtrip_integer(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"value": 12345},
            send_as="json",
            expect="json",
        )
        assert result["value"] == 12345

    def test_roundtrip_float(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"value": 3.14159},
            send_as="json",
            expect="json",
        )
        assert abs(result["value"] - 3.14159) < 0.0001

    def test_roundtrip_decimal(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"value": Decimal("99.99")},
            send_as="json",
            expect="json",
        )
        # JS returns as number, Python receives as Decimal
        assert abs(float(result["value"]) - 99.99) < 0.01

    def test_roundtrip_boolean(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"active": True, "disabled": False},
            send_as="json",
            expect="json",
        )
        assert result["active"] is True
        assert result["disabled"] is False

    def test_roundtrip_date(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"created": date(2025, 1, 15)},
            send_as="json",
            expect="json",
        )
        assert isinstance(result["created"], date)
        assert result["created"].year == 2025
        assert result["created"].month == 1
        assert result["created"].day == 15

    def test_roundtrip_datetime(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"timestamp": datetime(2025, 6, 15, 14, 30, 45)},
            send_as="json",
            expect="json",
        )
        assert isinstance(result["timestamp"], datetime)
        assert result["timestamp"].hour == 14
        assert result["timestamp"].minute == 30

    def test_roundtrip_array(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"items": [1, 2, 3, 4, 5]},
            send_as="json",
            expect="json",
        )
        assert result["items"] == [1, 2, 3, 4, 5]

    def test_roundtrip_nested(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body={"user": {"id": 123, "name": "test", "meta": {"role": "admin"}}},
            send_as="json",
            expect="json",
        )
        assert result["user"]["id"] == 123
        assert result["user"]["name"] == "test"
        assert result["user"]["meta"]["role"] == "admin"

    def test_roundtrip_complex(self) -> None:
        input_data: dict[str, Any] = {
            "id": 999,
            "price": Decimal("149.99"),
            "created": datetime(2025, 3, 20, 8, 15, 30),
            "active": True,
            "tags": ["premium", "featured"],
            "details": {"weight": 2.5, "dimensions": {"width": 10, "height": 20}},
        }
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/json",
            body=input_data,
            send_as="json",
            expect="json",
        )

        assert result["id"] == 999
        assert abs(float(result["price"]) - 149.99) < 0.01
        assert isinstance(result["created"], datetime)
        assert result["active"] is True
        assert result["tags"] == ["premium", "featured"]
        assert abs(result["details"]["weight"] - 2.5) < 0.01
        assert result["details"]["dimensions"]["width"] == 10


# =============================================================================
# Python → JS → Python: POST echo msgpack
# =============================================================================


class TestPythonJSPythonMsgpackEcho:
    """Test Python sends, JS echoes, Python receives - msgpack format."""

    def test_msgpack_roundtrip_integer(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"value": 12345},
            send_as="msgpack",
            expect="msgpack",
        )
        assert result["value"] == 12345

    def test_msgpack_roundtrip_float(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"value": 3.14159},
            send_as="msgpack",
            expect="msgpack",
        )
        assert abs(result["value"] - 3.14159) < 0.0001

    def test_msgpack_roundtrip_boolean(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"active": True, "disabled": False},
            send_as="msgpack",
            expect="msgpack",
        )
        assert result["active"] is True
        assert result["disabled"] is False

    def test_msgpack_roundtrip_date(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"created": date(2025, 1, 15)},
            send_as="msgpack",
            expect="msgpack",
        )
        assert isinstance(result["created"], date)
        assert result["created"].year == 2025
        assert result["created"].month == 1
        assert result["created"].day == 15

    def test_msgpack_roundtrip_datetime(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"timestamp": datetime(2025, 6, 15, 14, 30, 45)},
            send_as="msgpack",
            expect="msgpack",
        )
        assert isinstance(result["timestamp"], datetime)
        assert result["timestamp"].hour == 14
        assert result["timestamp"].minute == 30

    def test_msgpack_roundtrip_array(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"items": [1, 2, 3, 4, 5]},
            send_as="msgpack",
            expect="msgpack",
        )
        assert result["items"] == [1, 2, 3, 4, 5]

    def test_msgpack_roundtrip_nested(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body={"user": {"id": 123, "name": "test", "meta": {"role": "admin"}}},
            send_as="msgpack",
            expect="msgpack",
        )
        assert result["user"]["id"] == 123
        assert result["user"]["name"] == "test"
        assert result["user"]["meta"]["role"] == "admin"

    def test_msgpack_roundtrip_complex(self) -> None:
        input_data: dict[str, Any] = {
            "id": 999,
            "price": 149.99,
            "created": datetime(2025, 3, 20, 8, 15, 30),
            "active": True,
            "tags": ["premium", "featured"],
            "details": {"weight": 2.5, "dimensions": {"width": 10, "height": 20}},
        }
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/msgpack",
            body=input_data,
            send_as="msgpack",
            expect="msgpack",
        )

        assert result["id"] == 999
        assert abs(result["price"] - 149.99) < 0.01
        assert isinstance(result["created"], datetime)
        assert result["active"] is True
        assert result["tags"] == ["premium", "featured"]
        assert abs(result["details"]["weight"] - 2.5) < 0.01
        assert result["details"]["dimensions"]["width"] == 10


# =============================================================================
# JS → Python: GET XML endpoint
# =============================================================================


class TestJSServesPythonReceivesXML:
    """Test JS serves XML, Python receives and hydrates."""

    def test_xml_hydrates_integer(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        # XML returns nested structure with attrs/value - flatten it
        data = _extract_xml_values(result.get("root", result))
        assert data["integer"] == 42
        assert isinstance(data["integer"], int)

    def test_xml_hydrates_float(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert abs(data["float"] - 3.14159) < 0.0001

    def test_xml_hydrates_string(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert data["string"] == "hello world"

    def test_xml_hydrates_boolean(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert data["boolean"] is True

    def test_xml_hydrates_date(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert isinstance(data["date"], date)
        assert data["date"].year == 2025
        assert data["date"].month == 1
        assert data["date"].day == 15

    def test_xml_hydrates_datetime(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert isinstance(data["datetime"], datetime)
        assert data["datetime"].hour == 10
        assert data["datetime"].minute == 30

    def test_xml_hydrates_null(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert data["null"] is None

    def test_xml_hydrates_array(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert data["array"] == [1, 2, 3]

    def test_xml_hydrates_nested(self) -> None:
        result = fetch_typed(f"{JS_BASE_URL}/xml")
        data = _extract_xml_values(result.get("root", result))
        assert data["nested"]["x"] == 10
        assert data["nested"]["y"] == 20


# =============================================================================
# Python → JS → Python: POST echo XML
# =============================================================================


class TestPythonJSPythonXMLEcho:
    """Test Python sends, JS echoes, Python receives - XML format."""

    def test_xml_roundtrip_integer(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"value": 12345},
            send_as="json",  # Send as JSON, server converts to XML
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert data["value"] == 12345

    def test_xml_roundtrip_float(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"value": 3.14159},
            send_as="json",
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert abs(data["value"] - 3.14159) < 0.0001

    def test_xml_roundtrip_boolean(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"active": True, "disabled": False},
            send_as="json",
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert data["active"] is True
        assert data["disabled"] is False

    def test_xml_roundtrip_date(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"created": date(2025, 1, 15)},
            send_as="json",
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert isinstance(data["created"], date)
        assert data["created"].year == 2025
        assert data["created"].month == 1
        assert data["created"].day == 15

    def test_xml_roundtrip_datetime(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"timestamp": datetime(2025, 6, 15, 14, 30, 45)},
            send_as="json",
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert isinstance(data["timestamp"], datetime)
        assert data["timestamp"].hour == 14
        assert data["timestamp"].minute == 30

    def test_xml_roundtrip_array(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"items": [1, 2, 3, 4, 5]},
            send_as="json",
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert data["items"] == [1, 2, 3, 4, 5]

    def test_xml_roundtrip_nested(self) -> None:
        result = fetch_typed_request(
            f"{JS_BASE_URL}/echo/xml",
            body={"user": {"id": 123, "name": "test"}},
            send_as="json",
            expect="xml",
        )
        data = _extract_xml_values(result.get("root", result))
        assert data["user"]["id"] == 123
        assert data["user"]["name"] == "test"

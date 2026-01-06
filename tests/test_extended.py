# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Extended roundtrip tests for all TYTX transports and types."""

import subprocess
import time as time_module
import urllib.error
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from genro_tytx import to_tytx, from_tytx
from genro_tytx import encode as encode_module
from genro_tytx.utils import tytx_equivalent


TRANSPORTS = [None, "json", "msgpack", "xml"]

DATASETS = [
    (1, None),
    ("alfa", None),
    (True, None),
    (False, None),
    (None, None),
    (3.14, None),
    (0, None),
    ("", None),
    ("hello world", None),
    (Decimal("100.50"), None),
    (Decimal("0"), None),
    (Decimal("-999.99"), None),
    (date(2025, 1, 15), None),
    (datetime(2025, 1, 15, 10, 30, 0), None),
    (time(10, 30, 0), None),
    ([1, 2, 3], None),
    ({"a": 1, "b": 2}, None),
    ([1, "alfa", True, None], None),
    ({"a": True, "b": 23, "c": "hello"}, None),
    ([[1, 2], [3, 4]], None),
    ({"nested": {"a": 1, "b": 2}}, None),
    ([None, None, None], None),
    ({"a": None, "b": None}, None),
    (["", "", ""], None),
    ({"a": "", "b": ""}, None),
    ([1, None, "", True], None),
    ({"a": 1, "b": None, "c": "", "d": True}, None),
    ([[[1, 2], [3, 4]], [[5, 6], [7, 8]]], None),
    ({"l1": {"l2": {"l3": {"l4": 42}}}}, None),
    ([{"a": [1, 2]}, {"b": [3, 4]}], None),
    ({"x": [{"y": 1}, {"y": 2}]}, None),
    ([1, Decimal("10.50"), date(2025, 1, 15)], None),
    ({"price": Decimal("100.50"), "date": date(2025, 1, 15)}, None),
    ([{"price": Decimal("10.00")}, {"price": Decimal("20.00")}], None),
    ({"items": [Decimal("1.1"), Decimal("2.2"), Decimal("3.3")]}, None),
    (
        {
            "order": {
                "total": Decimal("999.99"),
                "created": datetime(2025, 1, 15, 10, 30),
            }
        },
        None,
    ),
    ([Decimal("10.50"), None, "", date(2025, 1, 15)], None),
    (
        {
            "price": Decimal("100.50"),
            "empty": None,
            "text": "",
            "date": date(2025, 1, 15),
        },
        None,
    ),
    ([[Decimal("1.1"), Decimal("2.2")], [Decimal("3.3"), Decimal("4.4")]], None),
    ({"l1": {"l2": {"amount": Decimal("999.99"), "date": date(2025, 6, 15)}}}, None),
    (
        [
            {"dt": datetime(2025, 1, 1, 0, 0, 0, 1000)},
            {"dt": datetime(2025, 12, 31, 23, 59, 0, 1000)},
        ],
        None,
    ),
    ({"times": [time(8, 0), time(12, 30), time(18, 0)]}, None),
    ({"info": {"amount": Decimal("100"), "empty": None, "text": ""}}, None),
    ([{"a": None, "b": Decimal("1")}, {"a": "", "b": date(2025, 1, 1)}], None),
    ({"outer": {"inner": [None, "", Decimal("0"), date(2025, 1, 1)]}}, None),
    # XML-only (attrs/value structure)
    ({"root": {"attrs": {}, "value": "text"}}, ["xml"]),
    ({"root": {"attrs": {"id": 123}, "value": None}}, ["xml"]),
    ({"root": {"attrs": {"price": Decimal("100.50")}, "value": "content"}}, ["xml"]),
    ({"root": {"attrs": {"date": date(2025, 1, 15)}, "value": 42}}, ["xml"]),
    (
        {
            "order": {
                "attrs": {"id": 1},
                "value": {"item": {"attrs": {}, "value": "apple"}},
            }
        },
        ["xml"],
    ),
    (
        {
            "root": {
                "attrs": {},
                "value": {"child": {"attrs": {"x": 1}, "value": Decimal("99.99")}},
            }
        },
        ["xml"],
    ),
    (
        {
            "data": {
                "attrs": {"created": datetime(2025, 1, 15, 10, 30)},
                "value": {"name": {"attrs": {}, "value": "test"}},
            }
        },
        ["xml"],
    ),
    # Aware datetime (with timezone) - covers _serialize_datetime aware branch
    (datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc), None),
    ({"dt": datetime(2025, 6, 15, 14, 30, tzinfo=timezone.utc)}, None),
    # Aware datetime with non-UTC timezone - covers datetime_equivalent aware branch
    (datetime(2025, 1, 15, 11, 30, tzinfo=timezone(timedelta(hours=1))), None),
    # XML with bool/float attrs - covers _serialize_bool, _serialize_float via force_suffix
    ({"root": {"attrs": {"active": True, "rate": 3.14}, "value": "data"}}, ["xml"]),
    ({"root": {"attrs": {"disabled": False, "score": 0.0}, "value": 123}}, ["xml"]),
    # XML with multiple children - covers list serialization/deserialization
    (
        {
            "root": {
                "attrs": {},
                "value": [
                    {"item": {"attrs": {}, "value": "a"}},
                    {"item": {"attrs": {}, "value": "b"}},
                ],
            }
        },
        ["xml"],
    ),
    # XML with scalar list value - covers else branch in list serialization
    ({"root": {"attrs": {}, "value": [1, 2, 3]}}, ["xml"]),
]


def dataset_iterator():
    """Yield all valid test case combinations as (value, transport, use_orjson)."""
    for value, transports in DATASETS:
        valid_transports = transports if transports else TRANSPORTS
        for transport in valid_transports:
            for use_orjson in [False, True]:
                yield value, transport, use_orjson


def run_tests():
    """Run all roundtrip tests and return failures."""
    fails = {}

    for value, transport, use_orjson in dataset_iterator():
        encode_module.USE_ORJSON = use_orjson and encode_module.HAS_ORJSON
        try:
            txt = to_tytx(value, transport=transport)
            nv = from_tytx(txt, transport=transport, use_orjson=use_orjson)
            if not tytx_equivalent(value, nv):
                fails[(use_orjson, transport)] = (value, txt, nv)
        except Exception as e:
            fails[(use_orjson, transport)] = (value, None, str(e))

    # Restore default
    encode_module.USE_ORJSON = encode_module.HAS_ORJSON
    return fails


class TestExtendedRoundtrip:
    """Test all combinations of datasets, transports, and orjson settings."""

    def test_invalid_transport_encode(self):
        """Invalid transport should raise ValueError on encode."""
        with pytest.raises(ValueError, match="Unknown transport"):
            to_tytx(1, "foo")

    def test_invalid_transport_decode(self):
        """Invalid transport should raise ValueError on decode."""
        with pytest.raises(ValueError, match="Unknown transport"):
            from_tytx("test", transport="foo")

    def test_deserialize_str_suffix(self):
        """::T suffix decodes to string (compatibility)."""
        assert from_tytx("hello::T") == "hello"

    def test_deserialize_datetime_without_z(self):
        """Datetime without Z suffix (ISO format with +00:00)."""
        assert from_tytx("2025-01-15T10:30:00+00:00::DHZ") == datetime(
            2025, 1, 15, 10, 30, tzinfo=timezone.utc
        )

    def test_from_tytx_none(self):
        """from_tytx(None) should return None."""
        assert from_tytx(None) is None

    def test_from_xml_single_child(self):
        """XML with single child element."""
        result = from_tytx("<order><item>100::N</item></order>", transport="xml")
        assert result == {
            "order": {
                "attrs": {},
                "value": {"item": {"attrs": {}, "value": Decimal("100")}},
            }
        }

    def test_raw_json(self):
        """raw=True produces plain JSON without TYTX suffixes."""
        import json
        data = {"price": 100.50, "name": "test", "active": True}
        result = to_tytx(data, raw=True)
        # Verify it's valid JSON that can be parsed back to same data
        parsed = json.loads(result)
        assert parsed == data
        # Verify no TYTX suffix
        assert "::JS" not in result
        assert "::N" not in result

    def test_raw_json_with_transport(self):
        """raw=True with transport='json' produces plain JSON."""
        import json
        data = {"items": [1, 2, 3]}
        result = to_tytx(data, transport="json", raw=True)
        # Verify it's valid JSON that can be parsed back to same data
        parsed = json.loads(result)
        assert parsed == data

    def test_raw_msgpack(self):
        """raw=True with msgpack produces plain msgpack without TYTX processing."""
        import msgpack
        data = {"count": 42, "values": [1, 2, 3]}
        result = to_tytx(data, transport="msgpack", raw=True)
        assert result == msgpack.packb(data)
        # Verify it's valid msgpack
        parsed = msgpack.unpackb(result)
        assert parsed == data

    def test_raw_xml_not_supported(self):
        """raw=True with XML should raise ValueError."""
        with pytest.raises(ValueError, match="raw=True is not supported for XML"):
            to_tytx({"a": 1}, transport="xml", raw=True)

    @pytest.mark.parametrize(
        "value,transport,use_orjson",
        [
            pytest.param(*args, id=f"{i}-{args[1]}-orjson={args[2]}")
            for i, args in enumerate(dataset_iterator())
        ],
    )
    def test_roundtrip(self, value, transport, use_orjson):
        """Roundtrip test for each dataset/transport/orjson combination."""
        encode_module.USE_ORJSON = use_orjson and encode_module.HAS_ORJSON
        txt = to_tytx(value, transport=transport)
        result = from_tytx(txt, transport=transport, use_orjson=use_orjson)
        assert tytx_equivalent(value, result), (
            f"Mismatch: {value!r} -> {txt!r} -> {result!r}"
        )


# =============================================================================
# HTTP Cross-Language Roundtrip Tests (Python → JS → Python)
# =============================================================================

JS_SERVER_PORT = 3456
JS_SERVER_URL = f"http://localhost:{JS_SERVER_PORT}/echo"

HTTP_TRANSPORTS = ["json", "xml", "msgpack"]

CONTENT_TYPES = {
    "json": "application/json",
    "xml": "application/xml",
    "msgpack": "application/msgpack",
}


def http_dataset_iterator():
    """Yield test cases for HTTP roundtrip (only explicit transports)."""
    for value, transports in DATASETS:
        valid_transports = transports if transports else HTTP_TRANSPORTS
        for transport in valid_transports:
            if transport in HTTP_TRANSPORTS:
                yield value, transport


class TestHTTPCrossLanguageRoundtrip:
    """Test roundtrip Python → JS server → Python via HTTP."""

    @pytest.fixture(scope="class")
    def js_server(self):
        """Start JS echo server for tests."""
        server_path = Path(__file__).parent.parent / "js" / "test" / "server_echo.js"
        if not server_path.exists():
            pytest.skip("JS server not found")

        proc = subprocess.Popen(
            ["node", str(server_path)],
            cwd=Path(__file__).parent.parent,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Wait for server to start
        for _ in range(20):
            time_module.sleep(0.1)
            try:
                req = urllib.request.Request(
                    f"http://localhost:{JS_SERVER_PORT}/health"
                )
                urllib.request.urlopen(req, timeout=1)
                break
            except urllib.error.URLError:
                continue
        else:
            proc.terminate()
            pytest.skip("JS server failed to start")

        yield JS_SERVER_URL

        proc.terminate()
        proc.wait()

    @pytest.mark.parametrize(
        "value,transport",
        [
            pytest.param(*args, id=f"{i}-{args[1]}")
            for i, args in enumerate(http_dataset_iterator())
        ],
    )
    def test_roundtrip_via_js(self, value, transport, js_server):
        """Roundtrip test: Python encode → JS decode/encode → Python decode."""
        # Serialize in Python
        encoded = to_tytx(value, transport=transport)

        # Prepare request
        content_type = CONTENT_TYPES[transport]
        if transport == "msgpack":
            data = encoded
        else:
            data = encoded.encode("utf-8")

        req = urllib.request.Request(
            js_server,
            data=data,
            headers={"Content-Type": content_type},
            method="POST",
        )

        # Send to JS server
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                response_data = resp.read()
        except urllib.error.URLError as e:
            pytest.fail(f"HTTP request failed: {e}")

        # Deserialize response
        if transport == "msgpack":
            result = from_tytx(response_data, transport=transport)
        else:
            result = from_tytx(response_data.decode("utf-8"), transport=transport)

        # Verify equivalence
        assert tytx_equivalent(value, result), (
            f"Mismatch: {value!r} -> {encoded!r} -> {result!r}"
        )


if __name__ == "__main__":
    fails = run_tests()

    if fails:
        print("\nRoundtrip failures:\n")
        for (k, use_orjson, transport), (original, txt, result) in fails.items():
            print(f"  [index={k}] orjson={use_orjson}, transport={transport}")
            print(f"    original: {original!r}")
            print(f"    serialized: {txt!r}")
            print(f"    result: {result!r}")
            print()
    else:
        total = sum(len(t[1]) if t[1] else len(TRANSPORTS) for t in DATASETS) * 2
        print(f"\nAll {total} roundtrips passed!")

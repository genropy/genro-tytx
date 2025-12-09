# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Extended roundtrip tests for all TYTX transports and types."""

from datetime import date, datetime, time, timezone, timedelta
from decimal import Decimal

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
        [{"dt": datetime(2025, 1, 1, 0, 0)}, {"dt": datetime(2025, 12, 31, 23, 59)}],
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


def run_tests():
    """Run all roundtrip tests and return failures."""
    fails = {}

    for k, (v, transports) in enumerate(DATASETS):
        test_transports = transports if transports else TRANSPORTS
        for use_orjson in (False, True):
            encode_module.USE_ORJSON = use_orjson and encode_module.HAS_ORJSON
            for transport in test_transports:
                try:
                    txt = to_tytx(v, transport=transport)
                    nv = from_tytx(txt, transport=transport, use_orjson=use_orjson)
                    if not tytx_equivalent(v, nv):
                        fails[(k, use_orjson, transport)] = (v, txt, nv)
                except Exception as e:
                    fails[(k, use_orjson, transport)] = (v, None, str(e))

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

    def test_all_roundtrips(self):
        """All roundtrips should succeed."""
        fails = run_tests()

        if fails:
            msg = "\n\nRoundtrip failures:\n"
            for (k, use_orjson, transport), (original, txt, result) in fails.items():
                msg += f"\n  [index={k}] orjson={use_orjson}, transport={transport}\n"
                msg += f"    original: {original!r}\n"
                msg += f"    serialized: {txt!r}\n"
                msg += f"    result: {result!r}\n"
            pytest.fail(msg)


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

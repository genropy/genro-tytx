# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for MessagePack encoding/decoding."""

from datetime import date, datetime
from decimal import Decimal

import pytest

pytest.importorskip("msgpack")

from genro_tytx import to_msgpack, from_msgpack


class TestMsgpackEncode:
    """Tests for to_msgpack encoding."""

    def test_decimal(self):
        result = to_msgpack({"price": Decimal("100.50")})
        assert isinstance(result, bytes)

    def test_date(self):
        result = to_msgpack({"d": date(2025, 1, 15)})
        assert isinstance(result, bytes)

    def test_native_types(self):
        result = to_msgpack({"name": "test", "count": 42})
        assert isinstance(result, bytes)


class TestMsgpackDecode:
    """Tests for from_msgpack decoding."""

    def test_decimal(self):
        packed = to_msgpack({"price": Decimal("100.50")})
        result = from_msgpack(packed)
        assert result == {"price": Decimal("100.50")}

    def test_date(self):
        packed = to_msgpack({"d": date(2025, 1, 15)})
        result = from_msgpack(packed)
        assert result == {"d": date(2025, 1, 15)}


class TestMsgpackRoundTrip:
    """Tests for MessagePack roundtrip."""

    def test_complex_roundtrip(self):
        original = {
            "invoice": {
                "total": Decimal("999.99"),
                "date": date(2025, 1, 15),
                "items": [
                    {"price": Decimal("100.00")},
                    {"price": Decimal("200.00")},
                ],
            }
        }
        packed = to_msgpack(original)
        result = from_msgpack(packed)
        assert result == original

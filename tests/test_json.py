# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for JSON encoding/decoding."""

from datetime import date, datetime, time
from decimal import Decimal

import pytest

from genro_tytx_base import to_tytx, from_tytx


class TestEncode:
    """Tests for to_tytx encoding."""

    def test_decimal(self):
        result = to_tytx({"price": Decimal("100.50")})
        assert "::JS" in result
        assert '"100.50::N"' in result

    def test_date(self):
        result = to_tytx({"d": date(2025, 1, 15)})
        assert "::JS" in result
        assert '"2025-01-15::D"' in result

    def test_datetime_naive(self):
        result = to_tytx({"dt": datetime(2025, 1, 15, 10, 30, 0)})
        assert "::JS" in result
        assert '"2025-01-15T10:30:00Z::DHZ"' in result

    def test_time(self):
        result = to_tytx({"t": time(10, 30, 0)})
        assert "::JS" in result
        assert '"10:30:00::H"' in result

    def test_bool_native(self):
        """Bool is native JSON type, no encoding needed."""
        result = to_tytx({"flag": True, "other": False})
        assert "::JS" not in result
        assert "true" in result
        assert "false" in result

    def test_native_only(self):
        """No TYTX marker when only native types."""
        result = to_tytx({"name": "test", "count": 42})
        assert "::JS" not in result
        assert '"name"' in result
        assert '"test"' in result

    def test_mixed_types(self):
        result = to_tytx({
            "price": Decimal("100.50"),
            "date": date(2025, 1, 15),
            "name": "test",
        })
        assert "::JS" in result
        assert '"100.50::D"' in result
        assert '"2025-01-15::d"' in result

    def test_nested_structure(self):
        result = to_tytx({
            "invoice": {
                "total": Decimal("999.99"),
                "items": [
                    {"price": Decimal("100.00")},
                    {"price": Decimal("200.00")},
                ],
            }
        })
        assert "::JS" in result

    def test_list_with_typed(self):
        result = to_tytx([Decimal("1.0"), Decimal("2.0")])
        assert "::JS" in result


class TestDecode:
    """Tests for from_tytx decoding."""

    def test_decimal(self):
        result = from_tytx('{"price": "100.50::D"}::JS')
        assert result == {"price": Decimal("100.50")}

    def test_date(self):
        result = from_tytx('{"d": "2025-01-15::d"}::JS')
        assert result == {"d": date(2025, 1, 15)}

    def test_datetime(self):
        result = from_tytx('{"dt": "2025-01-15T10:30:00Z::DH"}::JS')
        assert result["dt"].year == 2025
        assert result["dt"].hour == 10

    def test_time(self):
        result = from_tytx('{"t": "10:30:00::t"}::JS')
        assert result == {"t": time(10, 30, 0)}

    def test_bool(self):
        result = from_tytx('{"flag": "1::B"}::JS')
        assert result == {"flag": True}

    def test_no_marker(self):
        """Without TYTX marker, no hydration."""
        result = from_tytx('{"price": "100.50::D"}')
        assert result == {"price": "100.50::D"}

    def test_nested(self):
        result = from_tytx('{"a": {"b": "100::D"}}::JS')
        assert result == {"a": {"b": Decimal("100")}}

    def test_list(self):
        result = from_tytx('["1.0::D", "2.0::D"]::JS')
        assert result == [Decimal("1.0"), Decimal("2.0")]


class TestRoundTrip:
    """Tests for encode -> decode roundtrip."""

    def test_decimal_roundtrip(self):
        original = {"price": Decimal("100.50")}
        encoded = to_tytx(original)
        decoded = from_tytx(encoded)
        assert decoded == original

    def test_date_roundtrip(self):
        original = {"d": date(2025, 1, 15)}
        encoded = to_tytx(original)
        decoded = from_tytx(encoded)
        assert decoded == original

    def test_complex_roundtrip(self):
        original = {
            "invoice": {
                "total": Decimal("999.99"),
                "date": date(2025, 1, 15),
                "items": [
                    {"price": Decimal("100.00"), "qty": 2},
                    {"price": Decimal("200.00"), "qty": 1},
                ],
            }
        }
        encoded = to_tytx(original)
        decoded = from_tytx(encoded)
        assert decoded == original

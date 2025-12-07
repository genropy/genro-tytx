# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for JSON encoding/decoding."""

from datetime import date, datetime, time
from decimal import Decimal

import pytest

from genro_tytx import to_typed_text, from_text, to_typed_json, from_json


class TestEncode:
    """Tests for to_typed_text encoding."""

    def test_decimal(self):
        result = to_typed_text({"price": Decimal("100.50")})
        assert "::JS" in result
        assert '"100.50::N"' in result

    def test_date(self):
        result = to_typed_text({"d": date(2025, 1, 15)})
        assert "::JS" in result
        assert '"2025-01-15::D"' in result

    def test_datetime_naive(self):
        result = to_typed_text({"dt": datetime(2025, 1, 15, 10, 30, 0)})
        assert "::JS" in result
        assert '"2025-01-15T10:30:00.000Z::DHZ"' in result

    def test_datetime_with_milliseconds(self):
        """Datetime with milliseconds preserved."""
        result = to_typed_text({"dt": datetime(2025, 1, 15, 10, 30, 45, 123000)})
        assert "::JS" in result
        assert '"2025-01-15T10:30:45.123Z::DHZ"' in result

    def test_datetime_microseconds_truncated(self):
        """Datetime microseconds truncated to milliseconds."""
        result = to_typed_text({"dt": datetime(2025, 1, 15, 10, 30, 45, 123456)})
        assert "::JS" in result
        # 123456 microseconds = 123.456 milliseconds → 123 milliseconds
        assert '"2025-01-15T10:30:45.123Z::DHZ"' in result

    def test_time(self):
        result = to_typed_text({"t": time(10, 30, 0)})
        assert "::JS" in result
        assert '"10:30:00::H"' in result

    def test_bool_native(self):
        """Bool is native JSON type, no encoding needed."""
        result = to_typed_text({"flag": True, "other": False})
        assert "::JS" not in result
        assert "true" in result
        assert "false" in result

    def test_native_only(self):
        """No TYTX marker when only native types."""
        result = to_typed_text({"name": "test", "count": 42})
        assert "::JS" not in result
        assert '"name"' in result
        assert '"test"' in result

    def test_mixed_types(self):
        result = to_typed_text({
            "price": Decimal("100.50"),
            "date": date(2025, 1, 15),
            "name": "test",
        })
        assert "::JS" in result
        assert '"100.50::N"' in result
        assert '"2025-01-15::D"' in result

    def test_nested_structure(self):
        result = to_typed_text({
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
        result = to_typed_text([Decimal("1.0"), Decimal("2.0")])
        assert "::JS" in result


class TestDecode:
    """Tests for from_text decoding."""

    def test_decimal(self):
        result = from_text('{"price": "100.50::N"}::JS')
        assert result == {"price": Decimal("100.50")}

    def test_date(self):
        result = from_text('{"d": "2025-01-15::D"}::JS')
        assert result == {"d": date(2025, 1, 15)}

    def test_datetime(self):
        result = from_text('{"dt": "2025-01-15T10:30:00Z::DHZ"}::JS')
        assert result["dt"].year == 2025
        assert result["dt"].hour == 10

    def test_datetime_deprecated_dh(self):
        """DH is deprecated but still accepted for backward compatibility."""
        result = from_text('{"dt": "2025-01-15T10:30:00Z::DH"}::JS')
        assert result["dt"].year == 2025
        assert result["dt"].hour == 10

    def test_time(self):
        result = from_text('{"t": "10:30:00::H"}::JS')
        assert result == {"t": time(10, 30, 0)}

    def test_bool(self):
        result = from_text('{"flag": "1::B"}::JS')
        assert result == {"flag": True}

    def test_no_marker(self):
        """Without TYTX marker, no hydration."""
        result = from_text('{"price": "100.50::N"}')
        assert result == {"price": "100.50::N"}

    def test_nested(self):
        result = from_text('{"a": {"b": "100::N"}}::JS')
        assert result == {"a": {"b": Decimal("100")}}

    def test_list(self):
        result = from_text('["1.0::N", "2.0::N"]::JS')
        assert result == [Decimal("1.0"), Decimal("2.0")]


class TestDecodeNativeTypes:
    """Tests for decoding L, R, T types (received from other systems)."""

    def test_long_integer(self):
        """L type for integers (from spec)."""
        result = from_text('{"count": "42::L"}::JS')
        assert result == {"count": 42}
        assert isinstance(result["count"], int)

    def test_real_float(self):
        """R type for floats (from spec)."""
        result = from_text('{"value": "3.14::R"}::JS')
        assert result == {"value": 3.14}
        assert isinstance(result["value"], float)

    def test_text_string(self):
        """T type for strings (from spec)."""
        result = from_text('{"name": "hello::T"}::JS')
        assert result == {"name": "hello"}
        assert isinstance(result["name"], str)

    def test_integer_alias_I(self):
        """I is alias for L (XML compat)."""
        result = from_text('{"count": "42::I"}::JS')
        assert result == {"count": 42}


class TestEdgeCases:
    """Tests for edge cases and special values."""

    def test_decimal_many_decimals(self):
        """Decimal with many decimal places."""
        original = {"price": Decimal("123.456789012345678901234567890")}
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
        assert decoded == original

    def test_null_value(self):
        """Null values pass through unchanged."""
        result = from_text('{"value": null}::JS')
        assert result == {"value": None}

    def test_empty_string(self):
        """Empty string value."""
        result = from_text('{"value": ""}::JS')
        assert result == {"value": ""}

    def test_trailing_whitespace(self):
        """Trailing whitespace is stripped before parsing."""
        result = from_text('{"price": "100.50::N"}::JS\n')
        assert result == {"price": Decimal("100.50")}

    def test_leading_whitespace(self):
        """Leading whitespace is stripped before parsing."""
        result = from_text('  {"price": "100.50::N"}::JS')
        assert result == {"price": Decimal("100.50")}

    def test_both_whitespace(self):
        """Both leading and trailing whitespace handled."""
        result = from_text('\n  {"price": "100.50::N"}::JS  \n')
        assert result == {"price": Decimal("100.50")}

    def test_unknown_suffix(self):
        """Unknown suffix is left as string."""
        result = from_text('{"value": "test::UNKNOWN"}::JS')
        assert result == {"value": "test::UNKNOWN"}

    def test_string_with_double_colon(self):
        """String containing :: but not a valid suffix."""
        result = from_text('{"value": "test::value::more"}::JS')
        assert result == {"value": "test::value::more"}

    def test_datetime_with_timezone(self):
        """Datetime with UTC timezone."""
        from datetime import timezone
        original = {"dt": datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)}
        encoded = to_typed_text(original)
        assert '"2025-01-15T10:30:00.000Z::DHZ"' in encoded
        decoded = from_text(encoded)
        assert decoded["dt"].year == 2025
        assert decoded["dt"].hour == 10

    def test_datetime_milliseconds_roundtrip(self):
        """Datetime with milliseconds roundtrip."""
        from datetime import timezone
        original = {"dt": datetime(2025, 1, 15, 10, 30, 45, 123000)}
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
        # After roundtrip: aware UTC, same milliseconds
        assert decoded["dt"].year == 2025
        assert decoded["dt"].hour == 10
        assert decoded["dt"].second == 45
        assert decoded["dt"].microsecond == 123000

    def test_datetime_microseconds_precision_loss(self):
        """Datetime microseconds truncated to milliseconds in roundtrip."""
        from datetime import timezone
        original = {"dt": datetime(2025, 1, 15, 10, 30, 45, 123456)}
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
        # Microseconds truncated: 123456 → 123000
        assert decoded["dt"].microsecond == 123000

    def test_time_with_microseconds(self):
        """Time with microseconds."""
        original = {"t": time(10, 30, 45, 123456)}
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
        assert decoded == original


class TestRoundTrip:
    """Tests for encode -> decode roundtrip."""

    def test_decimal_roundtrip(self):
        original = {"price": Decimal("100.50")}
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
        assert decoded == original

    def test_date_roundtrip(self):
        original = {"d": date(2025, 1, 15)}
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
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
        encoded = to_typed_text(original)
        decoded = from_text(encoded)
        assert decoded == original


class TestTypedJson:
    """Tests for to_typed_json/from_json with TYTX:// prefix."""

    def test_encode_with_prefix(self):
        """to_typed_json adds TYTX:// prefix."""
        result = to_typed_json({"price": Decimal("100.50")})
        assert result.startswith("TYTX://")
        assert result.endswith("::JS")
        assert '"100.50::N"' in result

    def test_encode_native_with_prefix(self):
        """to_typed_json adds TYTX:// even for native types."""
        result = to_typed_json({"name": "test", "count": 42})
        assert result.startswith("TYTX://")
        assert "::JS" not in result  # No typed values

    def test_decode_with_prefix(self):
        """from_json handles TYTX:// prefix."""
        result = from_json('TYTX://{"price": "100.50::N"}::JS')
        assert result == {"price": Decimal("100.50")}

    def test_decode_without_prefix(self):
        """from_json also works without TYTX:// prefix."""
        result = from_json('{"price": "100.50::N"}::JS')
        assert result == {"price": Decimal("100.50")}

    def test_roundtrip(self):
        """to_typed_json -> from_json roundtrip."""
        original = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
        encoded = to_typed_json(original)
        decoded = from_json(encoded)
        assert decoded == original

    def test_complex_roundtrip(self):
        """Complex structure roundtrip with TYTX:// prefix."""
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
        encoded = to_typed_json(original)
        assert encoded.startswith("TYTX://")
        decoded = from_json(encoded)
        assert decoded == original

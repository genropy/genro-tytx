from datetime import date, datetime
from decimal import Decimal

import json

from genro_tytx import (
    as_json,
    as_text,
    as_typed_json,
    as_typed_text,
    as_typed_xml,
    as_xml,
    from_json,
    from_text,
    from_xml,
    registry,
)


class TestFromText:
    """Tests for from_text() - the main parsing function."""

    def test_from_text_typed_int(self):
        assert from_text("123::I") == 123
        assert from_text("123::int") == 123

    def test_from_text_typed_float(self):
        assert from_text("123.45::F") == 123.45

    def test_from_text_typed_bool(self):
        assert from_text("true::B") is True
        assert from_text("false::B") is False

    def test_from_text_typed_str(self):
        assert from_text("hello::S") == "hello"

    def test_from_text_typed_json(self):
        assert from_text('{"a":1}::J') == {"a": 1}

    def test_from_text_typed_list(self):
        assert from_text("a,b,c::L") == ["a", "b", "c"]

    def test_from_text_typed_decimal(self):
        assert from_text("123.45::D") == Decimal("123.45")

    def test_from_text_typed_date(self):
        assert from_text("2025-01-15::d") == date(2025, 1, 15)

    def test_from_text_typed_datetime(self):
        assert from_text("2025-01-15T10:00:00::dt") == datetime(2025, 1, 15, 10, 0, 0)

    def test_from_text_no_type(self):
        """Without type suffix, returns string as-is."""
        assert from_text("123") == "123"

    def test_from_text_explicit_type(self):
        """With explicit type_code parameter."""
        assert from_text("123", "I") == 123
        assert from_text("123.45", "D") == Decimal("123.45")
        assert from_text("2025-01-15", "d") == date(2025, 1, 15)


class TestAsText:
    """Tests for as_text() - serialize without type."""

    def test_as_text_int(self):
        assert as_text(123) == "123"

    def test_as_text_float(self):
        assert as_text(123.45) == "123.45"

    def test_as_text_bool(self):
        assert as_text(True) == "true"
        assert as_text(False) == "false"

    def test_as_text_decimal(self):
        assert as_text(Decimal("123.45")) == "123.45"

    def test_as_text_date(self):
        assert as_text(date(2025, 1, 15)) == "2025-01-15"

    def test_as_text_datetime(self):
        assert as_text(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00"

    def test_as_text_json(self):
        assert as_text({"a": 1}) == '{"a": 1}'

    def test_as_text_str(self):
        assert as_text("hello") == "hello"


class TestAsTypedText:
    """Tests for as_typed_text() - serialize with type."""

    def test_as_typed_text_int(self):
        assert as_typed_text(123) == "123::I"

    def test_as_typed_text_float(self):
        assert as_typed_text(123.45) == "123.45::F"

    def test_as_typed_text_bool(self):
        assert as_typed_text(True) == "true::B"
        assert as_typed_text(False) == "false::B"

    def test_as_typed_text_decimal(self):
        assert as_typed_text(Decimal("123.45")) == "123.45::D"

    def test_as_typed_text_date(self):
        assert as_typed_text(date(2025, 1, 15)) == "2025-01-15::d"

    def test_as_typed_text_datetime(self):
        assert as_typed_text(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00::dt"

    def test_as_typed_text_json(self):
        assert as_typed_text({"a": 1}) == '{"a": 1}::J'

    def test_as_typed_text_str(self):
        """Strings are returned as-is (no type added)."""
        assert as_typed_text("hello") == "hello"


class TestRegistryHelpers:
    """Tests for registry helper methods."""

    def test_is_typed(self):
        assert registry.is_typed("123::I") is True
        assert registry.is_typed("hello::S") is True
        assert registry.is_typed("123") is False
        assert registry.is_typed("hello::UNKNOWN") is False


class TestTypeAttributes:
    """Tests for type class attributes (sql_type, align, empty, python_type)."""

    def test_int_attributes(self):
        from genro_tytx import IntType

        assert IntType.python_type is int
        assert IntType.sql_type == "INTEGER"
        assert IntType.align == "R"
        assert IntType.empty == 0

    def test_decimal_attributes(self):
        from genro_tytx import DecimalType

        assert DecimalType.python_type is Decimal
        assert DecimalType.sql_type == "DECIMAL"
        assert DecimalType.align == "R"
        assert DecimalType.empty == Decimal("0")

    def test_str_attributes(self):
        from genro_tytx import StrType

        assert StrType.python_type is str
        assert StrType.sql_type == "VARCHAR"
        assert StrType.align == "L"
        assert StrType.empty == ""

    def test_date_attributes(self):
        from genro_tytx import DateType

        assert DateType.python_type is date
        assert DateType.sql_type == "DATE"
        assert DateType.empty is None

    def test_datetime_attributes(self):
        from genro_tytx import DateTimeType

        assert DateTimeType.python_type is datetime
        assert DateTimeType.sql_type == "TIMESTAMP"
        assert DateTimeType.empty is None

    def test_genropy_compatible_aliases(self):
        """Test that Genropy-compatible aliases work."""
        # Integer aliases (Genropy uses L for long/int)
        assert from_text("123::INT") == 123
        assert from_text("123::INTEGER") == 123
        assert from_text("123::LONG") == 123

        # Float aliases (Genropy uses R for real)
        assert from_text("1.5::R") == 1.5
        assert from_text("1.5::REAL") == 1.5

        # Boolean
        assert from_text("true::BOOL") is True
        assert from_text("true::BOOLEAN") is True

        # String/Text (Genropy uses T, A, P)
        assert from_text("hello::T") == "hello"
        assert from_text("hello::TEXT") == "hello"

        # Decimal (Genropy uses N for numeric)
        assert from_text("100.50::N") == Decimal("100.50")
        assert from_text("100.50::NUMERIC") == Decimal("100.50")

        # DateTime (Genropy uses DH, DHZ)
        assert from_text("2025-01-15T10:00:00::DH") == datetime(2025, 1, 15, 10, 0, 0)
        assert from_text("2025-01-15T10:00:00::DHZ") == datetime(2025, 1, 15, 10, 0, 0)


class TestAsTextFormatting:
    """Tests for as_text() with format parameter."""

    def test_as_text_format_none_returns_iso(self):
        """format=None returns ISO/technical output."""
        assert as_text(date(2025, 1, 15)) == "2025-01-15"
        assert as_text(datetime(2025, 1, 15, 10, 30, 0)) == "2025-01-15T10:30:00"
        assert as_text(123) == "123"
        assert as_text(Decimal("1234.56")) == "1234.56"

    def test_as_text_format_true_uses_default(self):
        """format=True uses type's default_format."""
        # These tests verify format=True activates formatting
        # The exact output depends on system locale
        result = as_text(date(2025, 1, 15), format=True)
        assert result != "2025-01-15"  # Should NOT be ISO format

        result = as_text(datetime(2025, 1, 15, 10, 30, 0), format=True)
        assert result != "2025-01-15T10:30:00"  # Should NOT be ISO format

    def test_as_text_format_string(self):
        """format=string uses specific format."""
        assert as_text(date(2025, 1, 15), format="%d/%m/%Y") == "15/01/2025"
        assert as_text(datetime(2025, 1, 15, 10, 30), format="%Y-%m-%d %H:%M") == "2025-01-15 10:30"

    def test_as_text_format_numeric(self):
        """Numeric types support locale-aware formatting."""
        # Without format: ISO output
        assert as_text(1234567) == "1234567"

        # With explicit format
        result = as_text(1234567, format="%d")
        # Result depends on locale, but should be a string
        assert isinstance(result, str)

    def test_as_text_string_ignores_format(self):
        """String values return as-is regardless of format."""
        assert as_text("hello", format=True) == "hello"
        assert as_text("hello", format="%s") == "hello"


class TestXMLNewStructure:
    """Tests for XML utilities with new attrs/value structure."""

    def test_as_typed_xml_simple(self):
        """Simple element with typed value."""
        data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
        xml = as_typed_xml(data)
        assert "<root>10.50::D</root>" in xml

    def test_as_xml_simple(self):
        """Simple element without type suffix."""
        data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
        xml = as_xml(data)
        assert "<root>10.50</root>" in xml
        assert "::" not in xml

    def test_as_typed_xml_with_attrs(self):
        """Element with typed attributes."""
        data = {"root": {"attrs": {"id": 123, "price": Decimal("99.50")}, "value": "content"}}
        xml = as_typed_xml(data)
        assert 'id="123::I"' in xml
        assert 'price="99.50::D"' in xml

    def test_as_xml_with_attrs(self):
        """Element with attributes (no type suffix)."""
        data = {"root": {"attrs": {"id": 123}, "value": "content"}}
        xml = as_xml(data)
        assert 'id="123"' in xml
        assert "::" not in xml

    def test_as_typed_xml_nested(self):
        """Nested elements."""
        data = {
            "order": {
                "attrs": {"id": 1},
                "value": {
                    "item": {"attrs": {}, "value": "Widget"},
                    "price": {"attrs": {}, "value": Decimal("25.00")},
                },
            }
        }
        xml = as_typed_xml(data)
        assert 'id="1::I"' in xml
        assert "<item>Widget</item>" in xml
        assert "<price>25.00::D</price>" in xml

    def test_from_xml_simple(self):
        """Parse simple XML to attrs/value structure."""
        xml = "<root>hello</root>"
        result = from_xml(xml)
        assert result == {"root": {"attrs": {}, "value": "hello"}}

    def test_from_xml_typed(self):
        """Parse XML with typed values."""
        xml = "<root>10.50::D</root>"
        result = from_xml(xml)
        assert result["root"]["value"] == Decimal("10.50")

    def test_from_xml_with_attrs(self):
        """Parse XML with attributes."""
        xml = '<root id="123::I" name="test">content</root>'
        result = from_xml(xml)
        assert result["root"]["attrs"]["id"] == 123
        assert result["root"]["attrs"]["name"] == "test"
        assert result["root"]["value"] == "content"

    def test_from_xml_nested(self):
        """Parse nested XML."""
        xml = "<order><item>Widget</item><price>25.00::D</price></order>"
        result = from_xml(xml)
        assert result["order"]["attrs"] == {}
        assert result["order"]["value"]["item"]["value"] == "Widget"
        assert result["order"]["value"]["price"]["value"] == Decimal("25.00")

    def test_xml_roundtrip(self):
        """Round-trip: as_typed_xml then from_xml."""
        original = {
            "order": {
                "attrs": {"id": 42},
                "value": {
                    "customer": {"attrs": {}, "value": "Acme"},
                    "total": {"attrs": {}, "value": Decimal("199.99")},
                },
            }
        }
        xml = as_typed_xml(original)
        restored = from_xml(xml)
        assert restored["order"]["attrs"]["id"] == 42
        assert restored["order"]["value"]["customer"]["value"] == "Acme"
        assert restored["order"]["value"]["total"]["value"] == Decimal("199.99")


class TestJSONUtils:
    """Tests for JSON utilities."""

    def test_as_typed_json_decimal(self):
        """as_typed_json converts Decimal to typed string."""
        result = as_typed_json({"price": Decimal("99.99")})
        assert '"price": "99.99::D"' in result

    def test_as_typed_json_date(self):
        """as_typed_json converts date to typed string."""
        result = as_typed_json({"day": date(2025, 1, 15)})
        assert '"day": "2025-01-15::d"' in result

    def test_as_typed_json_datetime(self):
        """as_typed_json converts datetime to typed string."""
        result = as_typed_json({"ts": datetime(2025, 1, 15, 10, 30)})
        assert '"ts": "2025-01-15T10:30:00::dt"' in result

    def test_as_typed_json_complex(self):
        """as_typed_json handles complex nested structures."""
        data = {
            "name": "Test",
            "price": Decimal("100.50"),
            "date": date(2025, 1, 15),
            "items": [1, 2, 3],
        }
        result = as_typed_json(data)
        assert '"price": "100.50::D"' in result
        assert '"date": "2025-01-15::d"' in result
        assert '"name": "Test"' in result

    def test_as_json_standard(self):
        """as_json produces standard JSON (no type suffixes)."""
        data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
        result = as_json(data)
        # Decimal becomes float, date becomes ISO string
        assert "::" not in result
        parsed = json.loads(result)
        assert parsed["price"] == 99.99
        assert parsed["date"] == "2025-01-15"

    def test_from_json_simple(self):
        """from_json parses typed strings."""
        json_str = '{"price": "99.99::D", "count": "42::I"}'
        result = from_json(json_str)
        assert result["price"] == Decimal("99.99")
        assert result["count"] == 42

    def test_from_json_nested(self):
        """from_json handles nested structures."""
        json_str = '{"order": {"price": "100::D", "date": "2025-01-15::d"}}'
        result = from_json(json_str)
        assert result["order"]["price"] == Decimal("100")
        assert result["order"]["date"] == date(2025, 1, 15)

    def test_from_json_list(self):
        """from_json handles lists with typed values."""
        json_str = '{"prices": ["10::D", "20::D", "30::D"]}'
        result = from_json(json_str)
        assert result["prices"] == [Decimal("10"), Decimal("20"), Decimal("30")]

    def test_json_roundtrip(self):
        """Round-trip: as_typed_json then from_json returns original values."""
        original = {
            "price": Decimal("123.45"),
            "date": date(2025, 6, 15),
            "timestamp": datetime(2025, 6, 15, 14, 30, 0),
            "name": "Test",
            "count": 42,
        }
        json_str = as_typed_json(original)
        restored = from_json(json_str)
        assert restored["price"] == original["price"]
        assert restored["date"] == original["date"]
        assert restored["timestamp"] == original["timestamp"]
        assert restored["name"] == original["name"]
        assert restored["count"] == original["count"]

    def test_from_json_preserves_non_typed(self):
        """from_json preserves values without type suffix."""
        json_str = '{"a": "hello", "b": 123, "c": true}'
        result = from_json(json_str)
        assert result["a"] == "hello"
        assert result["b"] == 123
        assert result["c"] is True

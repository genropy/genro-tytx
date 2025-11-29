from datetime import date, datetime
from decimal import Decimal

import json

from genro_tytx import (
    asText,
    asTypedText,
    fromText,
    parse,
    registry,
    serialize,
    tytx_decoder,
    tytx_dumps,
    tytx_encoder,
    tytx_loads,
)
from genro_tytx.xml_utils import dict_to_xml, xml_to_dict


class TestFromText:
    """Tests for fromText() - the main parsing function."""

    def test_fromtext_typed_int(self):
        assert fromText("123::I") == 123
        assert fromText("123::int") == 123

    def test_fromtext_typed_float(self):
        assert fromText("123.45::F") == 123.45

    def test_fromtext_typed_bool(self):
        assert fromText("true::B") is True
        assert fromText("false::B") is False

    def test_fromtext_typed_str(self):
        assert fromText("hello::S") == "hello"

    def test_fromtext_typed_json(self):
        assert fromText('{"a":1}::J') == {"a": 1}

    def test_fromtext_typed_list(self):
        assert fromText("a,b,c::L") == ["a", "b", "c"]

    def test_fromtext_typed_decimal(self):
        assert fromText("123.45::D") == Decimal("123.45")

    def test_fromtext_typed_date(self):
        assert fromText("2025-01-15::d") == date(2025, 1, 15)

    def test_fromtext_typed_datetime(self):
        assert fromText("2025-01-15T10:00:00::dt") == datetime(2025, 1, 15, 10, 0, 0)

    def test_fromtext_no_type(self):
        """Without type suffix, returns string as-is."""
        assert fromText("123") == "123"

    def test_fromtext_explicit_type(self):
        """With explicit type_code parameter."""
        assert fromText("123", "I") == 123
        assert fromText("123.45", "D") == Decimal("123.45")
        assert fromText("2025-01-15", "d") == date(2025, 1, 15)


class TestAsText:
    """Tests for asText() - serialize without type."""

    def test_astext_int(self):
        assert asText(123) == "123"

    def test_astext_float(self):
        assert asText(123.45) == "123.45"

    def test_astext_bool(self):
        assert asText(True) == "true"
        assert asText(False) == "false"

    def test_astext_decimal(self):
        assert asText(Decimal("123.45")) == "123.45"

    def test_astext_date(self):
        assert asText(date(2025, 1, 15)) == "2025-01-15"

    def test_astext_datetime(self):
        assert asText(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00"

    def test_astext_json(self):
        assert asText({"a": 1}) == '{"a": 1}'

    def test_astext_str(self):
        assert asText("hello") == "hello"


class TestAsTypedText:
    """Tests for asTypedText() - serialize with type."""

    def test_astypedtext_int(self):
        assert asTypedText(123) == "123::I"

    def test_astypedtext_float(self):
        assert asTypedText(123.45) == "123.45::F"

    def test_astypedtext_bool(self):
        assert asTypedText(True) == "true::B"
        assert asTypedText(False) == "false::B"

    def test_astypedtext_decimal(self):
        assert asTypedText(Decimal("123.45")) == "123.45::D"

    def test_astypedtext_date(self):
        assert asTypedText(date(2025, 1, 15)) == "2025-01-15::d"

    def test_astypedtext_datetime(self):
        assert asTypedText(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00::dt"

    def test_astypedtext_json(self):
        assert asTypedText({"a": 1}) == '{"a": 1}::J'

    def test_astypedtext_str(self):
        """Strings are returned as-is (no type added)."""
        assert asTypedText("hello") == "hello"


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
        assert fromText("123::INT") == 123
        assert fromText("123::INTEGER") == 123
        assert fromText("123::LONG") == 123

        # Float aliases (Genropy uses R for real)
        assert fromText("1.5::R") == 1.5
        assert fromText("1.5::REAL") == 1.5

        # Boolean
        assert fromText("true::BOOL") is True
        assert fromText("true::BOOLEAN") is True

        # String/Text (Genropy uses T, A, P)
        assert fromText("hello::T") == "hello"
        assert fromText("hello::TEXT") == "hello"

        # Decimal (Genropy uses N for numeric)
        assert fromText("100.50::N") == Decimal("100.50")
        assert fromText("100.50::NUMERIC") == Decimal("100.50")

        # DateTime (Genropy uses DH, DHZ)
        assert fromText("2025-01-15T10:00:00::DH") == datetime(2025, 1, 15, 10, 0, 0)
        assert fromText("2025-01-15T10:00:00::DHZ") == datetime(2025, 1, 15, 10, 0, 0)


class TestLegacyAPI:
    """Tests for legacy parse/serialize (backwards compatibility)."""

    def test_parse_int(self):
        assert parse("123::I") == 123
        assert parse("123::int") == 123

    def test_parse_no_type(self):
        assert parse("123") == "123"

    def test_serialize(self):
        assert serialize(123) == "123::I"
        assert serialize(Decimal("123.45")) == "123.45::D"
        assert serialize("hello") == "hello"


class TestAsTextFormatting:
    """Tests for asText() with format parameter."""

    def test_astext_format_none_returns_iso(self):
        """format=None returns ISO/technical output."""
        assert asText(date(2025, 1, 15)) == "2025-01-15"
        assert asText(datetime(2025, 1, 15, 10, 30, 0)) == "2025-01-15T10:30:00"
        assert asText(123) == "123"
        assert asText(Decimal("1234.56")) == "1234.56"

    def test_astext_format_true_uses_default(self):
        """format=True uses type's default_format."""
        # These tests verify format=True activates formatting
        # The exact output depends on system locale
        result = asText(date(2025, 1, 15), format=True)
        assert result != "2025-01-15"  # Should NOT be ISO format

        result = asText(datetime(2025, 1, 15, 10, 30, 0), format=True)
        assert result != "2025-01-15T10:30:00"  # Should NOT be ISO format

    def test_astext_format_string(self):
        """format=string uses specific format."""
        assert asText(date(2025, 1, 15), format="%d/%m/%Y") == "15/01/2025"
        assert asText(datetime(2025, 1, 15, 10, 30), format="%Y-%m-%d %H:%M") == "2025-01-15 10:30"

    def test_astext_format_numeric(self):
        """Numeric types support locale-aware formatting."""
        # Without format: ISO output
        assert asText(1234567) == "1234567"

        # With explicit format
        result = asText(1234567, format="%d")
        # Result depends on locale, but should be a string
        assert isinstance(result, str)

    def test_astext_string_ignores_format(self):
        """String values return as-is regardless of format."""
        assert asText("hello", format=True) == "hello"
        assert asText("hello", format="%s") == "hello"

class TestXMLUtils:
    def test_dict_to_xml_simple(self):
        data = {"root": {"@attr": 123, "#text": "content"}}
        xml = dict_to_xml(data)
        assert 'attr="123::I"' in xml
        assert '>content</root>' in xml

    def test_dict_to_xml_typed_content(self):
        data = {"root": Decimal("10.50")}
        xml = dict_to_xml(data)
        assert '>10.50::D</root>' in xml

    def test_xml_to_dict_simple(self):
        xml = '<root attr="123::I">content</root>'
        data = xml_to_dict(xml)
        assert data["root"]["@attr"] == 123
        assert data["root"]["#text"] == "content"

    def test_xml_to_dict_typed_content(self):
        xml = '<root>10.50::D</root>'
        data = xml_to_dict(xml)
        assert data["root"] == Decimal("10.50")


class TestJSONUtils:
    """Tests for JSON encoder/decoder utilities."""

    def test_tytx_encoder_decimal(self):
        """tytx_encoder converts Decimal to typed string."""
        result = json.dumps({"price": Decimal("99.99")}, default=tytx_encoder)
        assert '"price": "99.99::D"' in result

    def test_tytx_encoder_date(self):
        """tytx_encoder converts date to typed string."""
        result = json.dumps({"day": date(2025, 1, 15)}, default=tytx_encoder)
        assert '"day": "2025-01-15::d"' in result

    def test_tytx_encoder_datetime(self):
        """tytx_encoder converts datetime to typed string."""
        result = json.dumps({"ts": datetime(2025, 1, 15, 10, 30)}, default=tytx_encoder)
        assert '"ts": "2025-01-15T10:30:00::dt"' in result

    def test_tytx_dumps_complex(self):
        """tytx_dumps handles complex nested structures."""
        data = {
            "name": "Test",
            "price": Decimal("100.50"),
            "date": date(2025, 1, 15),
            "items": [1, 2, 3],
        }
        result = tytx_dumps(data)
        assert '"price": "100.50::D"' in result
        assert '"date": "2025-01-15::d"' in result
        assert '"name": "Test"' in result

    def test_tytx_loads_simple(self):
        """tytx_loads parses typed strings."""
        json_str = '{"price": "99.99::D", "count": "42::I"}'
        result = tytx_loads(json_str)
        assert result["price"] == Decimal("99.99")
        assert result["count"] == 42

    def test_tytx_loads_nested(self):
        """tytx_loads handles nested structures."""
        json_str = '{"order": {"price": "100::D", "date": "2025-01-15::d"}}'
        result = tytx_loads(json_str)
        assert result["order"]["price"] == Decimal("100")
        assert result["order"]["date"] == date(2025, 1, 15)

    def test_tytx_loads_list(self):
        """tytx_loads handles lists with typed values."""
        json_str = '{"prices": ["10::D", "20::D", "30::D"]}'
        result = tytx_loads(json_str)
        assert result["prices"] == [Decimal("10"), Decimal("20"), Decimal("30")]

    def test_tytx_roundtrip(self):
        """Round-trip: dumps then loads returns original values."""
        original = {
            "price": Decimal("123.45"),
            "date": date(2025, 6, 15),
            "timestamp": datetime(2025, 6, 15, 14, 30, 0),
            "name": "Test",
            "count": 42,
        }
        json_str = tytx_dumps(original)
        restored = tytx_loads(json_str)
        assert restored["price"] == original["price"]
        assert restored["date"] == original["date"]
        assert restored["timestamp"] == original["timestamp"]
        assert restored["name"] == original["name"]
        # Note: int goes through without type suffix, stays int
        assert restored["count"] == original["count"]

    def test_tytx_decoder_preserves_non_typed(self):
        """tytx_decoder preserves values without type suffix."""
        result = tytx_decoder({"a": "hello", "b": 123, "c": True})
        assert result["a"] == "hello"
        assert result["b"] == 123
        assert result["c"] is True

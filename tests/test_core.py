import json
from datetime import date, datetime
from decimal import Decimal

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
        assert from_text("123::L") == 123
        assert from_text("123::int") == 123

    def test_from_text_typed_float(self):
        assert from_text("123.45::R") == 123.45

    def test_from_text_typed_bool(self):
        assert from_text("true::B") is True
        assert from_text("false::B") is False

    def test_from_text_typed_str(self):
        assert from_text("hello::T") == "hello"

    def test_from_text_typed_json(self):
        assert from_text('{"a":"1::L"}::TYTX') == {"a": 1}

    def test_from_text_typed_decimal(self):
        assert from_text("123.45::N") == Decimal("123.45")

    def test_from_text_typed_date(self):
        assert from_text("2025-01-15::D") == date(2025, 1, 15)

    def test_from_text_typed_datetime(self):
        from datetime import timezone

        # DHZ is the canonical code (timezone-aware) - returns UTC datetime
        result = from_text("2025-01-15T10:00:00Z::DHZ")
        assert result == datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        # DHZ without Z suffix but with offset should still parse
        offset_dt = from_text("2025-01-15T12:00:00+02:00::DHZ")
        assert offset_dt.utcoffset().total_seconds() == 7200
        # DH is deprecated but still supported (naive datetime)
        assert from_text("2025-01-15T10:00:00::DH") == datetime(2025, 1, 15, 10, 0, 0)

    def test_from_text_typed_none(self):
        """NN type code returns None, ignoring content."""
        assert from_text("::NN") is None
        assert from_text("foo::NN") is None
        assert from_text("anything::NN") is None

    def test_from_text_no_type(self):
        """Without type suffix, tries JSON parsing, falls back to string."""
        assert from_text("123") == 123  # JSON parses as int
        assert from_text("hello") == "hello"  # Not valid JSON, returns string

    def test_from_text_explicit_type(self):
        """With explicit type_code parameter."""
        assert from_text("123", "L") == 123
        assert from_text("123.45", "N") == Decimal("123.45")
        assert from_text("2025-01-15", "D") == date(2025, 1, 15)


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
        # DHZ serializes with Z suffix
        assert as_text(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00Z"

    def test_as_text_json(self):
        assert as_text({"a": 1}) == '{"a": 1}'

    def test_as_text_str(self):
        assert as_text("hello") == "hello"

    def test_as_text_none(self):
        """None serializes to empty string."""
        assert as_text(None) == ""


class TestAsTypedText:
    """Tests for as_typed_text() - serialize with type."""

    def test_as_typed_text_int(self):
        assert as_typed_text(123) == "123::L"

    def test_as_typed_text_float(self):
        assert as_typed_text(123.45) == "123.45::R"

    def test_as_typed_text_bool(self):
        assert as_typed_text(True) == "true::B"
        assert as_typed_text(False) == "false::B"

    def test_as_typed_text_decimal(self):
        assert as_typed_text(Decimal("123.45")) == "123.45::N"

    def test_as_typed_text_date(self):
        assert as_typed_text(date(2025, 1, 15)) == "2025-01-15::D"

    def test_as_typed_text_datetime(self):
        # DHZ is the canonical code with Z suffix
        assert (
            as_typed_text(datetime(2025, 1, 15, 10, 0, 0))
            == "2025-01-15T10:00:00Z::DHZ"
        )

    def test_as_typed_text_json(self):
        assert as_typed_text({"a": 1}) == '{"a":"1::L"}::TYTX'

    def test_as_typed_text_str(self):
        """Strings are returned as-is (no type added)."""
        assert as_typed_text("hello") == "hello"

    def test_as_typed_text_none(self):
        """None serializes to ::NN."""
        assert as_typed_text(None) == "::NN"


class TestRegistryHelpers:
    """Tests for registry helper methods."""

    def test_is_typed(self):
        assert registry.is_typed("123::L") is True
        assert registry.is_typed("hello::T") is True
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
        assert (
            DateTimeType.sql_type == "TIMESTAMP WITH TIME ZONE"
        )  # DHZ is timezone-aware
        assert DateTimeType.empty is None
        assert DateTimeType.code == "DHZ"

    def test_none_attributes(self):
        from genro_tytx import NoneType

        assert NoneType.python_type is type(None)
        assert NoneType.code == "NN"
        assert NoneType.sql_type == "NULL"
        assert NoneType.empty is None

    def test_mnemonic_type_codes(self):
        """Test that mnemonic type codes work."""
        from datetime import timezone

        # Integer (L)
        assert from_text("123::L") == 123

        # Float (R)
        assert from_text("1.5::R") == 1.5

        # Boolean (B)
        assert from_text("true::B") is True

        # String/Text (T)
        assert from_text("hello::T") == "hello"

        # Decimal (N)
        assert from_text("100.50::N") == Decimal("100.50")

        # DateTime (DHZ is canonical, DH is deprecated)
        assert from_text("2025-01-15T10:00:00Z::DHZ") == datetime(
            2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc
        )
        assert from_text("2025-01-15T10:00:00::DH") == datetime(2025, 1, 15, 10, 0, 0)


class TestAsTextFormatting:
    """Tests for as_text() with format parameter."""

    def test_as_text_format_none_returns_iso(self):
        """format=None returns ISO/technical output."""
        assert as_text(date(2025, 1, 15)) == "2025-01-15"
        assert (
            as_text(datetime(2025, 1, 15, 10, 30, 0)) == "2025-01-15T10:30:00Z"
        )  # DHZ adds Z
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
        assert (
            as_text(datetime(2025, 1, 15, 10, 30), format="%Y-%m-%d %H:%M")
            == "2025-01-15 10:30"
        )

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
        assert "<root>10.50::N</root>" in xml

    def test_as_xml_simple(self):
        """Simple element without type suffix."""
        data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
        xml = as_xml(data)
        assert "<root>10.50</root>" in xml
        assert "::" not in xml

    def test_as_typed_xml_with_attrs(self):
        """Element with typed attributes."""
        data = {
            "root": {
                "attrs": {"id": 123, "price": Decimal("99.50")},
                "value": "content",
            }
        }
        xml = as_typed_xml(data)
        assert 'id="123::L"' in xml
        assert 'price="99.50::N"' in xml

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
        assert 'id="1::L"' in xml
        assert "<item>Widget</item>" in xml
        assert "<price>25.00::N</price>" in xml

    def test_from_xml_simple(self):
        """Parse simple XML to attrs/value structure."""
        xml = "<root>hello</root>"
        result = from_xml(xml)
        assert result == {"root": {"attrs": {}, "value": "hello"}}

    def test_from_xml_typed(self):
        """Parse XML with typed values."""
        xml = "<root>10.50::N</root>"
        result = from_xml(xml)
        assert result["root"]["value"] == Decimal("10.50")

    def test_from_xml_with_attrs(self):
        """Parse XML with attributes."""
        xml = '<root id="123::L" name="test">content</root>'
        result = from_xml(xml)
        assert result["root"]["attrs"]["id"] == 123
        assert result["root"]["attrs"]["name"] == "test"
        assert result["root"]["value"] == "content"

    def test_from_xml_nested(self):
        """Parse nested XML."""
        xml = "<order><item>Widget</item><price>25.00::N</price></order>"
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
        assert '"price": "99.99::N"' in result

    def test_as_typed_json_date(self):
        """as_typed_json converts date to typed string."""
        result = as_typed_json({"day": date(2025, 1, 15)})
        assert '"day": "2025-01-15::D"' in result

    def test_as_typed_json_datetime(self):
        """as_typed_json converts datetime to typed string with DHZ."""
        result = as_typed_json({"ts": datetime(2025, 1, 15, 10, 30)})
        assert '"ts": "2025-01-15T10:30:00Z::DHZ"' in result

    def test_as_typed_json_complex(self):
        """as_typed_json handles complex nested structures."""
        data = {
            "name": "Test",
            "price": Decimal("100.50"),
            "date": date(2025, 1, 15),
            "items": [1, 2, 3],
        }
        result = as_typed_json(data)
        assert '"price": "100.50::N"' in result
        assert '"date": "2025-01-15::D"' in result
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
        json_str = '{"price": "99.99::N", "count": "42::L"}'
        result = from_json(json_str)
        assert result["price"] == Decimal("99.99")
        assert result["count"] == 42

    def test_from_json_nested(self):
        """from_json handles nested structures."""
        json_str = '{"order": {"price": "100::N", "date": "2025-01-15::D"}}'
        result = from_json(json_str)
        assert result["order"]["price"] == Decimal("100")
        assert result["order"]["date"] == date(2025, 1, 15)

    def test_from_json_list(self):
        """from_json handles lists with typed values."""
        json_str = '{"prices": ["10::N", "20::N", "30::N"]}'
        result = from_json(json_str)
        assert result["prices"] == [Decimal("10"), Decimal("20"), Decimal("30")]

    def test_json_roundtrip(self):
        """Round-trip: as_typed_json then from_json returns original values."""
        from datetime import timezone

        original = {
            "price": Decimal("123.45"),
            "date": date(2025, 6, 15),
            "timestamp": datetime(
                2025, 6, 15, 14, 30, 0, tzinfo=timezone.utc
            ),  # Use UTC-aware
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


class TestEdgeCases:
    """Tests for edge cases and 100% coverage."""

    def test_registry_get_for_value(self):
        """Test registry.get_for_value method."""
        type_cls = registry.get_for_value(42)
        assert type_cls is not None
        assert type_cls.code == "L"

        type_cls = registry.get_for_value(Decimal("10"))
        assert type_cls is not None
        assert type_cls.code == "N"

        type_cls = registry.get_for_value("hello")
        assert type_cls is not None
        assert type_cls.code == "T"

    def test_from_text_unknown_explicit_type(self):
        """from_text with unknown explicit type returns original."""
        result = from_text("hello", "UNKNOWN")
        assert result == "hello"

    def test_as_text_unknown_type(self):
        """as_text with unknown type uses str()."""

        class CustomType:
            pass

        obj = CustomType()
        result = as_text(obj)
        assert "CustomType" in result

    def test_as_typed_text_unknown_type(self):
        """as_typed_text with unknown type uses str()."""

        class CustomType:
            pass

        obj = CustomType()
        result = as_typed_text(obj)
        assert "CustomType" in result
        assert "::" not in result  # No type suffix for unknown

    def test_xml_empty_element(self):
        """XML with None value produces self-closing tag."""
        data = {"empty": {"attrs": {}, "value": None}}
        xml = as_typed_xml(data)
        assert "<empty />" in xml or "<empty/>" in xml

    def test_xml_list_children(self):
        """XML with list of same-tag children."""
        data = {
            "items": {
                "attrs": {},
                "value": {
                    "item": [
                        {"attrs": {}, "value": "first"},
                        {"attrs": {}, "value": "second"},
                    ]
                },
            }
        }
        xml = as_typed_xml(data)
        assert "<item>first</item>" in xml
        assert "<item>second</item>" in xml

    def test_from_xml_empty_element(self):
        """Parse empty XML element."""
        xml = "<empty />"
        result = from_xml(xml)
        assert result["empty"]["value"] is None

    def test_from_xml_repeated_children(self):
        """Parse XML with repeated child tags."""
        xml = "<items><item>a</item><item>b</item></items>"
        result = from_xml(xml)
        # Repeated tags become a list
        items = result["items"]["value"]["item"]
        assert isinstance(items, list)
        assert len(items) == 2

    def test_from_xml_repeated_children_three_items(self):
        """Repeated tags beyond two keep appending to the existing list."""
        xml = "<items><item>a</item><item>b</item><item>c</item></items>"
        result = from_xml(xml)
        items = result["items"]["value"]["item"]
        assert isinstance(items, list)
        assert items[2]["value"] == "c"

    def test_as_typed_json_bool(self):
        """as_typed_json preserves native JSON booleans."""
        # Booleans are native JSON types, not converted to typed strings
        result = as_typed_json({"active": True, "deleted": False})
        assert "true" in result
        assert "false" in result

    def test_as_json_datetime(self):
        """as_json converts datetime to ISO string."""
        dt = datetime(2025, 1, 15, 10, 30, 0)
        result = as_json({"ts": dt})
        assert "2025-01-15" in result
        assert "::" not in result

    def test_datatype_format_none_uses_serialize(self):
        """DataType.format falls back to serialize when fmt is None."""
        from genro_tytx import StrType

        st = StrType()
        assert st.format("hello", None) == "hello"

    def test_register_type_without_python_type(self):
        """TypeRegistry.register skips python_type mapping when None."""
        from genro_tytx import TypeRegistry
        from genro_tytx.base import DataType

        class NoPythonType(DataType):
            name = "nop"
            code = "NP"
            python_type = None

            def parse(self, value: str):
                return value

            def serialize(self, value):
                return str(value)

        local_registry = TypeRegistry()
        local_registry.register(NoPythonType)

        assert local_registry.get("nop") is NoPythonType
        assert local_registry.get_for_value("anything") is None

    def test_type_code_for_string_returns_none(self):
        """_get_type_code_for_value returns None for plain strings."""
        from genro_tytx import TypeRegistry

        local_registry = TypeRegistry()
        assert local_registry._get_type_code_for_value("hello") is None

    def test_as_text_with_unregistered_type_code(self):
        """as_text/as_typed_text fall back when type is not registered."""
        from genro_tytx import TypeRegistry

        local_registry = TypeRegistry()

        assert local_registry.as_text(123) == "123"
        assert local_registry.as_typed_text(123) == "123"

    def test_set_locale_fallback_and_restore(self, monkeypatch):
        """_set_locale fallback path and _restore_locale error handling."""
        import genro_tytx.builtin as builtin

        calls: list[str] = []

        def fake_getlocale(_category):
            return ("en_US", "UTF-8")

        def fake_setlocale(_category, value):
            calls.append(value)
            if value.endswith(".UTF-8"):
                raise builtin.locale_module.Error("boom")
            return "ok"

        monkeypatch.setattr(builtin.locale_module, "getlocale", fake_getlocale)
        monkeypatch.setattr(builtin.locale_module, "setlocale", fake_setlocale)

        prev = builtin._set_locale("zz-ZZ")
        assert calls[:2] == ["zz_ZZ.UTF-8", "zz_ZZ"]
        assert prev == "en_US"

        builtin._restore_locale(prev)
        assert calls[-1] == "en_US"

    def test_restore_locale_error_branch(self, monkeypatch):
        """_restore_locale falls back to default locale when restore fails."""
        import genro_tytx.builtin as builtin

        calls: list[str] = []

        def failing_setlocale(_category, value):
            calls.append(value)
            if value == "broken":
                raise builtin.locale_module.Error("fail")
            return "ok"

        monkeypatch.setattr(builtin.locale_module, "setlocale", failing_setlocale)

        builtin._restore_locale("broken")
        assert calls == ["broken", ""]

    def test_set_locale_with_existing_encoding(self, monkeypatch):
        """_set_locale keeps provided encoding when already present."""
        import genro_tytx.builtin as builtin

        calls: list[str] = []

        monkeypatch.setattr(
            builtin.locale_module, "getlocale", lambda _category: ("C", "UTF-8")
        )
        monkeypatch.setattr(
            builtin.locale_module,
            "setlocale",
            lambda _category, value: calls.append(value) or "ok",
        )

        prev = builtin._set_locale("fr_FR.UTF-8")
        assert calls == ["fr_FR.UTF_8"]
        assert prev == "C"

    def test_format_with_locale_int(self):
        """Test integer formatting with locale."""
        from genro_tytx import IntType

        it = IntType()
        result = it.format(1234567, "%d")
        assert isinstance(result, str)

    def test_format_with_locale_decimal(self):
        """Test Decimal formatting with locale."""
        from genro_tytx import DecimalType

        dt = DecimalType()
        result = dt.format(Decimal("1234.56"), "%.2f")
        assert isinstance(result, str)

    def test_format_with_locale_date(self):
        """Test date formatting with locale."""
        from genro_tytx import DateType

        dt = DateType()
        result = dt.format(date(2025, 1, 15), "%Y-%m-%d")
        assert result == "2025-01-15"

    def test_format_with_locale_datetime(self):
        """Test datetime formatting with locale."""
        from genro_tytx import DateTimeType

        dtt = DateTimeType()
        result = dtt.format(datetime(2025, 1, 15, 10, 30), "%Y-%m-%d %H:%M")
        assert result == "2025-01-15 10:30"

    def test_format_true_without_default(self):
        """format=True on type without default_format."""
        from genro_tytx import StrType

        st = StrType()
        # StrType has no default_format, should fall back to serialize
        result = st.format("hello", True)
        assert result == "hello"

    def test_tytx_type_serialize(self):
        """TytxType serialize produces JSON string."""
        from genro_tytx import TytxType

        tt = TytxType()
        result = tt.serialize({"a": 1})
        assert result == '{"a": 1}'

    def test_tytx_type_parse(self):
        """TytxType parse returns dict/list with hydrated values."""
        from genro_tytx import TytxType

        tt = TytxType()
        result = tt.parse('{"a": "1::L"}')
        assert result == {"a": 1}

    def test_float_format_with_locale(self):
        """FloatType format with locale."""
        from genro_tytx import FloatType

        ft = FloatType()
        result = ft.format(1234.56, "%.2f")
        assert isinstance(result, str)

    def test_xml_root_tag_parameter(self):
        """as_typed_xml with explicit root_tag."""
        data = {"attrs": {"id": 1}, "value": "content"}
        xml = as_typed_xml(data, root_tag="custom")
        assert "<custom" in xml
        assert "</custom>" in xml

    def test_xml_invalid_content_raises(self):
        """XML build with invalid content raises ValueError."""
        import pytest

        data = {"root": "not a dict with attrs/value"}
        with pytest.raises(ValueError):
            as_typed_xml(data)

    def test_xml_multiple_roots_raises(self):
        """XML with multiple roots and no root_tag raises ValueError."""
        import pytest

        data = {"a": {"attrs": {}, "value": "x"}, "b": {"attrs": {}, "value": "y"}}
        with pytest.raises(ValueError):
            as_typed_xml(data)

    def test_from_xml_mixed_content(self):
        """Parse XML with mixed content (text + children)."""
        xml = "<root>text<child>inner</child></root>"
        result = from_xml(xml)
        # Mixed content: children dict has #text key
        assert "child" in result["root"]["value"]
        assert "#text" in result["root"]["value"]
        assert result["root"]["value"]["#text"] == "text"

    def test_json_encoder_type_error(self):
        """JSON encoder raises TypeError for non-serializable objects."""
        import pytest

        class NonSerializable:
            pass

        with pytest.raises(TypeError):
            as_typed_json({"obj": NonSerializable()})

    def test_json_standard_encoder_type_error(self):
        """Standard JSON encoder raises TypeError for non-serializable objects."""
        import pytest

        class NonSerializable:
            pass

        with pytest.raises(TypeError):
            as_json({"obj": NonSerializable()})

    def test_as_text_with_format_and_locale(self):
        """as_text with both format and locale parameters."""
        result = as_text(date(2025, 1, 15), format="%d/%m/%Y", locale="en_US")
        assert result == "15/01/2025"

    def test_bool_type_attributes(self):
        """BoolType has correct attributes."""
        from genro_tytx import BoolType

        assert BoolType.python_type is bool
        assert BoolType.empty is False

    def test_tytx_type_attributes(self):
        """TytxType has correct attributes."""
        from genro_tytx import TytxType

        assert TytxType.python_type is dict
        assert TytxType.js_type == "object"

    def test_float_type_attributes(self):
        """FloatType has correct attributes."""
        from genro_tytx import FloatType

        assert FloatType.python_type is float
        assert FloatType.empty == 0.0
        assert FloatType.align == "R"

    def test_registry_get_none(self):
        """registry.get returns None for unknown type."""
        assert registry.get("NONEXISTENT") is None

    def test_as_text_none_value(self):
        """as_text with None returns empty string (NN type)."""
        result = as_text(None)
        assert result == ""

    def test_as_typed_text_none_value(self):
        """as_typed_text with None returns '::NN'."""
        result = as_typed_text(None)
        assert result == "::NN"

    def test_xml_value_as_list_direct(self):
        """XML content value as list directly."""
        # This case: value is a list of items (same tag repeated)
        data = {
            "root": {
                "attrs": {},
                "value": {
                    "item": [
                        {"attrs": {"n": 1}, "value": "a"},
                        {"attrs": {"n": 2}, "value": "b"},
                        {"attrs": {"n": 3}, "value": "c"},
                    ]
                },
            }
        }
        xml = as_xml(data)
        assert xml.count("<item") == 3

    def test_format_with_explicit_locale(self):
        """Test formatting with explicit locale parameter."""
        from genro_tytx import DateType

        dt = DateType()
        # Use a simple format that doesn't depend on locale
        result = dt.format(date(2025, 1, 15), "%d-%m-%Y", locale="C")
        assert result == "15-01-2025"

    def test_as_text_list(self):
        """as_text with list value."""
        result = as_text([1, 2, 3])
        assert (
            result == '{"a": 1}'
            or "1, 2, 3" in result
            or "[1, 2, 3]" in result
            or result == "[1, 2, 3]"
        )

    def test_as_typed_text_list(self):
        """as_typed_text with list value serializes as TYTX with typed elements."""
        result = as_typed_text([1, 2, 3])
        assert "::TYTX" in result

    def test_xml_value_direct_list(self):
        """XML with value as direct list (same-tag children via value list)."""
        # When value is a list directly, each item becomes same-tag child
        # This is a less common pattern but should work
        data = {
            "items": {
                "attrs": {},
                "value": [
                    {"attrs": {"id": 1}, "value": "a"},
                    {"attrs": {"id": 2}, "value": "b"},
                ],
            }
        }
        xml = as_xml(data)
        # The list items become repeated <items> tags
        assert "<items" in xml

    def test_from_text_with_invalid_embedded_type(self):
        """from_text returns original string when embedded type is unknown."""
        result = from_text("hello::NOTAVALIDTYPE")
        assert result == "hello::NOTAVALIDTYPE"

    def test_datatype_base_format_with_locale_default(self):
        """Test DataType._format_with_locale default implementation."""
        from genro_tytx import StrType

        st = StrType()
        # StrType doesn't override _format_with_locale, so uses base
        result = st._format_with_locale("hello", "%s", "en_US")
        assert result == "hello"

    def test_as_text_string_type(self):
        """as_text with string returns the string itself."""
        result = as_text("hello world")
        assert result == "hello world"

    def test_as_typed_text_string_type(self):
        """as_typed_text with string returns the string (no type suffix)."""
        result = as_typed_text("hello world")
        assert result == "hello world"
        assert "::" not in result

    def test_format_int_with_locale(self):
        """IntType format with explicit locale."""
        from genro_tytx import IntType

        it = IntType()
        # Test format with None locale (uses system)
        result = it.format(1234, "%d", None)
        assert isinstance(result, str)

    def test_format_decimal_with_locale(self):
        """DecimalType format with explicit locale."""
        from genro_tytx import DecimalType

        dt = DecimalType()
        result = dt.format(Decimal("1234.56"), "%.2f", None)
        assert isinstance(result, str)


class TestMsgpackUtils:
    """Tests for MessagePack utilities (optional dependency)."""

    def test_msgpack_import_error(self):
        """Test ImportError when msgpack not installed."""
        import sys

        import pytest

        # Save original msgpack module if present
        original_msgpack = sys.modules.get("msgpack")

        # Remove msgpack from modules to simulate not installed
        if "msgpack" in sys.modules:
            del sys.modules["msgpack"]

        # Also need to reset the module's cached state
        from genro_tytx import msgpack_utils

        msgpack_utils._msgpack_available = None

        # Mock the import to fail
        import builtins

        original_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name == "msgpack":
                raise ImportError("No module named 'msgpack'")
            return original_import(name, *args, **kwargs)

        builtins.__import__ = mock_import

        try:
            with pytest.raises(ImportError, match="msgpack is required"):
                msgpack_utils.packb({"test": 1})
        finally:
            builtins.__import__ = original_import
            msgpack_utils._msgpack_available = None
            if original_msgpack:
                sys.modules["msgpack"] = original_msgpack

    def test_msgpack_packb_unpackb_roundtrip(self):
        """Test round-trip with msgpack pack/unpack."""
        from datetime import timezone

        pytest = __import__("pytest")
        pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import packb, unpackb

        data = {
            "price": Decimal("99.99"),
            "date": date(2025, 1, 15),
            "timestamp": datetime(
                2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc
            ),  # UTC-aware
            "count": 42,
            "name": "Test",
        }

        packed = packb(data)
        assert isinstance(packed, bytes)

        restored = unpackb(packed)
        assert restored["price"] == Decimal("99.99")
        assert restored["date"] == date(2025, 1, 15)
        assert restored["timestamp"] == datetime(
            2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc
        )
        assert restored["count"] == 42
        assert restored["name"] == "Test"

    def test_msgpack_nested_structures(self):
        """Test nested dicts and lists with TYTX types."""
        pytest = __import__("pytest")
        pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import packb, unpackb

        data = {
            "order": {
                "items": [
                    {"name": "Widget", "price": Decimal("25.00")},
                    {"name": "Gadget", "price": Decimal("75.50")},
                ],
                "total": Decimal("100.50"),
                "date": date(2025, 6, 15),
            }
        }

        packed = packb(data)
        restored = unpackb(packed)

        assert restored["order"]["total"] == Decimal("100.50")
        assert restored["order"]["date"] == date(2025, 6, 15)
        assert restored["order"]["items"][0]["price"] == Decimal("25.00")

    def test_msgpack_primitives_only(self):
        """Test that primitives don't use ExtType."""
        pytest = __import__("pytest")
        pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import packb, unpackb

        # Data with only primitives
        data = {"name": "Test", "count": 42, "active": True}

        packed = packb(data)
        restored = unpackb(packed)

        assert restored == data

    def test_msgpack_encoder_decoder_direct(self):
        """Test using tytx_encoder/tytx_decoder directly with msgpack."""
        pytest = __import__("pytest")
        msgpack = pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import tytx_decoder, tytx_encoder

        data = {"price": Decimal("50.00")}

        packed = msgpack.packb(data, default=tytx_encoder)
        restored = msgpack.unpackb(packed, ext_hook=tytx_decoder)

        assert restored["price"] == Decimal("50.00")

    def test_msgpack_ext_type_code(self):
        """Test that TYTX uses ExtType code 42."""
        pytest = __import__("pytest")
        msgpack = pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import TYTX_EXT_TYPE, tytx_encoder

        assert TYTX_EXT_TYPE == 42

        data = {"price": Decimal("10.00")}
        ext = tytx_encoder(data)

        assert isinstance(ext, msgpack.ExtType)
        assert ext.code == 42

    def test_msgpack_unknown_ext_type(self):
        """Test that unknown ExtType codes are returned as-is."""
        pytest = __import__("pytest")
        msgpack = pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import tytx_decoder

        # Create an ExtType with a different code
        result = tytx_decoder(99, b"some data")

        assert isinstance(result, msgpack.ExtType)
        assert result.code == 99
        assert result.data == b"some data"

    def test_msgpack_json_decode(self):
        """Test that ExtType(42) decodes JSON with typed values."""
        pytest = __import__("pytest")
        pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import tytx_decoder

        # ExtType(42) contains JSON with typed values (no TYTX:: prefix)
        data = b'{"price": "99.99::N"}'
        result = tytx_decoder(42, data)

        assert result["price"] == Decimal("99.99")

    def test_msgpack_encoder_non_serializable(self):
        """Test that encoder raises TypeError for non-TYTX types."""
        pytest = __import__("pytest")
        pytest.importorskip("msgpack")

        from genro_tytx.msgpack_utils import tytx_encoder

        class CustomType:
            pass

        with pytest.raises(TypeError, match="not MessagePack serializable"):
            tytx_encoder(CustomType())

    def test_msgpack_has_tytx_types_detection(self):
        """Test _has_tytx_types detection function."""
        pytest = __import__("pytest")
        pytest.importorskip("msgpack")

        from datetime import time

        from genro_tytx.msgpack_utils import _has_tytx_types

        # Types that should be detected
        assert _has_tytx_types(Decimal("10")) is True
        assert _has_tytx_types(date(2025, 1, 1)) is True
        assert _has_tytx_types(datetime(2025, 1, 1, 10, 0)) is True
        assert _has_tytx_types(time(10, 30)) is True

        # Nested detection
        assert _has_tytx_types({"price": Decimal("10")}) is True
        assert _has_tytx_types([Decimal("10")]) is True
        assert _has_tytx_types({"nested": {"deep": date(2025, 1, 1)}}) is True

        # Non-TYTX types
        assert _has_tytx_types("string") is False
        assert _has_tytx_types(42) is False
        assert _has_tytx_types({"name": "test"}) is False
        assert _has_tytx_types([1, 2, 3]) is False


class TestPydanticMsgpack:
    """Tests for TytxModel MessagePack support."""

    def test_tytx_model_msgpack_roundtrip(self):
        """Test TytxModel msgpack serialization round-trip."""
        pytest = __import__("pytest")
        pytest.importorskip("pydantic")
        pytest.importorskip("msgpack")

        from genro_tytx.pydantic import TytxModel

        class Order(TytxModel):
            price: Decimal
            order_date: date
            quantity: int
            name: str

        order = Order(
            price=Decimal("99.99"),
            order_date=date(2025, 1, 15),
            quantity=5,
            name="Widget",
        )

        # Serialize to msgpack
        packed = order.model_dump_msgpack()
        assert isinstance(packed, bytes)

        # Deserialize from msgpack
        restored = Order.model_validate_tytx_msgpack(packed)

        assert restored.price == Decimal("99.99")
        assert restored.order_date == date(2025, 1, 15)
        assert restored.quantity == 5
        assert restored.name == "Widget"

    def test_tytx_model_msgpack_with_datetime(self):
        """Test TytxModel msgpack with datetime field."""
        from datetime import timezone

        pytest = __import__("pytest")
        pytest.importorskip("pydantic")
        pytest.importorskip("msgpack")

        from genro_tytx.pydantic import TytxModel

        class Event(TytxModel):
            name: str
            timestamp: datetime
            amount: Decimal

        event = Event(
            name="Test Event",
            timestamp=datetime(
                2025, 6, 15, 14, 30, 0, tzinfo=timezone.utc
            ),  # UTC-aware
            amount=Decimal("1234.56"),
        )

        packed = event.model_dump_msgpack()
        restored = Event.model_validate_tytx_msgpack(packed)

        assert restored.name == "Test Event"
        assert restored.timestamp == datetime(
            2025, 6, 15, 14, 30, 0, tzinfo=timezone.utc
        )
        assert restored.amount == Decimal("1234.56")

    def test_tytx_model_msgpack_nested(self):
        """Test TytxModel msgpack with nested models."""
        pytest = __import__("pytest")
        pytest.importorskip("pydantic")
        pytest.importorskip("msgpack")

        from genro_tytx.pydantic import TytxModel

        class Item(TytxModel):
            name: str
            price: Decimal

        class Order(TytxModel):
            items: list[Item]
            total: Decimal

        order = Order(
            items=[
                Item(name="Widget", price=Decimal("25.00")),
                Item(name="Gadget", price=Decimal("75.50")),
            ],
            total=Decimal("100.50"),
        )

        packed = order.model_dump_msgpack()
        restored = Order.model_validate_tytx_msgpack(packed)

        assert restored.total == Decimal("100.50")
        assert len(restored.items) == 2
        assert restored.items[0].price == Decimal("25.00")

    def test_tytx_model_msgpack_import_error(self):
        """Test ImportError when msgpack not installed for TytxModel."""
        import sys

        pytest = __import__("pytest")
        pytest.importorskip("pydantic")

        from genro_tytx.pydantic import TytxModel

        class Simple(TytxModel):
            value: int

        obj = Simple(value=42)

        # Save original msgpack module if present
        original_msgpack = sys.modules.get("msgpack")

        # Remove msgpack from modules to simulate not installed
        if "msgpack" in sys.modules:
            del sys.modules["msgpack"]

        # Reset msgpack_utils cached state
        from genro_tytx import msgpack_utils

        msgpack_utils._msgpack_available = None

        # Mock the import to fail
        import builtins

        original_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name == "msgpack":
                raise ImportError("No module named 'msgpack'")
            return original_import(name, *args, **kwargs)

        builtins.__import__ = mock_import

        try:
            with pytest.raises(ImportError, match="msgpack is required"):
                obj.model_dump_msgpack()
        finally:
            builtins.__import__ = original_import
            msgpack_utils._msgpack_available = None
            if original_msgpack:
                sys.modules["msgpack"] = original_msgpack


class TestTypedArrays:
    """Tests for typed arrays feature (compact_array parameter)."""

    def test_from_text_typed_array_int(self):
        """Parse typed array of integers."""
        result = from_text("[1,2,3]::#L")
        assert result == [1, 2, 3]
        assert all(isinstance(x, int) for x in result)

    def test_from_text_typed_array_nested(self):
        """Parse nested typed array."""
        result = from_text("[[1,2],[3,4]]::#L")
        assert result == [[1, 2], [3, 4]]
        assert all(isinstance(x, int) for row in result for x in row)

    def test_from_text_typed_array_float(self):
        """Parse typed array of floats."""
        result = from_text("[1.5,2.5,3.5]::#R")
        assert result == [1.5, 2.5, 3.5]
        assert all(isinstance(x, float) for x in result)

    def test_from_text_typed_array_decimal(self):
        """Parse typed array of decimals."""
        result = from_text("[1.5,2.5,3.5]::#N")
        assert result == [Decimal("1.5"), Decimal("2.5"), Decimal("3.5")]
        assert all(isinstance(x, Decimal) for x in result)

    def test_from_text_typed_array_bool(self):
        """Parse typed array of booleans."""
        result = from_text("[true,false,true]::#B")
        assert result == [True, False, True]
        assert all(isinstance(x, bool) for x in result)

    def test_from_text_typed_array_date(self):
        """Parse typed array of dates."""
        result = from_text('["2025-01-15","2025-01-16"]::#D')
        assert result == [date(2025, 1, 15), date(2025, 1, 16)]
        assert all(isinstance(x, date) for x in result)

    def test_as_typed_text_compact_array_int(self):
        """Serialize homogeneous int array with compact_array=True."""
        result = as_typed_text([1, 2, 3], compact_array=True)
        # Values are serialized as strings for consistency with other types
        assert result == '["1","2","3"]::#L'

    def test_as_typed_text_compact_array_nested(self):
        """Serialize nested homogeneous array with compact_array=True."""
        result = as_typed_text([[1, 2], [3, 4]], compact_array=True)
        assert result == '[["1","2"],["3","4"]]::#L'

    def test_as_typed_text_compact_array_float(self):
        """Serialize homogeneous float array with compact_array=True."""
        result = as_typed_text([1.5, 2.5, 3.5], compact_array=True)
        assert result == '["1.5","2.5","3.5"]::#R'

    def test_as_typed_text_compact_array_decimal(self):
        """Serialize homogeneous decimal array with compact_array=True."""
        result = as_typed_text([Decimal("1.5"), Decimal("2.5")], compact_array=True)
        assert result == '["1.5","2.5"]::#N'

    def test_as_typed_text_compact_array_bool(self):
        """Serialize homogeneous bool array with compact_array=True."""
        result = as_typed_text([True, False, True], compact_array=True)
        assert result == '["true","false","true"]::#B'

    def test_as_typed_text_compact_array_date(self):
        """Serialize homogeneous date array with compact_array=True."""
        result = as_typed_text(
            [date(2025, 1, 15), date(2025, 1, 16)], compact_array=True
        )
        assert result == '["2025-01-15","2025-01-16"]::#D'

    def test_as_typed_text_compact_array_empty(self):
        """Empty array returns [] without type."""
        result = as_typed_text([], compact_array=True)
        assert result == "[]"

    def test_as_typed_text_compact_array_heterogeneous_fallback(self):
        """Heterogeneous array falls back to element-by-element typing with ::TYTX suffix."""
        result = as_typed_text([1, "hello", 2], compact_array=True)
        # Should type each element individually with ::TYTX suffix
        assert result == '["1::L","hello","2::L"]::TYTX'

    def test_as_typed_text_compact_array_mixed_types_fallback(self):
        """Mixed numeric types (int and float) falls back to element-by-element."""
        result = as_typed_text([1, 2.5, 3], compact_array=True)
        # L and R are different types, so fallback with ::TYTX suffix
        assert result == '["1::L","2.5::R","3::L"]::TYTX'

    def test_as_typed_text_without_compact_array(self):
        """Without compact_array, arrays become TYTX with typed elements."""
        result = as_typed_text([1, 2, 3])
        assert result == '["1::L","2::L","3::L"]::TYTX'

    def test_roundtrip_typed_array_int(self):
        """Roundtrip test for typed int array."""
        original = [1, 2, 3]
        serialized = as_typed_text(original, compact_array=True)
        restored = from_text(serialized)
        assert restored == original

    def test_roundtrip_typed_array_nested(self):
        """Roundtrip test for nested typed array."""
        original = [[1, 2], [3, 4]]
        serialized = as_typed_text(original, compact_array=True)
        restored = from_text(serialized)
        assert restored == original

    def test_roundtrip_typed_array_float(self):
        """Roundtrip test for typed float array."""
        original = [1.5, 2.5, 3.5]
        serialized = as_typed_text(original, compact_array=True)
        restored = from_text(serialized)
        assert restored == original

    def test_roundtrip_typed_array_decimal(self):
        """Roundtrip test for typed decimal array."""
        original = [Decimal("1.5"), Decimal("2.5")]
        serialized = as_typed_text(original, compact_array=True)
        restored = from_text(serialized)
        assert restored == original

    # Tests for lists with typed objects without compact_array (Issue #21)

    def test_as_typed_text_list_of_dates_no_compact(self):
        """List of dates without compact_array should serialize with ::TYTX suffix."""
        dates = [date(2025, 1, 15), date(2025, 6, 20), date(2025, 12, 25)]
        result = as_typed_text(dates)
        assert result == '["2025-01-15::D","2025-06-20::D","2025-12-25::D"]::TYTX'

    def test_as_typed_text_list_of_decimals_no_compact(self):
        """List of Decimals without compact_array should serialize with ::TYTX suffix."""
        decimals = [Decimal("1.5"), Decimal("2.5")]
        result = as_typed_text(decimals)
        assert result == '["1.5::N","2.5::N"]::TYTX'

    def test_as_typed_text_nested_list_of_dates_no_compact(self):
        """Nested list of dates without compact_array."""
        dates = [[date(2025, 1, 1)], [date(2025, 2, 1)]]
        result = as_typed_text(dates)
        assert result == '[["2025-01-01::D"],["2025-02-01::D"]]::TYTX'

    def test_as_typed_text_mixed_list_no_compact(self):
        """Mixed list (int + date) without compact_array."""
        mixed = [1, date(2025, 1, 1), "hello"]
        result = as_typed_text(mixed)
        assert result == '["1::L","2025-01-01::D","hello"]::TYTX'

    def test_as_typed_text_pure_json_list_no_compact(self):
        """List of ints should serialize with typed elements and ::TYTX suffix."""
        result = as_typed_text([1, 2, 3])
        assert result == '["1::L","2::L","3::L"]::TYTX'

    def test_as_typed_text_pure_json_list_strings_no_compact(self):
        """List of strings should serialize without type markers."""
        result = as_typed_text(["a", "b", "c"])
        assert result == '["a","b","c"]::TYTX'

    # Tests for dicts with typed objects (Issue #22)

    def test_as_typed_text_dict_with_decimals(self):
        """Dict with Decimal values should serialize with ::TYTX suffix."""
        d = {"test": Decimal("33.33"), "best": Decimal("44.55")}
        result = as_typed_text(d)
        assert result == '{"test":"33.33::N","best":"44.55::N"}::TYTX'

    def test_as_typed_text_dict_with_dates(self):
        """Dict with date values should serialize with ::TYTX suffix."""
        d = {"start": date(2025, 1, 1), "end": date(2025, 12, 31)}
        result = as_typed_text(d)
        assert result == '{"start":"2025-01-01::D","end":"2025-12-31::D"}::TYTX'

    def test_as_typed_text_dict_mixed_values(self):
        """Dict with mixed typed and plain values."""
        d = {"name": "test", "amount": Decimal("100.00"), "count": 5}
        result = as_typed_text(d)
        assert result == '{"name":"test","amount":"100.00::N","count":"5::L"}::TYTX'

    def test_as_typed_text_dict_nested(self):
        """Nested dict with typed values."""
        d = {"outer": {"inner": Decimal("1.5")}}
        result = as_typed_text(d)
        assert result == '{"outer":{"inner":"1.5::N"}}::TYTX'

    def test_as_typed_text_pure_json_dict(self):
        """Pure JSON dict (no typed objects) should use ::TYTX suffix."""
        result = as_typed_text({"a": 1, "b": "hello"})
        assert result == '{"a":"1::L","b":"hello"}::TYTX'


import pytest


class TestAsTextFromTextRoundtrip:
    """Test as_text/from_text roundtrip behavior.

    Demonstrates that:
    - JSON-native types roundtrip correctly
    - Non-JSON types lose type information without :: markers

    This proves the need for as_typed_text with ::TYTX markers.
    """

    # (original, expected_after_roundtrip)
    ROUNDTRIP_CASES = [
        # JSON-native types: roundtrip preserves value and type
        (42, 42),
        (3.14, 3.14),
        (True, True),
        (False, False),
        ("hello", "hello"),
        ([1, 2, 3], [1, 2, 3]),
        (["a", "b"], ["a", "b"]),
        ({"a": 1}, {"a": 1}),
        ({"nested": {"x": 1}}, {"nested": {"x": 1}}),
        # Non-JSON types: type is LOST
        (Decimal("99.99"), 99.99),
        (date(2025, 1, 15), "2025-01-15"),
    ]

    @pytest.mark.parametrize("original,expected", ROUNDTRIP_CASES)
    def test_roundtrip(self, original, expected):
        assert from_text(as_text(original)) == expected


class TestAsTypedTextFromTextRoundtrip:
    """Test as_typed_text/from_text roundtrip behavior.

    All types should roundtrip perfectly with typed markers.
    """

    TYPED_ROUNDTRIP_CASES = [
        # Scalars
        42,
        3.14,
        True,
        False,
        "hello",
        Decimal("99.99"),
        date(2025, 1, 15),
        # Lists
        [1, 2, 3],
        ["a", "b"],
        [Decimal("10.5"), date(2025, 6, 1)],
        # Dicts
        {"a": 1, "b": "test"},
        {"name": "Mario", "age": 30, "balance": Decimal("100.50")},
        # Nested
        {"nested": {"x": 1}},
        [[1.5, 2.5], [3.0, 4.0]],
    ]

    @pytest.mark.parametrize("value", TYPED_ROUNDTRIP_CASES)
    def test_typed_roundtrip(self, value):
        """as_typed_text -> from_text should preserve value exactly."""
        assert from_text(as_typed_text(value)) == value


class TestAsJsonFromJsonRoundtrip:
    """Test as_json/from_json roundtrip behavior.

    Demonstrates that:
    - JSON-native types roundtrip correctly
    - Non-JSON types lose type information
    """

    # (original, expected_after_roundtrip)
    JSON_ROUNDTRIP_CASES = [
        (42, 42),
        (3.14, 3.14),
        (True, True),
        (False, False),
        ("hello", "hello"),
        ([1, 2, 3], [1, 2, 3]),
        ({"a": 1}, {"a": 1}),
        # Non-JSON types: type is LOST
        (Decimal("99.99"), 99.99),
        (date(2025, 1, 15), "2025-01-15"),
    ]

    @pytest.mark.parametrize("original,expected", JSON_ROUNDTRIP_CASES)
    def test_json_roundtrip(self, original, expected):
        """as_json -> from_json loses type for non-JSON types."""
        assert from_json(as_json(original)) == expected


class TestAsTypedJsonFromJsonRoundtrip:
    """Test as_typed_json/from_json roundtrip behavior.

    All types should roundtrip perfectly with typed markers.
    """

    TYPED_JSON_ROUNDTRIP_CASES = [
        # Scalars
        42,
        3.14,
        True,
        False,
        "hello",
        Decimal("99.99"),
        date(2025, 1, 15),
        # Lists
        [1, 2, 3],
        ["a", "b"],
        [Decimal("10.5"), date(2025, 6, 1)],
        # Dicts (struct-like)
        {"a": 1, "b": "test"},
        {"name": "Mario", "age": 30, "balance": Decimal("100.50")},
        # Nested
        {"nested": {"x": 1}},
        [[1.5, 2.5], [3.0, 4.0]],
        # Array of dicts
        [
            {"name": "Mario", "balance": Decimal("100.50")},
            {"name": "Luigi", "balance": Decimal("50.00")},
        ],
    ]

    @pytest.mark.parametrize("value", TYPED_JSON_ROUNDTRIP_CASES)
    def test_typed_json_roundtrip(self, value):
        """as_typed_json -> from_json should preserve value exactly."""
        assert from_json(as_typed_json(value)) == value

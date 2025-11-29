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
        assert from_text('{"a":1}::JS') == {"a": 1}

    def test_from_text_typed_decimal(self):
        assert from_text("123.45::N") == Decimal("123.45")

    def test_from_text_typed_date(self):
        assert from_text("2025-01-15::D") == date(2025, 1, 15)

    def test_from_text_typed_datetime(self):
        assert from_text("2025-01-15T10:00:00::DH") == datetime(2025, 1, 15, 10, 0, 0)

    def test_from_text_no_type(self):
        """Without type suffix, returns string as-is."""
        assert from_text("123") == "123"

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
        assert as_text(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00"

    def test_as_text_json(self):
        assert as_text({"a": 1}) == '{"a": 1}'

    def test_as_text_str(self):
        assert as_text("hello") == "hello"


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
        assert as_typed_text(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00::DH"

    def test_as_typed_text_json(self):
        assert as_typed_text({"a": 1}) == '{"a": 1}::JS'

    def test_as_typed_text_str(self):
        """Strings are returned as-is (no type added)."""
        assert as_typed_text("hello") == "hello"


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
        assert "<root>10.50::N</root>" in xml

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
        """as_typed_json converts datetime to typed string."""
        result = as_typed_json({"ts": datetime(2025, 1, 15, 10, 30)})
        assert '"ts": "2025-01-15T10:30:00::DH"' in result

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
                }
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

        monkeypatch.setattr(builtin.locale_module, "getlocale", lambda _category: ("C", "UTF-8"))
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

    def test_json_type_serialize(self):
        """JsonType serialize produces JSON string."""
        from genro_tytx import JsonType
        jt = JsonType()
        result = jt.serialize({"a": 1})
        assert result == '{"a": 1}'

    def test_json_type_parse(self):
        """JsonType parse returns dict/list."""
        from genro_tytx import JsonType
        jt = JsonType()
        result = jt.parse('{"a": 1}')
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

    def test_json_type_attributes(self):
        """JsonType has correct attributes."""
        from genro_tytx import JsonType
        assert JsonType.python_type is dict
        assert JsonType.js_type == "object"

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
        """as_text with None returns 'None'."""
        result = as_text(None)
        assert result == "None"

    def test_as_typed_text_none_value(self):
        """as_typed_text with None returns 'None'."""
        result = as_typed_text(None)
        assert result == "None"

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
                }
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
        assert result == '{"a": 1}' or "1, 2, 3" in result or "[1, 2, 3]" in result or result == '[1, 2, 3]'

    def test_as_typed_text_list(self):
        """as_typed_text with list value serializes as JSON."""
        result = as_typed_text([1, 2, 3])
        assert "::JS" in result

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
                ]
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

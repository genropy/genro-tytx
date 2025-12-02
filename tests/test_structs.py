"""Tests for struct schema functionality."""

from datetime import date
from decimal import Decimal

import pytest
from genro_tytx import from_text, registry


class TestRegisterStruct:
    """Tests for register_struct and basic struct registration."""

    def test_register_struct_dict_schema(self):
        """Dict schema for keyed types."""
        registry.register_struct("CUSTOMER", {"name": "T", "balance": "N"})
        schema = registry.get_struct("CUSTOMER")
        assert schema == {"name": "T", "balance": "N"}
        # Cleanup
        registry.unregister_struct("CUSTOMER")

    def test_register_struct_list_schema(self):
        """List schema for positional types."""
        registry.register_struct("ROW", ["T", "L", "N"])
        schema = registry.get_struct("ROW")
        assert schema == ["T", "L", "N"]
        # Cleanup
        registry.unregister_struct("ROW")

    def test_unregister_struct(self):
        """Unregistering removes from both _structs and _codes."""
        registry.register_struct("TEMP", ["L"])
        assert registry.get_struct("TEMP") is not None
        assert registry.get("@TEMP") is not None
        registry.unregister_struct("TEMP")
        assert registry.get_struct("TEMP") is None
        assert registry.get("@TEMP") is None


class TestStructDictSchema:
    """Tests for dict schema parsing."""

    def test_parse_dict_struct(self):
        """Dict schema applies types to matching keys."""
        registry.register_struct("CUSTOMER", {"name": "T", "balance": "N", "created": "D"})
        try:
            result = from_text(
                '{"name": "Acme", "balance": "100.50", "created": "2025-01-15"}::@CUSTOMER'
            )
            assert result == {
                "name": "Acme",
                "balance": Decimal("100.50"),
                "created": date(2025, 1, 15),
            }
        finally:
            registry.unregister_struct("CUSTOMER")

    def test_dict_schema_extra_keys(self):
        """Extra keys in data are passed through unchanged."""
        registry.register_struct("ITEM", {"price": "N"})
        try:
            result = from_text('{"price": "99.99", "note": "test"}::@ITEM')
            assert result == {"price": Decimal("99.99"), "note": "test"}
        finally:
            registry.unregister_struct("ITEM")

    def test_dict_schema_missing_keys(self):
        """Missing keys in data don't cause errors."""
        registry.register_struct("FULL", {"a": "L", "b": "L", "c": "L"})
        try:
            result = from_text('{"a": 1}::@FULL')
            assert result == {"a": 1}
        finally:
            registry.unregister_struct("FULL")


class TestStructListSchemaPositional:
    """Tests for positional list schema (len > 1)."""

    def test_parse_positional_list(self):
        """Positional schema applies type at index i to data[i]."""
        registry.register_struct("ROW", ["T", "L", "N"])
        try:
            result = from_text('["Product", 2, "100.50"]::@ROW')
            assert result == ["Product", 2, Decimal("100.50")]
        finally:
            registry.unregister_struct("ROW")

    def test_positional_array_of_rows(self):
        """Array of arrays: apply positional to each sub-array."""
        registry.register_struct("ROW", ["T", "L", "N"])
        try:
            result = from_text('[["A", 1, "10"], ["B", 2, "20"]]::@ROW')
            assert result == [
                ["A", 1, Decimal("10")],
                ["B", 2, Decimal("20")],
            ]
        finally:
            registry.unregister_struct("ROW")


class TestStructListSchemaHomogeneous:
    """Tests for homogeneous list schema (len == 1)."""

    def test_parse_homogeneous_list(self):
        """Single-element schema applies type to all elements."""
        registry.register_struct("PRICES", ["N"])
        try:
            result = from_text('[100, 200, "50.25"]::@PRICES')
            assert result == [Decimal("100"), Decimal("200"), Decimal("50.25")]
        finally:
            registry.unregister_struct("PRICES")

    def test_homogeneous_empty_array(self):
        """Empty array returns empty list."""
        registry.register_struct("NUMS", ["L"])
        try:
            result = from_text("[]::@NUMS")
            assert result == []
        finally:
            registry.unregister_struct("NUMS")

    def test_homogeneous_nested_2d(self):
        """2D array: apply type to all leaf values."""
        registry.register_struct("MATRIX", ["N"])
        try:
            result = from_text("[[1, 2], [3, 4]]::@MATRIX")
            assert result == [
                [Decimal("1"), Decimal("2")],
                [Decimal("3"), Decimal("4")],
            ]
        finally:
            registry.unregister_struct("MATRIX")


class TestStructNested:
    """Tests for nested struct references."""

    def test_nested_struct_in_dict(self):
        """Dict schema referencing another struct."""
        registry.register_struct("ADDRESS", {"city": "T", "zip": "L"})
        registry.register_struct("PERSON", {"name": "T", "addr": "@ADDRESS"})
        try:
            result = from_text('{"name": "John", "addr": {"city": "Rome", "zip": 12345}}::@PERSON')
            assert result == {
                "name": "John",
                "addr": {"city": "Rome", "zip": 12345},
            }
        finally:
            registry.unregister_struct("PERSON")
            registry.unregister_struct("ADDRESS")

    def test_array_of_structs(self):
        """Homogeneous array of structs."""
        registry.register_struct("ROW", ["T", "L"])
        registry.register_struct("ROWS", ["@ROW"])
        try:
            result = from_text('[["A", 1], ["B", 2]]::@ROWS')
            assert result == [["A", 1], ["B", 2]]
        finally:
            registry.unregister_struct("ROWS")
            registry.unregister_struct("ROW")


class TestStructStringSchema:
    """Tests for string schema syntax with explicit field order."""

    def test_register_string_schema_named(self):
        """String schema with names is stored as string."""
        registry.register_struct("POINT", "x:R,y:R")
        schema = registry.get_struct("POINT")
        assert schema == "x:R,y:R"
        registry.unregister_struct("POINT")

    def test_register_string_schema_anonymous(self):
        """String schema without names is stored as string."""
        registry.register_struct("COORDS", "R,R")
        schema = registry.get_struct("COORDS")
        assert schema == "R,R"
        registry.unregister_struct("COORDS")

    def test_parse_named_string_schema_to_dict(self):
        """Named string schema (x:R,y:R) produces dict output."""
        registry.register_struct("POINT", "x:R,y:R")
        try:
            result = from_text('["3.7", "7.3"]::@POINT')
            assert result == {"x": 3.7, "y": 7.3}
        finally:
            registry.unregister_struct("POINT")

    def test_parse_anonymous_string_schema_to_list(self):
        """Anonymous string schema (R,R) produces list output."""
        registry.register_struct("COORDS", "R,R")
        try:
            result = from_text('["3.7", "7.3"]::@COORDS')
            assert result == [3.7, 7.3]
        finally:
            registry.unregister_struct("COORDS")

    def test_string_schema_preserves_order(self):
        """String schema guarantees field order for CSV-like data."""
        registry.register_struct("ROW", "name:T,qty:L,price:N")
        try:
            result = from_text('["Widget", "10", "99.99"]::@ROW')
            assert result == {"name": "Widget", "qty": 10, "price": Decimal("99.99")}
            # Verify key order (Python 3.7+ dicts preserve insertion order)
            assert list(result.keys()) == ["name", "qty", "price"]
        finally:
            registry.unregister_struct("ROW")

    def test_string_schema_batch_mode(self):
        """String schema with array of arrays (batch/CSV) using #@STRUCT syntax."""
        registry.register_struct("ROW", "name:T,qty:L,price:N")
        try:
            # Batch mode requires explicit #@ prefix
            result = from_text('[["A", "1", "10"], ["B", "2", "20"]]::#@ROW')
            assert result == [
                {"name": "A", "qty": 1, "price": Decimal("10")},
                {"name": "B", "qty": 2, "price": Decimal("20")},
            ]
        finally:
            registry.unregister_struct("ROW")

    def test_anonymous_string_schema_batch_mode(self):
        """Anonymous string schema with array of arrays using #@STRUCT syntax."""
        registry.register_struct("PAIR", "R,R")
        try:
            # Batch mode requires explicit #@ prefix
            result = from_text('[["1.5", "2.5"], ["3.5", "4.5"]]::#@PAIR')
            assert result == [[1.5, 2.5], [3.5, 4.5]]
        finally:
            registry.unregister_struct("PAIR")

    def test_string_schema_with_date_types(self):
        """String schema with date type."""
        registry.register_struct("EVENT", "name:T,date:D")
        try:
            result = from_text('["Meeting", "2025-01-15"]::@EVENT')
            assert result == {"name": "Meeting", "date": date(2025, 1, 15)}
        finally:
            registry.unregister_struct("EVENT")

    def test_string_schema_spaces_in_definition(self):
        """String schema with spaces around colons and commas."""
        registry.register_struct("POINT", "x : R , y : R")
        try:
            result = from_text('["1.0", "2.0"]::@POINT')
            assert result == {"x": 1.0, "y": 2.0}
        finally:
            registry.unregister_struct("POINT")


class TestStructV2ObjectSyntax:
    """Tests for struct v2 object-style field definitions."""

    def test_v2_simple_string_fields(self):
        """Simple string type codes still work (backward compatible)."""
        registry.register_struct("SIMPLE", {"name": "T", "age": "L"})
        try:
            result = from_text('{"name": "John", "age": "30"}::@SIMPLE')
            assert result == {"name": "John", "age": 30}
        finally:
            registry.unregister_struct("SIMPLE")

    def test_v2_object_field_type_only(self):
        """Object field with only type key."""
        registry.register_struct("OBJ_TYPE", {"name": {"type": "T"}, "price": {"type": "N"}})
        try:
            result = from_text('{"name": "Widget", "price": "99.99"}::@OBJ_TYPE')
            assert result == {"name": "Widget", "price": Decimal("99.99")}
        finally:
            registry.unregister_struct("OBJ_TYPE")

    def test_v2_object_field_with_validate(self):
        """Object field with validate section (metadata preserved in schema)."""
        registry.register_struct(
            "WITH_VALIDATE",
            {
                "name": {"type": "T", "validate": {"min": 1, "max": 100}},
                "age": {"type": "L", "validate": {"min": 0, "max": 120}},
            },
        )
        try:
            # Parsing should still work - validate is metadata
            result = from_text('{"name": "Alice", "age": "25"}::@WITH_VALIDATE')
            assert result == {"name": "Alice", "age": 25}
        finally:
            registry.unregister_struct("WITH_VALIDATE")

    def test_v2_object_field_with_ui(self):
        """Object field with ui section."""
        registry.register_struct(
            "WITH_UI",
            {
                "email": {
                    "type": "T",
                    "ui": {"label": "Email Address", "placeholder": "user@example.com"},
                }
            },
        )
        try:
            result = from_text('{"email": "test@test.com"}::@WITH_UI')
            assert result == {"email": "test@test.com"}
        finally:
            registry.unregister_struct("WITH_UI")

    def test_v2_object_field_full(self):
        """Object field with type, validate, and ui sections."""
        registry.register_struct(
            "FULL_FIELD",
            {
                "username": {
                    "type": "T",
                    "validate": {"min": 3, "max": 50, "pattern": "^[a-z0-9_]+$"},
                    "ui": {"label": "Username", "hint": "Only lowercase letters and numbers"},
                },
                "balance": {
                    "type": "N",
                    "validate": {"min": 0},
                    "ui": {"label": "Balance", "format": "currency", "readonly": True},
                },
            },
        )
        try:
            result = from_text('{"username": "john_doe", "balance": "1000.50"}::@FULL_FIELD')
            assert result == {"username": "john_doe", "balance": Decimal("1000.50")}
        finally:
            registry.unregister_struct("FULL_FIELD")

    def test_v2_mixed_string_and_object_fields(self):
        """Mix of string and object field definitions."""
        registry.register_struct(
            "MIXED",
            {
                "id": "L",  # Simple string
                "name": {"type": "T", "ui": {"label": "Full Name"}},  # Object
                "active": "B",  # Simple string
            },
        )
        try:
            result = from_text('{"id": "123", "name": "Test", "active": "true"}::@MIXED')
            assert result == {"id": 123, "name": "Test", "active": True}
        finally:
            registry.unregister_struct("MIXED")

    def test_v2_list_schema_with_objects(self):
        """List schema with object field definitions."""
        registry.register_struct(
            "ROW_V2",
            [
                {"type": "T", "ui": {"label": "Name"}},
                {"type": "L", "validate": {"min": 0}},
                {"type": "N", "ui": {"format": "currency"}},
            ],
        )
        try:
            result = from_text('["Product", "10", "99.99"]::@ROW_V2')
            assert result == ["Product", 10, Decimal("99.99")]
        finally:
            registry.unregister_struct("ROW_V2")

    def test_v2_list_schema_mixed(self):
        """List schema with mixed string and object fields."""
        registry.register_struct(
            "ROW_MIXED",
            [
                "T",  # Simple string
                {"type": "L", "validate": {"min": 1}},  # Object
                "N",  # Simple string
            ],
        )
        try:
            result = from_text('["Item", "5", "50.00"]::@ROW_MIXED')
            assert result == ["Item", 5, Decimal("50.00")]
        finally:
            registry.unregister_struct("ROW_MIXED")

    def test_v2_homogeneous_list_with_object(self):
        """Homogeneous list schema with object field."""
        registry.register_struct("PRICES_V2", [{"type": "N", "validate": {"min": 0}}])
        try:
            result = from_text('["10.00", "20.50", "30.99"]::@PRICES_V2')
            assert result == [Decimal("10.00"), Decimal("20.50"), Decimal("30.99")]
        finally:
            registry.unregister_struct("PRICES_V2")

    def test_v2_nested_struct_in_object_field(self):
        """Object field referencing another struct."""
        registry.register_struct(
            "ADDR_V2", {"city": {"type": "T", "ui": {"label": "City"}}, "zip": "L"}
        )
        registry.register_struct(
            "PERSON_V2",
            {"name": {"type": "T", "validate": {"min": 1}}, "address": {"type": "@ADDR_V2"}},
        )
        try:
            result = from_text(
                '{"name": "John", "address": {"city": "Rome", "zip": "12345"}}::@PERSON_V2'
            )
            assert result == {"name": "John", "address": {"city": "Rome", "zip": 12345}}
        finally:
            registry.unregister_struct("PERSON_V2")
            registry.unregister_struct("ADDR_V2")

    def test_v2_object_field_default_type(self):
        """Object field without type defaults to T (text)."""
        registry.register_struct(
            "DEFAULT_TYPE",
            {
                "note": {"ui": {"label": "Notes"}}  # No type specified
            },
        )
        try:
            result = from_text('{"note": "Hello"}::@DEFAULT_TYPE')
            assert result == {"note": "Hello"}
        finally:
            registry.unregister_struct("DEFAULT_TYPE")


class TestFieldHelperFunctions:
    """Tests for get_field_type, get_field_validate, get_field_ui helpers."""

    def test_get_field_type_from_string(self):
        """get_field_type returns the string directly for string fields."""
        from genro_tytx import get_field_type

        assert get_field_type("T") == "T"
        assert get_field_type("N") == "N"
        assert get_field_type("@PERSON") == "@PERSON"

    def test_get_field_type_from_object(self):
        """get_field_type extracts type from object field."""
        from genro_tytx import get_field_type

        assert get_field_type({"type": "T"}) == "T"
        assert get_field_type({"type": "N", "validate": {"min": 0}}) == "N"
        assert get_field_type({"type": "@ADDR", "ui": {"label": "Address"}}) == "@ADDR"

    def test_get_field_type_default(self):
        """get_field_type returns 'T' when type is not specified."""
        from genro_tytx import get_field_type

        assert get_field_type({"ui": {"label": "Notes"}}) == "T"
        assert get_field_type({}) == "T"
        assert get_field_type({"validate": {"min": 1}}) == "T"

    def test_get_field_validate_from_string(self):
        """get_field_validate returns None for string fields."""
        from genro_tytx import get_field_validate

        assert get_field_validate("T") is None
        assert get_field_validate("N[min:0]") is None  # Old syntax, no parsing

    def test_get_field_validate_from_object(self):
        """get_field_validate extracts validate section from object field."""
        from genro_tytx import get_field_validate

        validate = get_field_validate(
            {"type": "T", "validate": {"min": 1, "max": 100, "pattern": "^[a-z]+$"}}
        )
        assert validate == {"min": 1, "max": 100, "pattern": "^[a-z]+$"}

    def test_get_field_validate_missing(self):
        """get_field_validate returns None when validate not present."""
        from genro_tytx import get_field_validate

        assert get_field_validate({"type": "T"}) is None
        assert get_field_validate({"type": "T", "ui": {"label": "Name"}}) is None

    def test_get_field_ui_from_string(self):
        """get_field_ui returns None for string fields."""
        from genro_tytx import get_field_ui

        assert get_field_ui("T") is None
        assert get_field_ui("T[lbl:Name]") is None  # Old syntax, no parsing

    def test_get_field_ui_from_object(self):
        """get_field_ui extracts ui section from object field."""
        from genro_tytx import get_field_ui

        ui = get_field_ui(
            {
                "type": "T",
                "ui": {"label": "Full Name", "placeholder": "Enter name", "readonly": True},
            }
        )
        assert ui == {"label": "Full Name", "placeholder": "Enter name", "readonly": True}

    def test_get_field_ui_missing(self):
        """get_field_ui returns None when ui not present."""
        from genro_tytx import get_field_ui

        assert get_field_ui({"type": "T"}) is None
        assert get_field_ui({"type": "T", "validate": {"min": 1}}) is None


class TestStructEdgeCases:
    """Edge cases for struct application."""

    def test_unknown_type_leaves_value(self):
        """Unknown type codes should leave values unchanged."""
        registry.register_struct("UNKNOWN_FIELD", {"a": "UNKNOWN"})
        try:
            result = from_text('{"a": 1}::@UNKNOWN_FIELD')
            assert result == {"a": 1}
        finally:
            registry.unregister_struct("UNKNOWN_FIELD")

    def test_list_schema_with_non_list_data(self):
        """List schema should raise if input is not a list."""
        registry.register_struct("LIST_SCHEMA", ["L"])
        try:
            with pytest.raises(TypeError):
                from_text('"not-a-list"::@LIST_SCHEMA')
        finally:
            registry.unregister_struct("LIST_SCHEMA")

    def test_dict_schema_with_non_dict_data(self):
        """Dict schema should raise if input is not a dict."""
        registry.register_struct("DICT_SCHEMA", {"a": "L"})
        try:
            with pytest.raises(TypeError):
                from_text('["a", 1]::@DICT_SCHEMA')
        finally:
            registry.unregister_struct("DICT_SCHEMA")

    def test_dict_schema_with_null(self):
        """Dict schema with JSON null raises TypeError."""
        registry.register_struct("DICT_NULL", {"a": "L"})
        try:
            with pytest.raises(TypeError):
                from_text("null::@DICT_NULL")
        finally:
            registry.unregister_struct("DICT_NULL")

    def test_string_schema_with_non_list_data(self):
        """String schema should raise if input is not a list."""
        registry.register_struct("STRING_SCHEMA", "x:T,y:T")
        try:
            with pytest.raises(TypeError):
                from_text('{"x": "a"}::@STRING_SCHEMA')
        finally:
            registry.unregister_struct("STRING_SCHEMA")

    def test_string_schema_missing_values(self):
        """String schema fills missing positions with None."""
        registry.register_struct("STRING_MISS", "x:L,y:L")
        try:
            result = from_text('["1"]::@STRING_MISS')
            assert result == {"x": 1, "y": None}
        finally:
            registry.unregister_struct("STRING_MISS")

    def test_positional_schema_extra_elements(self):
        """Extra elements in data are passed through unchanged."""
        registry.register_struct("POS", ["L", "T"])
        try:
            result = from_text('[1, "two", "extra"]::@POS')
            assert result == [1, "two", "extra"]
        finally:
            registry.unregister_struct("POS")

    def test_positional_schema_empty_list(self):
        """Empty list returns empty list for positional schema."""
        registry.register_struct("POS_EMPTY", ["L", "T"])
        try:
            result = from_text("[]::@POS_EMPTY")
            assert result == []
        finally:
            registry.unregister_struct("POS_EMPTY")

    def test_positional_schema_null_input(self):
        """List schema with non-list (null) raises TypeError."""
        registry.register_struct("POS_NULL", ["L", "T"])
        try:
            with pytest.raises(TypeError):
                from_text("null::@POS_NULL")
        finally:
            registry.unregister_struct("POS_NULL")

    def test_homogeneous_nested_list(self):
        """Homogeneous list handles nested lists recursively."""
        registry.register_struct("HOMO_NESTED", ["L"])
        try:
            result = from_text("[[1,2],[3,[4]]]::@HOMO_NESTED")
            assert result == [[1, 2], [3, [4]]]
        finally:
            registry.unregister_struct("HOMO_NESTED")

    def test_get_type_instance_with_instance(self):
        """_get_type_instance returns the instance when already instantiated."""
        from genro_tytx.struct import _get_type_instance, StructType
        dummy = StructType("TMP", ["T"], registry)
        assert _get_type_instance(dummy) is dummy

    def test_struct_reference_missing(self):
        """Unknown struct reference returns value unchanged."""
        registry.register_struct("HAS_REF", ["@MISSING"])
        try:
            result = from_text('["foo"]::@HAS_REF')
            assert result == ["foo"]
        finally:
            registry.unregister_struct("HAS_REF")

    def test_parse_string_schema_with_empty_parts(self):
        """Empty segments in string schema are skipped."""
        from genro_tytx.struct import _parse_string_schema
        fields, has_names = _parse_string_schema("a:T,,b:L")
        assert fields == [("a", "T"), ("b", "L")]
        assert has_names is True

    def test_struct_serialize_compact_json(self):
        """StructType.serialize uses compact JSON (no spaces)."""
        from genro_tytx.struct import StructType

        st = StructType("SERIAL", {"a": "L"}, registry)
        assert st.serialize({"a": 1, "b": 2}) == '{"a":1,"b":2}'

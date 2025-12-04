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


class TestStructDictSchema:
    """Tests for dict schema syntax (replaces old string schema)."""

    def test_register_dict_schema(self):
        """Dict schema is stored directly."""
        registry.register_struct("POINT", {"x": "R", "y": "R"})
        schema = registry.get_struct("POINT")
        assert schema == {"x": "R", "y": "R"}
        registry.unregister_struct("POINT")

    def test_register_list_schema(self):
        """List schema is stored directly."""
        registry.register_struct("COORDS", ["R", "R"])
        schema = registry.get_struct("COORDS")
        assert schema == ["R", "R"]
        registry.unregister_struct("COORDS")

    def test_parse_dict_schema_from_dict_data(self):
        """Dict schema with dict data produces dict output."""
        registry.register_struct("POINT", {"x": "R", "y": "R"})
        try:
            result = from_text('{"x": "3.7", "y": "7.3"}::@POINT')
            assert result == {"x": 3.7, "y": 7.3}
        finally:
            registry.unregister_struct("POINT")

    def test_parse_list_schema_positional(self):
        """List schema produces list output with positional types."""
        registry.register_struct("COORDS", ["R", "R"])
        try:
            result = from_text('["3.7", "7.3"]::@COORDS')
            assert result == [3.7, 7.3]
        finally:
            registry.unregister_struct("COORDS")

    def test_dict_schema_preserves_order(self):
        """Dict schema preserves field order (Python 3.7+)."""
        registry.register_struct("ROW", {"name": "T", "qty": "L", "price": "N"})
        try:
            result = from_text('{"name": "Widget", "qty": "10", "price": "99.99"}::@ROW')
            assert result == {"name": "Widget", "qty": 10, "price": Decimal("99.99")}
            # Verify key order (Python 3.7+ dicts preserve insertion order)
            assert list(result.keys()) == ["name", "qty", "price"]
        finally:
            registry.unregister_struct("ROW")

    def test_list_schema_batch_mode(self):
        """List schema with array of arrays using #@STRUCT syntax."""
        registry.register_struct("ROW", ["T", "L", "N"])
        try:
            # Batch mode requires explicit #@ prefix
            result = from_text('[["A", "1", "10"], ["B", "2", "20"]]::#@ROW')
            assert result == [
                ["A", 1, Decimal("10")],
                ["B", 2, Decimal("20")],
            ]
        finally:
            registry.unregister_struct("ROW")

    def test_list_schema_batch_mode_positional(self):
        """Positional list schema with array of arrays using #@STRUCT syntax."""
        registry.register_struct("PAIR", ["R", "R"])
        try:
            # Batch mode requires explicit #@ prefix
            result = from_text('[["1.5", "2.5"], ["3.5", "4.5"]]::#@PAIR')
            assert result == [[1.5, 2.5], [3.5, 4.5]]
        finally:
            registry.unregister_struct("PAIR")

    def test_dict_schema_with_date_types(self):
        """Dict schema with date type."""
        registry.register_struct("EVENT", {"name": "T", "date": "D"})
        try:
            result = from_text('{"name": "Meeting", "date": "2025-01-15"}::@EVENT')
            assert result == {"name": "Meeting", "date": date(2025, 1, 15)}
        finally:
            registry.unregister_struct("EVENT")


class TestStructWithMetadata:
    """Tests for struct with separate metadata registration."""

    def test_register_struct_with_metadata(self):
        """Schema and metadata are registered separately."""
        registry.register_struct(
            "WITH_META",
            schema={"name": "T", "age": "L"},
            metadata={
                "name": {"validate": {"min": 1, "max": 100}},
                "age": {"validate": {"min": 0, "max": 120}},
            },
        )
        try:
            # Parsing uses schema only
            result = from_text('{"name": "Alice", "age": "25"}::@WITH_META')
            assert result == {"name": "Alice", "age": 25}
            # Metadata is retrievable
            meta = registry.get_struct_metadata("WITH_META")
            assert meta is not None
            assert "name" in meta
            assert meta["name"]["validate"]["min"] == 1
        finally:
            registry.unregister_struct("WITH_META")

    def test_metadata_with_ui(self):
        """UI metadata is stored and retrievable."""
        registry.register_struct(
            "WITH_UI",
            schema={"email": "T"},
            metadata={
                "email": {
                    "ui": {"label": "Email Address", "placeholder": "user@example.com"}
                }
            },
        )
        try:
            result = from_text('{"email": "test@test.com"}::@WITH_UI')
            assert result == {"email": "test@test.com"}
            meta = registry.get_struct_metadata("WITH_UI", "email")
            assert meta["ui"]["label"] == "Email Address"
        finally:
            registry.unregister_struct("WITH_UI")

    def test_metadata_full(self):
        """Metadata with both validate and ui sections."""
        registry.register_struct(
            "FULL_META",
            schema={"username": "T", "balance": "N"},
            metadata={
                "username": {
                    "validate": {"min": 3, "max": 50, "pattern": "^[a-z0-9_]+$"},
                    "ui": {"label": "Username", "hint": "Only lowercase letters and numbers"},
                },
                "balance": {
                    "validate": {"min": 0},
                    "ui": {"label": "Balance", "format": "currency", "readonly": True},
                },
            },
        )
        try:
            result = from_text('{"username": "john_doe", "balance": "1000.50"}::@FULL_META')
            assert result == {"username": "john_doe", "balance": Decimal("1000.50")}
            # Verify metadata
            username_meta = registry.get_struct_metadata("FULL_META", "username")
            assert username_meta["validate"]["min"] == 3
            assert username_meta["ui"]["label"] == "Username"
        finally:
            registry.unregister_struct("FULL_META")

    def test_struct_without_metadata(self):
        """Struct can be registered without metadata."""
        registry.register_struct("NO_META", {"name": "T", "age": "L"})
        try:
            result = from_text('{"name": "John", "age": "30"}::@NO_META')
            assert result == {"name": "John", "age": 30}
            # No metadata
            assert registry.get_struct_metadata("NO_META") is None
        finally:
            registry.unregister_struct("NO_META")

    def test_metadata_deduplication(self):
        """Identical metadata across fields shares storage."""
        same_validate = {"validate": {"min": 0, "max": 100}}
        registry.register_struct(
            "DEDUP",
            schema={"a": "L", "b": "L", "c": "L"},
            metadata={"a": same_validate, "b": same_validate, "c": same_validate},
        )
        try:
            result = from_text('{"a": "10", "b": "20", "c": "30"}::@DEDUP')
            assert result == {"a": 10, "b": 20, "c": 30}
            # All fields have same metadata
            assert registry.get_struct_metadata("DEDUP", "a") == same_validate
            assert registry.get_struct_metadata("DEDUP", "b") == same_validate
            assert registry.get_struct_metadata("DEDUP", "c") == same_validate
        finally:
            registry.unregister_struct("DEDUP")

    def test_list_schema_with_metadata(self):
        """List schema can have positional metadata."""
        registry.register_struct(
            "ROW_META",
            schema=["T", "L", "N"],
            metadata={
                "0": {"ui": {"label": "Name"}},
                "1": {"validate": {"min": 0}},
                "2": {"ui": {"format": "currency"}},
            },
        )
        try:
            result = from_text('["Product", "10", "99.99"]::@ROW_META')
            assert result == ["Product", 10, Decimal("99.99")]
        finally:
            registry.unregister_struct("ROW_META")

    def test_nested_struct_with_metadata(self):
        """Nested struct references work with metadata."""
        registry.register_struct(
            "ADDR",
            schema={"city": "T", "zip": "L"},
            metadata={"city": {"ui": {"label": "City"}}},
        )
        registry.register_struct(
            "PERSON",
            schema={"name": "T", "address": "@ADDR"},
            metadata={"name": {"validate": {"min": 1}}},
        )
        try:
            result = from_text(
                '{"name": "John", "address": {"city": "Rome", "zip": "12345"}}::@PERSON'
            )
            assert result == {"name": "John", "address": {"city": "Rome", "zip": 12345}}
        finally:
            registry.unregister_struct("PERSON")
            registry.unregister_struct("ADDR")


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

    def test_struct_serialize_compact_json(self):
        """StructType.serialize uses compact JSON (no spaces)."""
        from genro_tytx.struct import StructType

        st = StructType("SERIAL", {"a": "L"}, registry)
        assert st.serialize({"a": 1, "b": 2}) == '{"a":1,"b":2}'

    def test_homogeneous_with_struct_reference(self):
        """Homogeneous list with @STRUCT reference applies to each element."""
        registry.register_struct("ITEM", {"name": "T", "qty": "L"})
        registry.register_struct("ITEMS", ["@ITEM"])
        try:
            result = from_text(
                '[{"name": "A", "qty": "1"}, {"name": "B", "qty": "2"}]::@ITEMS'
            )
            assert result == [{"name": "A", "qty": 1}, {"name": "B", "qty": 2}]
        finally:
            registry.unregister_struct("ITEMS")
            registry.unregister_struct("ITEM")

    def test_homogeneous_with_inline_dict_struct(self):
        """Homogeneous list with inline dict struct."""
        registry.register_struct("INLINE_ITEMS", [{"name": "T", "price": "N"}])
        try:
            result = from_text(
                '[{"name": "X", "price": "10.50"}, {"name": "Y", "price": "20.00"}]::@INLINE_ITEMS'
            )
            assert result == [
                {"name": "X", "price": Decimal("10.50")},
                {"name": "Y", "price": Decimal("20.00")},
            ]
        finally:
            registry.unregister_struct("INLINE_ITEMS")

    def test_homogeneous_with_inline_list_struct(self):
        """Homogeneous list with inline list struct."""
        registry.register_struct("ROWS", [["T", "L"]])
        try:
            result = from_text('[["A", "1"], ["B", "2"]]::@ROWS')
            assert result == [["A", 1], ["B", 2]]
        finally:
            registry.unregister_struct("ROWS")

    def test_passthrough_empty_string(self):
        """Empty string type code means passthrough."""
        registry.register_struct("PASS", {"name": "", "active": ""})
        try:
            result = from_text('{"name": "test", "active": true}::@PASS')
            assert result == {"name": "test", "active": True}
        finally:
            registry.unregister_struct("PASS")

    def test_inline_dict_in_dict_schema(self):
        """Inline dict struct within a dict schema."""
        registry.register_struct(
            "ORDER", {"customer": {"name": "T", "id": "L"}, "total": "N"}
        )
        try:
            result = from_text(
                '{"customer": {"name": "John", "id": "42"}, "total": "100.00"}::@ORDER'
            )
            assert result == {
                "customer": {"name": "John", "id": 42},
                "total": Decimal("100.00"),
            }
        finally:
            registry.unregister_struct("ORDER")

    def test_inline_list_in_dict_schema(self):
        """Inline list struct within a dict schema."""
        registry.register_struct("RECORD", {"coords": ["R", "R"], "label": "T"})
        try:
            result = from_text('{"coords": ["1.5", "2.5"], "label": "Point"}::@RECORD')
            assert result == {"coords": [1.5, 2.5], "label": "Point"}
        finally:
            registry.unregister_struct("RECORD")

    def test_empty_dict_schema(self):
        """Empty dict schema returns data unchanged (covers line 145->144 branch)."""
        registry.register_struct("EMPTY_DICT", {})
        try:
            result = from_text('{"a": 1, "b": "hello"}::@EMPTY_DICT')
            # No fields to hydrate, but data is still valid dict
            assert result == {"a": 1, "b": "hello"}
        finally:
            registry.unregister_struct("EMPTY_DICT")

    def test_field_type_non_string_passthrough(self):
        """Non-string field_type that isn't dict/list falls through (line 218->234)."""
        # This tests the final return value in _hydrate_field when
        # field_type is not str, dict, list, or None
        # In practice this shouldn't happen with valid schemas, but for coverage:
        from genro_tytx.struct import StructType

        # Create a struct with an unusual field type (int instead of str)
        # This exercises the fallthrough at line 234
        st = StructType("TEST_FALLTHROUGH", {"val": 123}, registry)  # type: ignore
        result = st._hydrate_field("test_value", 123)  # type: ignore
        # Should return value unchanged since 123 is not a valid type spec
        assert result == "test_value"

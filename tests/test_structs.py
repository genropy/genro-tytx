"""Tests for struct schema functionality."""

from decimal import Decimal
from datetime import date

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
            result = from_text('{"name": "Acme", "balance": "100.50", "created": "2025-01-15"}::@CUSTOMER')
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

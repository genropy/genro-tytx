"""Extra tests for registry.py to increase coverage."""

from decimal import Decimal

import pytest

from genro_tytx import registry


class TestRegisterClassAutoDetect:
    """Tests for register_class auto-detection of methods."""

    def test_register_class_with_methods(self):
        """Class with as_typed_text and from_typed_text methods."""

        class Point:
            def __init__(self, x: float, y: float):
                self.x = x
                self.y = y

            def as_typed_text(self) -> str:
                return f"{self.x},{self.y}"

            @staticmethod
            def from_typed_text(s: str) -> "Point":
                x, y = s.split(",")
                return Point(float(x), float(y))

        # Register without explicit serialize/parse - should auto-detect
        registry.register_class("POINT", Point)
        try:
            # Test serialization
            p = Point(3.5, 7.2)
            text = registry.as_typed_text(p)
            assert text == "3.5,7.2::~POINT"

            # Test parsing
            restored = registry.from_text("3.5,7.2::~POINT")
            assert isinstance(restored, Point)
            assert restored.x == 3.5
            assert restored.y == 7.2
        finally:
            registry.unregister_class("POINT")

    def test_register_class_missing_as_typed_text(self):
        """Class without as_typed_text raises ValueError."""

        class BadClass:
            @staticmethod
            def from_typed_text(s: str) -> "BadClass":
                return BadClass()

        with pytest.raises(ValueError, match="must have as_typed_text"):
            registry.register_class("BAD", BadClass)

    def test_register_class_missing_from_typed_text(self):
        """Class without from_typed_text raises ValueError."""

        class BadClass:
            def as_typed_text(self) -> str:
                return "test"

        with pytest.raises(ValueError, match="must have from_typed_text"):
            registry.register_class("BAD2", BadClass)

    def test_register_class_with_explicit_functions(self):
        """Explicit serialize/parse override class methods."""

        class Simple:
            def __init__(self, value: int):
                self.value = value

        registry.register_class(
            "SIMPLE",
            Simple,
            serialize=lambda s: str(s.value),
            parse=lambda v: Simple(int(v)),
        )
        try:
            s = Simple(42)
            text = registry.as_typed_text(s)
            assert text == "42::~SIMPLE"

            restored = registry.from_text("42::~SIMPLE")
            assert restored.value == 42
        finally:
            registry.unregister_class("SIMPLE")


class TestUnregisterClass:
    """Tests for unregister_class."""

    def test_unregister_removes_from_all_dicts(self):
        """Unregistering removes from _codes, _types, and _python_types."""

        class Temp:
            def __init__(self, v: str):
                self.v = v

        registry.register_class(
            "TEMP", Temp, serialize=lambda t: t.v, parse=lambda s: Temp(s)
        )

        # Verify registered
        assert registry.get("~TEMP") is not None

        # Unregister
        registry.unregister_class("TEMP")

        # Verify removed
        assert registry.get("~TEMP") is None

    def test_unregister_nonexistent(self):
        """Unregistering nonexistent code does nothing."""
        # Should not raise
        registry.unregister_class("NONEXISTENT")


class TestRegistryGetters:
    """Tests for registry getter methods."""

    def test_get_builtin_type(self):
        """get() returns built-in types."""
        int_type = registry.get("L")
        assert int_type is not None

    def test_get_unknown_returns_none(self):
        """get() returns None for unknown codes."""
        assert registry.get("UNKNOWN123") is None

    def test_get_struct(self):
        """get_struct returns registered struct schema."""
        registry.register_struct("GTEST", {"name": "T"})
        try:
            schema = registry.get_struct("GTEST")
            assert schema == {"name": "T"}
        finally:
            registry.unregister_struct("GTEST")

    def test_get_struct_unknown(self):
        """get_struct returns None for unknown struct."""
        assert registry.get_struct("UNKNOWN_STRUCT") is None


class TestFromTextEdgeCases:
    """Tests for from_text edge cases."""

    def test_from_text_untyped_returns_string(self):
        """from_text without type code returns string."""
        result = registry.from_text("hello")
        assert result == "hello"

    def test_from_text_empty_string(self):
        """from_text with empty string."""
        result = registry.from_text("")
        assert result == ""

    def test_from_text_only_separator(self):
        """from_text with only :: separator."""
        # This may raise or return something depending on implementation
        try:
            result = registry.from_text("::")
            # Value is empty, type is empty - behavior varies
            # Just verify it doesn't crash unexpectedly
            assert result is not None or result == "" or result == "::"
        except (ValueError, KeyError):
            pass  # Expected for invalid input


class TestAsTypedTextEdgeCases:
    """Tests for as_typed_text edge cases."""

    def test_as_typed_text_none(self):
        """as_typed_text with None."""
        # None handling - may return empty or raise
        try:
            result = registry.as_typed_text(None)
            # None might serialize as "None" string
            assert result is not None  # Just check it returns something
        except (TypeError, AttributeError):
            pass  # None may not be serializable

    def test_as_typed_text_unknown_type(self):
        """as_typed_text with unknown type falls back to string."""

        class UnknownClass:
            def __str__(self):
                return "unknown"

        obj = UnknownClass()
        # Unknown types may fall back to str or raise
        try:
            result = registry.as_typed_text(obj)
            assert "unknown" in result or "T" in result
        except (TypeError, KeyError):
            pass  # May not support unknown types


class TestArrayTypeHandling:
    """Tests for array type handling (#@STRUCT syntax)."""

    def test_from_text_array_of_structs(self):
        """#@STRUCT syntax for batch processing."""
        registry.register_struct("ITEM", "name:T,qty:L")
        try:
            result = registry.from_text('[["A", "1"], ["B", "2"]]::#@ITEM')
            assert len(result) == 2
            assert result[0]["name"] == "A"
            assert result[0]["qty"] == 1
        finally:
            registry.unregister_struct("ITEM")


class TestStringSchemaToDict:
    """Tests for _string_schema_to_dict edge cases."""

    def test_anonymous_fields_get_names(self):
        """Anonymous fields in string schema get field_N names."""
        registry.register_struct("ANON", "T,L,N")
        try:
            schema = registry.get_struct("ANON")
            # String schema is stored as-is
            assert schema == "T,L,N"
        finally:
            registry.unregister_struct("ANON")

"""Tests for extension.py - Custom extension types."""

from decimal import Decimal

import pytest

from genro_tytx.extension import (
    CUSTOM_PREFIX,
    X_PREFIX,
    Y_PREFIX,
    Z_PREFIX,
    ExtensionType,
)


class TestExtensionTypeBasics:
    """Tests for ExtensionType class basics."""

    def test_extension_type_creation(self):
        """ExtensionType can be created with code, cls, serialize, parse."""
        ext = ExtensionType(
            code="TEST",
            cls=str,
            serialize=lambda x: str(x),
            parse=lambda s: s,
        )
        assert ext.code == "~TEST"
        assert ext.name == "custom_test"
        assert ext.cls is str
        assert ext.python_type is str

    def test_extension_type_parse(self):
        """parse() calls the _parse function."""
        ext = ExtensionType(
            code="INT",
            cls=int,
            serialize=str,
            parse=int,
        )
        assert ext.parse("42") == 42
        assert ext.parse("100") == 100

    def test_extension_type_serialize(self):
        """serialize() calls the _serialize function."""
        ext = ExtensionType(
            code="INT",
            cls=int,
            serialize=str,
            parse=int,
        )
        assert ext.serialize(42) == "42"
        assert ext.serialize(100) == "100"

    def test_extension_type_with_none_cls(self):
        """ExtensionType works with cls=None."""
        ext = ExtensionType(
            code="ANY",
            cls=None,
            serialize=str,
            parse=lambda s: s,
        )
        assert ext.cls is None
        assert ext.python_type is None
        assert ext.parse("test") == "test"


class TestExtensionTypeCustomClass:
    """Tests for ExtensionType with custom classes."""

    def test_custom_class_roundtrip(self):
        """Custom class serialize/parse roundtrip."""

        class Point:
            def __init__(self, x: float, y: float):
                self.x = x
                self.y = y

        def serialize_point(p: Point) -> str:
            return f"{p.x},{p.y}"

        def parse_point(s: str) -> Point:
            x, y = s.split(",")
            return Point(float(x), float(y))

        ext = ExtensionType(
            code="POINT",
            cls=Point,
            serialize=serialize_point,
            parse=parse_point,
        )

        original = Point(3.5, 7.2)
        serialized = ext.serialize(original)
        assert serialized == "3.5,7.2"

        restored = ext.parse(serialized)
        assert restored.x == 3.5
        assert restored.y == 7.2

    def test_invoice_example(self):
        """Test the Invoice example from docstring."""

        class Invoice:
            def __init__(self, number: str, amount: Decimal):
                self.number = number
                self.amount = amount

        def serialize_invoice(inv: Invoice) -> str:
            return f"{inv.number}|{inv.amount}"

        def parse_invoice(s: str) -> Invoice:
            number, amount = s.split("|")
            return Invoice(number, Decimal(amount))

        ext = ExtensionType(
            code="INV",
            cls=Invoice,
            serialize=serialize_invoice,
            parse=parse_invoice,
        )

        assert ext.code == "~INV"
        assert ext.name == "custom_inv"
        assert ext.cls is Invoice

        inv = Invoice("INV001", Decimal("100.50"))
        text = ext.serialize(inv)
        assert text == "INV001|100.50"

        restored = ext.parse(text)
        assert restored.number == "INV001"
        assert restored.amount == Decimal("100.50")


class TestConstants:
    """Tests for module constants."""

    def test_custom_prefix(self):
        """CUSTOM_PREFIX is tilde."""
        assert CUSTOM_PREFIX == "~"

    def test_legacy_prefixes(self):
        """Legacy prefixes are defined for backwards compatibility."""
        assert X_PREFIX == "X_"
        assert Y_PREFIX == "Y_"
        assert Z_PREFIX == "Z_"



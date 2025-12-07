# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for XML encoding/decoding with full attrs/value structure."""

from datetime import date, datetime
from decimal import Decimal


from genro_tytx import to_xml, from_xml, tytx_equivalent


class TestXmlEncode:
    """Tests for to_xml encoding."""

    def test_simple_scalar(self):
        """Single element with scalar value."""
        data = {"price": {"attrs": {}, "value": Decimal("100.50")}}
        result = to_xml(data, declaration=False)
        assert result == "<price>100.50::N</price>"

    def test_with_attributes(self):
        """Element with typed attributes."""
        data = {
            "order": {"attrs": {"id": 123, "created": date(2025, 1, 15)}, "value": None}
        }
        result = to_xml(data, declaration=False)
        assert 'id="123::L"' in result
        assert 'created="2025-01-15::D"' in result

    def test_nested_structure(self):
        """Nested elements with attrs and values."""
        data = {
            "order": {
                "attrs": {"id": 123},
                "value": {
                    "total": {"attrs": {}, "value": Decimal("999.99")},
                    "date": {"attrs": {}, "value": date(2025, 1, 15)},
                },
            }
        }
        result = to_xml(data, declaration=False)
        assert "<order" in result
        assert 'id="123::L"' in result
        assert "<total>999.99::N</total>" in result
        assert "<date>2025-01-15::D</date>" in result

    def test_repeated_elements(self):
        """Multiple elements with same tag become list."""
        data = {
            "order": {
                "attrs": {},
                "value": {
                    "item": [
                        {"attrs": {"name": "Widget"}, "value": Decimal("10.50")},
                        {"attrs": {"name": "Gadget"}, "value": Decimal("25.00")},
                    ]
                },
            }
        }
        result = to_xml(data, declaration=False)
        assert '<item name="Widget">10.50::N</item>' in result
        assert '<item name="Gadget">25.00::N</item>' in result

    def test_empty_element(self):
        """Element with no value (self-closing)."""
        data = {"item": {"attrs": {"name": "Widget"}, "value": None}}
        result = to_xml(data, declaration=False)
        assert (
            '<item name="Widget" />' in result
            or '<item name="Widget"></item>' in result
        )

    def test_bool_attribute(self):
        """Boolean attributes."""
        data = {"item": {"attrs": {"active": True, "hidden": False}, "value": None}}
        result = to_xml(data, declaration=False)
        assert 'active="1::B"' in result
        assert 'hidden="0::B"' in result

    def test_string_attribute(self):
        """String attributes (no suffix)."""
        data = {"item": {"attrs": {"name": "Widget"}, "value": None}}
        result = to_xml(data, declaration=False)
        assert 'name="Widget"' in result
        # No ::T suffix for strings
        assert "::T" not in result

    def test_legacy_format_compatibility(self):
        """Backwards compatibility with simple dict format."""
        # Legacy format without attrs/value structure
        data = {"price": Decimal("100.50")}
        result = to_xml(data, declaration=False)
        # Should still work
        assert "100.50::N" in result


class TestXmlDecode:
    """Tests for from_xml decoding."""

    def test_simple_scalar(self):
        """Decode element with scalar value."""
        result = from_xml("<price>100.50::N</price>")
        assert result == {"price": {"attrs": {}, "value": Decimal("100.50")}}

    def test_with_attributes(self):
        """Decode element with typed attributes."""
        result = from_xml('<order id="123::L" created="2025-01-15::D" />')
        assert result == {
            "order": {"attrs": {"id": 123, "created": date(2025, 1, 15)}, "value": None}
        }

    def test_nested_structure(self):
        """Decode nested elements."""
        xml = """
        <order id="123::L">
            <total>999.99::N</total>
            <date>2025-01-15::D</date>
        </order>
        """
        result = from_xml(xml)
        assert result["order"]["attrs"]["id"] == 123
        assert result["order"]["value"]["total"]["value"] == Decimal("999.99")
        assert result["order"]["value"]["date"]["value"] == date(2025, 1, 15)

    def test_repeated_elements_become_list(self):
        """Multiple elements with same tag become list."""
        xml = """
        <order>
            <item name="Widget" price="10.50::N" />
            <item name="Gadget" price="25.00::N" />
        </order>
        """
        result = from_xml(xml)
        items = result["order"]["value"]["item"]
        assert isinstance(items, list)
        assert len(items) == 2
        assert items[0]["attrs"]["name"] == "Widget"
        assert items[0]["attrs"]["price"] == Decimal("10.50")
        assert items[1]["attrs"]["name"] == "Gadget"
        assert items[1]["attrs"]["price"] == Decimal("25.00")

    def test_string_without_suffix(self):
        """String values without suffix."""
        result = from_xml("<note>Hello World</note>")
        assert result == {"note": {"attrs": {}, "value": "Hello World"}}

    def test_bool_attributes(self):
        """Boolean attribute hydration."""
        result = from_xml('<item active="1::B" hidden="0::B" />')
        assert result["item"]["attrs"]["active"] is True
        assert result["item"]["attrs"]["hidden"] is False

    def test_empty_element(self):
        """Empty element has value=None."""
        result = from_xml('<item name="Widget" />')
        assert result == {"item": {"attrs": {"name": "Widget"}, "value": None}}


class TestXmlRoundTrip:
    """Tests for XML roundtrip."""

    def test_simple_roundtrip(self):
        """Roundtrip simple structure."""
        original = {"price": {"attrs": {}, "value": Decimal("100.50")}}
        encoded = to_xml(original, declaration=False)
        decoded = from_xml(encoded)
        assert decoded == original

    def test_complex_roundtrip(self):
        """Roundtrip complex structure with attributes."""
        original = {
            "order": {
                "attrs": {"id": 123, "created": date(2025, 1, 15)},
                "value": {
                    "item": [
                        {
                            "attrs": {"name": "Widget", "price": Decimal("10.50")},
                            "value": None,
                        },
                        {
                            "attrs": {"name": "Gadget", "price": Decimal("25.00")},
                            "value": None,
                        },
                    ],
                    "total": {"attrs": {"approved": True}, "value": Decimal("35.50")},
                },
            }
        }
        encoded = to_xml(original, declaration=False)
        decoded = from_xml(encoded)
        assert decoded == original

    def test_nested_roundtrip(self):
        """Roundtrip nested structure."""
        original = {
            "invoice": {
                "attrs": {},
                "value": {
                    "header": {
                        "attrs": {},
                        "value": {
                            "date": {"attrs": {}, "value": date(2025, 1, 15)},
                            "number": {"attrs": {}, "value": 12345},
                        },
                    },
                    "total": {"attrs": {}, "value": Decimal("999.99")},
                },
            }
        }
        encoded = to_xml(original, declaration=False)
        decoded = from_xml(encoded)
        assert decoded == original

    def test_all_types_roundtrip(self):
        """Roundtrip all supported types."""
        from datetime import time

        original = {
            "data": {
                "attrs": {
                    "int_attr": 42,
                    "float_attr": 3.14,
                    "bool_attr": True,
                    "date_attr": date(2025, 1, 15),
                    "str_attr": "hello",
                },
                "value": {
                    "decimal": {"attrs": {}, "value": Decimal("123.456")},
                    "datetime": {
                        "attrs": {},
                        "value": datetime(2025, 1, 15, 10, 30, 0),
                    },
                    "time": {"attrs": {}, "value": time(10, 30, 0)},
                },
            }
        }
        encoded = to_xml(original, declaration=False)
        decoded = from_xml(encoded)

        # Use tytx_equivalent for semantic comparison
        # (handles datetime naive vs aware UTC equivalence)
        assert tytx_equivalent(original, decoded)

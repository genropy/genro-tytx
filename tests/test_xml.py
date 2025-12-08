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

    def test_invalid_format_raises_error(self):
        """Invalid format (missing 'value' key) raises ValueError."""
        import pytest

        # Missing 'value' key
        data = {"price": Decimal("100.50")}
        with pytest.raises(ValueError, match="must be a dict with 'value' key"):
            to_xml(data, declaration=False)


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


class TestXmlEdgeCases:
    """Tests for XML edge cases and error handling."""

    def test_unsupported_type_in_attribute(self):
        """Unsupported type in attribute raises TypeError."""
        import pytest

        class CustomClass:
            pass

        data = {"item": {"attrs": {"custom": CustomClass()}, "value": None}}
        with pytest.raises(TypeError, match="Cannot serialize"):
            to_xml(data, declaration=False)

    def test_unsupported_type_in_text(self):
        """Unsupported type in text content raises TypeError."""
        import pytest

        class CustomClass:
            pass

        data = {"item": {"attrs": {}, "value": CustomClass()}}
        with pytest.raises(TypeError, match="Cannot serialize"):
            to_xml(data, declaration=False)

    def test_invalid_input_not_single_root(self):
        """Multiple root elements raise ValueError."""
        import pytest

        data = {"a": {"attrs": {}, "value": None}, "b": {"attrs": {}, "value": None}}
        with pytest.raises(ValueError, match="single root element"):
            to_xml(data)

    def test_invalid_input_not_dict(self):
        """Non-dict input raises ValueError."""
        import pytest

        with pytest.raises(ValueError, match="single root element"):
            to_xml("not a dict")

    def test_none_attribute_value(self):
        """None as attribute value becomes empty string."""
        data = {"item": {"attrs": {"empty": None}, "value": "test"}}
        result = to_xml(data, declaration=False)
        assert 'empty=""' in result

    def test_text_none_value(self):
        """None as text value produces no text content."""
        data = {"item": {"attrs": {}, "value": None}}
        result = to_xml(data, declaration=False)
        # Element should be empty or self-closing
        assert "<item" in result

    def test_unknown_suffix_returns_string(self):
        """Unknown suffix returns string as-is."""
        xml = '<item value="something::UNKNOWN" />'
        result = from_xml(xml)
        # Unknown suffix should be kept as string
        assert result["item"]["attrs"]["value"] == "something::UNKNOWN"


class TestXmlItemTag:
    """Tests for _item tag handling."""

    def test_direct_list_creates_item_tags(self):
        """Direct list value creates _item tags."""
        data = {
            "container": {
                "attrs": {},
                "value": [
                    {"attrs": {}, "value": Decimal("10.00")},
                    {"attrs": {}, "value": Decimal("20.00")}
                ]
            }
        }
        result = to_xml(data, declaration=False)
        assert "<_item>10.00::N</_item>" in result
        assert "<_item>20.00::N</_item>" in result

    def test_item_tags_roundtrip(self):
        """_item tags roundtrip correctly."""
        data = {
            "container": {
                "attrs": {},
                "value": [
                    {"attrs": {}, "value": Decimal("10.00")},
                    {"attrs": {}, "value": Decimal("20.00")}
                ]
            }
        }
        encoded = to_xml(data, declaration=False)
        decoded = from_xml(encoded)
        assert decoded == data

    def test_decode_item_tags_as_list(self):
        """Decode _item tags back to list."""
        xml = """
        <container>
            <_item>10.00::N</_item>
            <_item>20.00::N</_item>
        </container>
        """
        result = from_xml(xml)
        assert result["container"]["value"] == [
            {"attrs": {}, "value": Decimal("10.00")},
            {"attrs": {}, "value": Decimal("20.00")}
        ]

    def test_direct_list_with_scalars(self):
        """Direct list with scalar values."""
        data = {
            "prices": {
                "attrs": {},
                "value": [
                    {"attrs": {}, "value": Decimal("10.00")},
                    {"attrs": {}, "value": Decimal("20.00")},
                    {"attrs": {}, "value": Decimal("30.00")}
                ]
            }
        }
        result = to_xml(data, declaration=False)
        decoded = from_xml(result)
        assert decoded == data

    def test_direct_list_with_raw_scalars_raises_error(self):
        """Direct list with raw scalars (not attrs/value) raises ValueError."""
        import pytest

        data = {
            "prices": {
                "attrs": {},
                "value": [
                    Decimal("10.00"),
                    Decimal("20.00")
                ]
            }
        }
        with pytest.raises(ValueError, match="must be a dict with 'value' key"):
            to_xml(data, declaration=False)

    def test_direct_list_with_plain_dicts_raises_error(self):
        """Direct list with plain dicts (missing 'value' key) raises ValueError."""
        import pytest

        data = {
            "container": {
                "attrs": {},
                "value": [
                    {"price": Decimal("10.00")},
                    {"price": Decimal("20.00")}
                ]
            }
        }
        with pytest.raises(ValueError, match="must be a dict with 'value' key"):
            to_xml(data, declaration=False)


class TestXmlDeclaration:
    """Tests for XML declaration handling."""

    def test_with_declaration(self):
        """Test with XML declaration."""
        data = {"item": {"attrs": {}, "value": "test"}}
        result = to_xml(data, declaration=True)
        assert result.startswith('<?xml version="1.0" ?>')
        assert "<item>test</item>" in result


class TestXmlRootWrapper:
    """Tests for the root parameter in to_xml."""

    def test_root_true_wraps_dict(self):
        """root=True wraps dict in tytx_root."""
        data = {
            "price": {"value": Decimal("100.50")},
            "date": {"value": date(2025, 1, 15)}
        }
        result = to_xml(data, root=True, declaration=False)
        assert result.startswith("<tytx_root>")
        assert result.endswith("</tytx_root>")
        assert "100.50::N" in result
        assert "2025-01-15::D" in result

    def test_root_true_wraps_list(self):
        """root=True wraps list in tytx_root."""
        data = [
            {"value": Decimal("1.1")},
            {"value": Decimal("2.2")},
            {"value": Decimal("3.3")}
        ]
        result = to_xml(data, root=True, declaration=False)
        assert result.startswith("<tytx_root>")
        assert "<_item>1.1::N</_item>" in result
        assert "<_item>2.2::N</_item>" in result

    def test_root_string_custom_tag(self):
        """root='custom' wraps in custom tag."""
        data = {"price": {"value": Decimal("100.50")}}
        result = to_xml(data, root="data", declaration=False)
        assert result.startswith("<data>")
        assert result.endswith("</data>")

    def test_root_dict_with_attrs(self):
        """root=dict wraps in tytx_root with attributes."""
        data = {"price": {"value": Decimal("100.50")}}
        result = to_xml(data, root={"version": 1}, declaration=False)
        assert "<tytx_root" in result
        assert 'version="1::L"' in result
        assert "</tytx_root>" in result

    def test_from_xml_unwraps_tytx_root(self):
        """from_xml auto-unwraps tytx_root."""
        xml = "<tytx_root><price>100.50::N</price></tytx_root>"
        result = from_xml(xml)
        # Should return unwrapped value, not {"tytx_root": ...}
        assert "tytx_root" not in result
        assert "price" in result
        assert result["price"]["value"] == Decimal("100.50")

    def test_from_xml_unwraps_tytx_root_list(self):
        """from_xml auto-unwraps tytx_root containing list."""
        xml = "<tytx_root><_item>1.1::N</_item><_item>2.2::N</_item></tytx_root>"
        result = from_xml(xml)
        # Should return list directly
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["value"] == Decimal("1.1")

    def test_roundtrip_with_root_true(self):
        """Roundtrip with root=True."""
        original = {
            "price": {"value": Decimal("100.50")},
            "date": {"value": date(2025, 1, 15)}
        }
        encoded = to_xml(original, root=True, declaration=False)
        decoded = from_xml(encoded)
        # Decoded should match original structure
        assert decoded["price"]["value"] == Decimal("100.50")
        assert decoded["date"]["value"] == date(2025, 1, 15)

    def test_roundtrip_list_with_root_true(self):
        """Roundtrip list with root=True."""
        original = [{"value": Decimal("1.1")}, {"value": Decimal("2.2")}]
        encoded = to_xml(original, root=True, declaration=False)
        decoded = from_xml(encoded)
        assert isinstance(decoded, list)
        assert decoded[0]["value"] == Decimal("1.1")
        assert decoded[1]["value"] == Decimal("2.2")

    def test_regular_root_not_unwrapped(self):
        """Regular root element (not tytx_root) is not unwrapped."""
        xml = "<order><price>100.50::N</price></order>"
        result = from_xml(xml)
        assert "order" in result
        assert result["order"]["value"]["price"]["value"] == Decimal("100.50")

    def test_invalid_root_type_raises_error(self):
        """Invalid root type raises TypeError."""
        import pytest

        data = {"price": {"value": Decimal("100.50")}}
        with pytest.raises(TypeError, match="root must be bool, str, or dict"):
            to_xml(data, root=123)

"""
XML utilities for TYTX Protocol.

Provides functions for XML serialization with typed values.

Structure convention:
    Each XML element maps to: {"tag": {"attrs": {...}, "value": ...}}
    - attrs: dict of attributes (can be typed with ::type)
    - value: scalar (string or typed), dict of children, or list (repeated elements)

Usage:
    # Typed XML (TYTX format - reversible)
    as_typed_xml(data)  # → '<price>99.50::D</price>'
    from_xml(xml_str)   # → {"price": {"attrs": {}, "value": Decimal("99.50")}}

    # Standard XML (for external systems)
    as_xml(data)  # → '<price>99.50</price>'
"""

import xml.etree.ElementTree as ET
from typing import Any

from .registry import registry


def as_typed_xml(data: dict[str, Any], root_tag: str | None = None) -> str:
    """
    Convert a dictionary to an XML string with typed values (TYTX format).

    Args:
        data: The dictionary to convert. Structure: {"tag": {"attrs": {...}, "value": ...}}
        root_tag: Optional root tag name. If provided, data is treated as content of this root.

    Returns:
        XML string with typed values (e.g., "99.50::D").
    """
    return _to_xml(data, root_tag, typed=True)


def as_xml(data: dict[str, Any], root_tag: str | None = None) -> str:
    """
    Convert a dictionary to a standard XML string (without type suffixes).

    Args:
        data: The dictionary to convert. Structure: {"tag": {"attrs": {...}, "value": ...}}
        root_tag: Optional root tag name. If provided, data is treated as content of this root.

    Returns:
        Standard XML string.
    """
    return _to_xml(data, root_tag, typed=False)


def _to_xml(data: dict[str, Any], root_tag: str | None, typed: bool) -> str:
    """Internal XML builder."""
    if root_tag is None:
        if len(data) != 1:
            raise ValueError("Data must have exactly one root key if root_tag is not provided")
        root_tag = list(data.keys())[0]
        content = data[root_tag]
    else:
        content = data

    root = _build_element(root_tag, content, typed)
    return ET.tostring(root, encoding="unicode")


def _build_element(tag: str, content: Any, typed: bool) -> ET.Element:
    """Build an XML element from dict content."""
    elem = ET.Element(tag)

    if not isinstance(content, dict) or "attrs" not in content or "value" not in content:
        raise ValueError(f"Content must have 'attrs' and 'value' keys, got: {type(content)}")

    # Set attributes
    for attr_name, attr_value in content["attrs"].items():
        if typed:
            elem.set(attr_name, registry.as_typed_text(attr_value))
        else:
            elem.set(attr_name, registry.as_text(attr_value))

    value = content["value"]
    if isinstance(value, dict):
        # Children
        for child_tag, child_content in value.items():
            if isinstance(child_content, list):
                for item in child_content:
                    elem.append(_build_element(child_tag, item, typed))
            else:
                elem.append(_build_element(child_tag, child_content, typed))
    elif isinstance(value, list):
        # List of same-tag children
        for item in value:
            elem.append(_build_element(tag, item, typed))
    elif value is not None:
        # Scalar value
        if typed:
            elem.text = registry.as_typed_text(value)
        else:
            elem.text = registry.as_text(value)

    return elem


def from_xml(xml_string: str) -> dict[str, Any]:
    """
    Convert an XML string to a dictionary, hydrating typed values.

    Typed strings (e.g., "99.50::D") are converted to Python objects.
    Non-typed values are returned as strings.

    Args:
        xml_string: XML string to parse.

    Returns:
        Dictionary with structure: {"tag": {"attrs": {...}, "value": ...}}
    """
    root = ET.fromstring(xml_string)
    return {root.tag: _parse_element(root)}


def _parse_element(elem: ET.Element) -> dict[str, Any]:
    """Parse an XML element to dict with attrs/value structure."""
    attrs: dict[str, Any] = {}
    children: dict[str, Any] = {}

    # Parse attributes
    for key, attr_val in elem.attrib.items():
        attrs[key] = registry.from_text(attr_val)

    # Parse children
    for child in elem:
        child_val = _parse_element(child)
        if child.tag in children:
            if not isinstance(children[child.tag], list):
                children[child.tag] = [children[child.tag]]
            children[child.tag].append(child_val)
        else:
            children[child.tag] = child_val

    # Parse text content
    text = elem.text.strip() if elem.text else ""

    # Determine value
    if children:
        # Has children - value is dict of children
        value: Any = children
        if text:
            # Has both children and text (mixed content)
            value["#text"] = registry.from_text(text)
    elif text:
        # Only text content
        value = registry.from_text(text)
    else:
        # Empty element
        value = None

    return {"attrs": attrs, "value": value}

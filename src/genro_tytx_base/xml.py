# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX XML Encoding/Decoding.

XML format uses attributes for typed values:
    <price _type="D">100.50</price>
    <date _type="d">2025-01-15</date>
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

from .registry import XML_TYPE_TO_SUFFIX, SUFFIX_TO_TYPE


def _serialize_to_xml(value: Any, tag: str = "root") -> ET.Element:
    """Convert Python value to XML Element."""
    element = ET.Element(tag)

    if value is None:
        element.set("_type", "null")
        return element

    # Check if it's a typed scalar
    entry = XML_TYPE_TO_SUFFIX.get(type(value))
    if entry is not None:
        suffix, serializer = entry
        element.set("_type", suffix)
        element.text = serializer(value)
        return element

    # Native types
    if isinstance(value, str):
        element.text = value
        return element

    if isinstance(value, (int, float)):
        element.text = str(value)
        return element

    if isinstance(value, dict):
        for k, v in value.items():
            child = _serialize_to_xml(v, tag=k)
            element.append(child)
        return element

    if isinstance(value, list):
        for item in value:
            child = _serialize_to_xml(item, tag="item")
            element.append(child)
        return element

    raise TypeError(f"Cannot serialize {type(value).__name__} to XML")


def to_xml(value: Any, *, root_tag: str = "root", declaration: bool = True) -> str:
    """
    Encode a Python value to TYTX XML string.

    Args:
        value: Python object to encode
        root_tag: Name of the root element
        declaration: Include XML declaration

    Returns:
        XML string with typed values marked

    Example:
        >>> to_xml({"price": Decimal("100.50")})
        '<?xml version="1.0" ?><root><price _type="D">100.50</price></root>'
    """
    element = _serialize_to_xml(value, tag=root_tag)
    xml_str = ET.tostring(element, encoding="unicode")

    if declaration:
        return f'<?xml version="1.0" ?>{xml_str}'
    return xml_str


def _deserialize_from_xml(element: ET.Element) -> Any:
    """Convert XML Element to Python value."""
    type_attr = element.get("_type")

    # Null handling
    if type_attr == "null":
        return None

    # Typed scalar
    if type_attr is not None:
        entry = SUFFIX_TO_TYPE.get(type_attr)
        if entry is not None:
            _, deserializer = entry
            return deserializer(element.text or "")
        # Unknown type, return as string
        return element.text

    # Has children -> dict or list
    children = list(element)
    if children:
        # Check if it's a list (all children named "item")
        if all(child.tag == "item" for child in children):
            return [_deserialize_from_xml(child) for child in children]
        # Otherwise it's a dict
        return {child.tag: _deserialize_from_xml(child) for child in children}

    # Leaf node with text
    text = element.text
    if text is None:
        return ""

    # Try to parse as number
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text


def from_xml(data: str) -> Any:
    """
    Decode a TYTX XML string to Python objects.

    Args:
        data: XML string with typed values

    Returns:
        Python object with typed values hydrated

    Example:
        >>> from_xml('<root><price _type="D">100.50</price></root>')
        {"price": Decimal("100.50")}
    """
    root = ET.fromstring(data)
    result = _deserialize_from_xml(root)

    # If root only contains a dict, return the dict
    if isinstance(result, dict):
        return result

    return result

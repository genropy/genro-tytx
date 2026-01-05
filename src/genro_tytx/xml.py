# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
TYTX XML Encoding/Decoding.

XML format follows the structure:
    {"tag": {"attrs": {...}, "value": ...}}

Where:
- attrs: dict of attributes (hydrated with type suffixes)
- value: scalar, dict of children, list, or None

Type suffixes are used in both text content and attributes:
    <price>100.50::N</price>
    <order id="123::L" created="2025-01-15::D">...</order>
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any, cast


def _is_xml_element(item: Any) -> bool:
    """
    Check if item is a valid XML element format: {tag: {"value": ...}}

    A valid XML element is a dict with exactly one key (the tag),
    whose value is a dict containing at least a "value" key.
    """
    if not isinstance(item, dict) or len(item) != 1:
        return False
    _, item_data = next(iter(item.items()))
    return isinstance(item_data, dict) and "value" in item_data


def _serialize_element(tag: str, data: dict[str, Any]) -> ET.Element:
    """
    Serialize a dict with 'value' key (and optional 'attrs') to XML element.

    Args:
        tag: Element tag name
        data: Dict with 'value' key and optional 'attrs' key

    Returns:
        XML Element
    """
    element = ET.Element(tag)

    attrs = data.get("attrs", {})
    value = data["value"]

    # Set attributes
    from .encode import to_tytx

    for attr_name, attr_value in attrs.items():
        element.set(attr_name, cast(str, to_tytx(attr_value, _force_suffix=True)))

    # Set value
    if isinstance(value, list):
        # List of children
        for item in value:
            if _is_xml_element(item):
                item_tag, item_data = next(iter(item.items()))
                child_element = _serialize_element(item_tag, item_data)
                element.append(child_element)
            else:
                from .encode import to_tytx

                element.text = cast(str, to_tytx(value))
                break
    else:
        from .encode import to_tytx

        element.text = cast(str, to_tytx(value))

    return element


def to_xml(value: Any) -> str:
    """
    Encode a Python value to TYTX XML string.

    Args:
        value: Data to encode

    Returns:
        XML string with typed values marked
    """
    # Check if value is valid XML element format
    if _is_xml_element(value):
        # Valid XML format: {tag: {"value": ...}}
        root_tag, root_data = next(iter(value.items()))
        element = _serialize_element(root_tag, root_data)
        return ET.tostring(element, encoding="unicode")
    else:
        # Not valid XML format: serialize as JSON
        from .encode import to_tytx

        return cast(str, to_tytx(value))


def from_xmlnode(element: ET.Element) -> dict[str, Any]:
    """
    Deserialize XML element to dict with 'attrs' and 'value' keys.

    Returns:
        Dict with 'attrs' and 'value' keys
    """
    from .decode import from_tytx

    # Hydrate attributes
    attrs = {}
    for attr_name, attr_value in element.attrib.items():
        attrs[attr_name] = from_tytx(attr_value)

    # Process children
    children = list(element)

    if children:
        if len(children) == 1:
            # Single child: return as dict {tag: {...}}
            child = children[0]
            child_data = from_xmlnode(child)
            return {"attrs": attrs, "value": {child.tag: child_data}}
        else:
            # Multiple children: return as list [{tag: {...}}, ...]
            value = []
            for child in children:
                child_data = from_xmlnode(child)
                value.append({child.tag: child_data})
            return {"attrs": attrs, "value": value}

    # Leaf node
    return {"attrs": attrs, "value": from_tytx(element.text)}


def from_xml(data: str) -> dict[str, Any] | Any:
    """
    Decode a TYTX XML string to Python value.

    If the root element is 'tytx_root', it is automatically unwrapped
    and the inner value is returned directly.

    Args:
        data: XML string with typed values

    Returns:
        If root is 'tytx_root': the unwrapped value (dict, list, or scalar)
        Otherwise: Dict in format {"tag": {"attrs": {...}, "value": ...}}

    Example:
        >>> from_xml('<order id="123::L"><total>100.50::N</total></order>')
        {
            "order": {
                "attrs": {"id": 123},
                "value": {"total": {"attrs": {}, "value": Decimal("100.50")}}
            }
        }

        >>> from_xml('<tytx_root><price>100.50::N</price></tytx_root>')
        {"price": {"attrs": {}, "value": Decimal("100.50")}}
    """
    from .decode import from_tytx

    root = ET.fromstring(data)

    # Unwrap tytx_root: lavoriamo sul contenuto interno
    if root.tag == "tytx_root":
        if not list(root):
            return from_tytx(root.text or "")  # empty element → empty string
        root = list(root)[0]

    # Da qui: root è il nodo reale
    result = from_xmlnode(root)
    return {root.tag: result}

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
from typing import Any

from .registry import XML_TYPE_TO_SUFFIX, SUFFIX_TO_TYPE


def _serialize_attr_value(value: Any) -> str:
    """Serialize a value for use as XML attribute."""
    if value is None:
        return ""

    # Check if it's a typed scalar
    entry = XML_TYPE_TO_SUFFIX.get(type(value))
    if entry is not None:
        suffix, serializer = entry
        return f"{serializer(value)}::{suffix}"

    # String - no suffix needed
    if isinstance(value, str):
        return value

    raise TypeError(f"Cannot serialize {type(value).__name__} to XML attribute")


def _serialize_text_value(value: Any) -> str | None:
    """Serialize a value for use as XML text content."""
    if value is None:
        return None

    # Check if it's a typed scalar
    entry = XML_TYPE_TO_SUFFIX.get(type(value))
    if entry is not None:
        suffix, serializer = entry
        return f"{serializer(value)}::{suffix}"

    # String - no suffix needed
    if isinstance(value, str):
        return value

    raise TypeError(f"Cannot serialize {type(value).__name__} to XML text")


def _serialize_element(tag: str, data: dict[str, Any]) -> ET.Element:
    """
    Serialize a dict with 'attrs' and 'value' keys to XML element.

    Args:
        tag: Element tag name
        data: Dict with 'attrs' and 'value' keys

    Returns:
        XML Element
    """
    element = ET.Element(tag)

    attrs = data.get("attrs", {})
    value = data.get("value")

    # Set attributes
    for attr_name, attr_value in attrs.items():
        element.set(attr_name, _serialize_attr_value(attr_value))

    # Set value
    if value is None:
        # Empty element - no text content
        pass
    elif isinstance(value, dict):
        # Children elements
        for child_tag, child_data in value.items():
            if isinstance(child_data, list):
                # Repeated elements
                for item in child_data:
                    # Auto-wrap non-attrs/value items
                    if not isinstance(item, dict):
                        # Scalar value
                        item = {"attrs": {}, "value": item}
                    elif not ("attrs" in item and "value" in item):
                        # Plain dict
                        item = {"attrs": {}, "value": _convert_legacy_value(item)}
                    child_element = _serialize_element(child_tag, item)
                    element.append(child_element)
            else:
                # Auto-wrap non-attrs/value items
                if not isinstance(child_data, dict):
                    # Scalar value
                    child_data = {"attrs": {}, "value": child_data}
                elif not ("attrs" in child_data and "value" in child_data):
                    # Plain dict
                    child_data = {"attrs": {}, "value": _convert_legacy_value(child_data)}
                child_element = _serialize_element(child_tag, child_data)
                element.append(child_element)
    elif isinstance(value, list):
        # Direct list (wrapped in _item tags)
        for item in value:
            # Auto-wrap non-attrs/value items
            if not isinstance(item, dict):
                # Scalar value
                item = {"attrs": {}, "value": item}
            elif not ("attrs" in item and "value" in item):
                # Plain dict
                item = {"attrs": {}, "value": _convert_legacy_value(item)}
            child_element = _serialize_element("_item", item)
            element.append(child_element)
    else:
        # Scalar value
        element.text = _serialize_text_value(value)

    return element


def to_xml(value: dict[str, Any], *, declaration: bool = True) -> str:
    """
    Encode a Python dict to TYTX XML string.

    The input must be a dict with a single key (the root tag) mapping to
    a dict with 'attrs' and 'value' keys.

    Args:
        value: Dict in format {"tag": {"attrs": {...}, "value": ...}}
        declaration: Include XML declaration

    Returns:
        XML string with typed values marked

    Example:
        >>> to_xml({
        ...     "order": {
        ...         "attrs": {"id": 123},
        ...         "value": {"total": {"attrs": {}, "value": Decimal("100.50")}}
        ...     }
        ... })
        '<?xml version="1.0" ?><order id="123::L"><total>100.50::N</total></order>'
    """
    if not isinstance(value, dict) or len(value) != 1:
        raise ValueError("Input must be a dict with a single root element")

    root_tag, root_data = next(iter(value.items()))

    # Handle simple dict (backwards compatibility)
    if not isinstance(root_data, dict) or (
        "attrs" not in root_data and "value" not in root_data
    ):
        # Legacy format: convert to new format
        root_data = {"attrs": {}, "value": _convert_legacy_value(root_data)}

    element = _serialize_element(root_tag, root_data)
    xml_str = ET.tostring(element, encoding="unicode")

    if declaration:
        return f'<?xml version="1.0" ?>{xml_str}'
    return xml_str


def _convert_legacy_value(value: Any) -> Any:
    """Convert legacy format value to new format."""
    if value is None:
        return None

    if isinstance(value, dict):
        # Convert each child to new format
        result = {}
        for k, v in value.items():
            if isinstance(v, dict) and "attrs" in v and "value" in v:
                result[k] = v
            else:
                result[k] = {"attrs": {}, "value": _convert_legacy_value(v)}
        return result

    if isinstance(value, list):
        return [
            {"attrs": {}, "value": _convert_legacy_value(item)}
            if not (isinstance(item, dict) and "attrs" in item and "value" in item)
            else item
            for item in value
        ]

    # Scalar
    return value


def _hydrate_value(text: str) -> Any:
    """
    Hydrate a text value with type suffix.

    Args:
        text: Text that may contain type suffix (e.g., "100.50::N")

    Returns:
        Hydrated Python value
    """
    if "::" in text:
        idx = text.rfind("::")
        raw_value = text[:idx]
        suffix = text[idx + 2 :]
        entry = SUFFIX_TO_TYPE.get(suffix)
        if entry is not None:
            _, deserializer = entry
            return deserializer(raw_value)

    # No valid suffix - return as string
    return text


def _deserialize_element(element: ET.Element) -> dict[str, Any]:
    """
    Deserialize XML element to dict with 'attrs' and 'value' keys.

    Returns:
        Dict with 'attrs' and 'value' keys
    """
    # Hydrate attributes
    attrs = {}
    for attr_name, attr_value in element.attrib.items():
        attrs[attr_name] = _hydrate_value(attr_value)

    # Process children
    children = list(element)

    if children:
        # Group children by tag
        children_by_tag: dict[str, list[dict]] = {}
        for child in children:
            child_data = _deserialize_element(child)
            tag = child.tag
            if tag not in children_by_tag:
                children_by_tag[tag] = []
            children_by_tag[tag].append(child_data)

        # Convert single-item lists to single items (unless it's _item which is always a list)
        value: dict[str, Any] = {}
        for tag, items in children_by_tag.items():
            if tag == "_item":
                # Always keep as list
                value[tag] = items
            elif len(items) == 1:
                value[tag] = items[0]
            else:
                value[tag] = items

        # Special case: if only _item children, return as list
        if list(value.keys()) == ["_item"]:
            return {"attrs": attrs, "value": value["_item"]}

        return {"attrs": attrs, "value": value}

    # Leaf node
    text = element.text
    if text is None or text.strip() == "":
        return {"attrs": attrs, "value": None}

    # Hydrate text content
    hydrated = _hydrate_value(text.strip())
    return {"attrs": attrs, "value": hydrated}


def from_xml(data: str) -> dict[str, Any]:
    """
    Decode a TYTX XML string to Python dict.

    Args:
        data: XML string with typed values

    Returns:
        Dict in format {"tag": {"attrs": {...}, "value": ...}}

    Example:
        >>> from_xml('<order id="123::L"><total>100.50::N</total></order>')
        {
            "order": {
                "attrs": {"id": 123},
                "value": {"total": {"attrs": {}, "value": Decimal("100.50")}}
            }
        }
    """
    root = ET.fromstring(data)
    result = _deserialize_element(root)
    return {root.tag: result}

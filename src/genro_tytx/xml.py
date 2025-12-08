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
    if value is None:  # pragma: no cover - None handled by caller before this
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
    Serialize a dict with 'value' key (and optional 'attrs') to XML element.

    Args:
        tag: Element tag name
        data: Dict with 'value' key and optional 'attrs' key

    Returns:
        XML Element

    Raises:
        ValueError: If data doesn't have 'value' key
    """
    if not isinstance(data, dict) or "value" not in data:
        raise ValueError(
            f"Element '{tag}' must be a dict with 'value' key, got: {type(data).__name__}"
        )

    element = ET.Element(tag)

    attrs = data.get("attrs", {})
    value = data["value"]

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
                    child_element = _serialize_element(child_tag, item)
                    element.append(child_element)
            else:
                child_element = _serialize_element(child_tag, child_data)
                element.append(child_element)
    elif isinstance(value, list):
        # Direct list (wrapped in _item tags)
        for item in value:
            child_element = _serialize_element("_item", item)
            element.append(child_element)
    else:
        # Scalar value
        element.text = _serialize_text_value(value)

    return element


def to_xml(
    value: Any,
    *,
    declaration: bool = True,
    root: bool | str | dict[str, Any] | None = None,
) -> str:
    """
    Encode a Python value to TYTX XML string.

    The input must follow the structure: {tag: {value: ..., attrs: ...}}
    where 'attrs' is optional (defaults to {}).

    Args:
        value: Data to encode in {tag: {value: ..., attrs: ...}} format.
               If root is specified, value is wrapped automatically.
        declaration: Include XML declaration
        root: Optional root wrapper:
            - None/False: value must be dict with single root key (default)
            - True: wrap in <tytx_root>...</tytx_root>
            - str: wrap in <{root}>...</{root}>
            - dict: wrap in <tytx_root {attrs}>...</tytx_root> with attributes

    Returns:
        XML string with typed values marked

    Example:
        >>> to_xml({"order": {"attrs": {"id": 123}, "value": {"total": {"value": Decimal("100")}}}})
        '<?xml version="1.0" ?><order id="123::L"><total>100::N</total></order>'

        >>> to_xml({"price": {"value": Decimal("100.50")}}, root=True)
        '<?xml version="1.0" ?><tytx_root><price>100.50::N</price></tytx_root>'
    """
    # Handle root wrapper
    if root is not None and root is not False:
        if root is True:
            root_tag = "tytx_root"
            root_attrs: dict[str, Any] = {}
        elif isinstance(root, str):
            root_tag = root
            root_attrs = {}
        elif isinstance(root, dict):
            root_tag = "tytx_root"
            root_attrs = root
        else:
            raise TypeError(
                f"root must be bool, str, or dict, not {type(root).__name__}"
            )

        # Wrap value in root element
        value = {root_tag: {"attrs": root_attrs, "value": value}}

    if not isinstance(value, dict) or len(value) != 1:
        raise ValueError("Input must be a dict with a single root element")

    root_tag, root_data = next(iter(value.items()))

    # Validate format
    if not isinstance(root_data, dict) or "value" not in root_data:
        raise ValueError(
            f"Root element '{root_tag}' must be a dict with 'value' key. "
            f"Expected format: {{'{root_tag}': {{'value': ..., 'attrs': ...}}}}"
        )

    element = _serialize_element(root_tag, root_data)
    xml_str = ET.tostring(element, encoding="unicode")

    if declaration:
        return f'<?xml version="1.0" ?>{xml_str}'
    return xml_str


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
    root = ET.fromstring(data)
    result = _deserialize_element(root)

    # Auto-unwrap tytx_root
    if root.tag == "tytx_root":
        return result["value"]

    return {root.tag: result}

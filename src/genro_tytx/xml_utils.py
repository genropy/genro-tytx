import xml.etree.ElementTree as ET
from typing import Any

from .registry import registry


def dict_to_xml(data: dict[str, Any], root_tag: str | None = None) -> str:
    """
    Convert a dictionary to an XML string using TYTX Protocol.

    Args:
        data: The dictionary to convert. Must have a single root key if root_tag is not provided.
        root_tag: Optional root tag name. If provided, data is treated as content of this root.

    Returns:
        XML string.
    """
    if root_tag is None:
        if len(data) != 1:
            raise ValueError("Data must have exactly one root key if root_tag is not provided")
        root_tag = list(data.keys())[0]
        content = data[root_tag]
    else:
        content = data

    root = _build_element(root_tag, content)
    return ET.tostring(root, encoding="unicode")


def _build_element(tag: str, content: Any) -> ET.Element:
    elem = ET.Element(tag)

    if isinstance(content, dict):
        for key, value in content.items():
            if key.startswith("@"):
                # Attribute
                attr_name = key[1:]
                # Use serialize for attributes
                elem.set(attr_name, registry.serialize(value))
            elif key == "#text":
                # Text content
                elem.text = registry.serialize(value)
            elif isinstance(value, list):
                # List of children
                for item in value:
                    elem.append(_build_element(key, item))
            else:
                # Single child
                elem.append(_build_element(key, value))
    elif isinstance(content, list):
        for item in content:
            elem.append(_build_element(tag, item))
    else:
        # Simple content
        elem.text = registry.serialize(content)

    return elem


def xml_to_dict(xml_string: str) -> dict[str, Any]:
    """
    Convert an XML string to a dictionary using TYTX Protocol.
    """
    root = ET.fromstring(xml_string)
    return {root.tag: _parse_element(root)}


def _parse_element(elem: ET.Element) -> Any:
    result: dict[str, Any] = {}

    # Attributes
    for key, value in elem.attrib.items():
        result[f"@{key}"] = registry.parse(value)

    # Children
    children_map: dict[str, Any] = {}
    for child in elem:
        child_val = _parse_element(child)
        if child.tag in children_map:
            if not isinstance(children_map[child.tag], list):
                children_map[child.tag] = [children_map[child.tag]]
            children_map[child.tag].append(child_val)
        else:
            children_map[child.tag] = child_val

    result.update(children_map)

    # Text content
    text = elem.text.strip() if elem.text else ""
    if text:
        # If element has no attributes and no children, return text value directly
        if not elem.attrib and not len(elem):
            return registry.parse(text)
        result["#text"] = registry.parse(text)

    if not result:
        return None

    return result

# XML Utilities

TYTX provides utilities for working with XML data using a structured format.

## XML Structure

TYTX represents XML as Python dictionaries with `attrs` and `value` keys:

```python
{
    "tag_name": {
        "attrs": {"attr1": value1, "attr2": value2},
        "value": content
    }
}
```

Where `value` can be:
- A scalar value (string, number, date, etc.)
- A nested dict for child elements
- A list for repeated elements
- `None` for empty elements

## Functions Overview

| Function | Purpose |
|----------|---------|
| `as_typed_xml(data)` | Serialize with TYTX type suffixes |
| `as_xml(data)` | Serialize to standard XML |
| `from_xml(xml_str)` | Parse XML with type hydration |

## Creating XML

### Simple Element

<!-- test: test_core.py::TestXMLNewStructure::test_as_typed_xml_simple -->

```python
from genro_tytx import as_typed_xml
from decimal import Decimal

data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
xml = as_typed_xml(data)
# <root>10.50::D</root>
```

### With Attributes

<!-- test: test_core.py::TestXMLNewStructure::test_as_typed_xml_with_attrs -->

```python
from genro_tytx import as_typed_xml
from decimal import Decimal

data = {
    "product": {
        "attrs": {"id": 123, "price": Decimal("99.50")},
        "value": "Widget"
    }
}
xml = as_typed_xml(data)
# <product id="123::I" price="99.50::D">Widget</product>
```

### Nested Elements

<!-- test: test_core.py::TestXMLNewStructure::test_as_typed_xml_nested -->

```python
from genro_tytx import as_typed_xml
from decimal import Decimal

data = {
    "order": {
        "attrs": {"id": 1},
        "value": {
            "item": {"attrs": {}, "value": "Widget"},
            "price": {"attrs": {}, "value": Decimal("25.00")}
        }
    }
}
xml = as_typed_xml(data)
# <order id="1::I">
#     <item>Widget</item>
#     <price>25.00::D</price>
# </order>
```

### Repeated Elements (Lists)

<!-- test: test_core.py::TestEdgeCases::test_xml_list_children -->

```python
from genro_tytx import as_typed_xml

data = {
    "items": {
        "attrs": {},
        "value": {
            "item": [
                {"attrs": {}, "value": "first"},
                {"attrs": {}, "value": "second"},
                {"attrs": {}, "value": "third"}
            ]
        }
    }
}
xml = as_typed_xml(data)
# <items>
#     <item>first</item>
#     <item>second</item>
#     <item>third</item>
# </items>
```

### Empty Elements

<!-- test: test_core.py::TestEdgeCases::test_xml_empty_element -->

```python
from genro_tytx import as_typed_xml

data = {"empty": {"attrs": {}, "value": None}}
xml = as_typed_xml(data)
# <empty />
```

### Custom Root Tag

<!-- test: test_core.py::TestEdgeCases::test_xml_root_tag_parameter -->

```python
from genro_tytx import as_typed_xml

data = {"attrs": {"id": 1}, "value": "content"}
xml = as_typed_xml(data, root_tag="custom")
# <custom id="1::I">content</custom>
```

## Standard XML (No Types)

<!-- test: test_core.py::TestXMLNewStructure::test_as_xml_simple -->

Use `as_xml()` for systems that don't understand TYTX:

```python
from genro_tytx import as_xml
from decimal import Decimal

data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
xml = as_xml(data)
# <root>10.50</root>  (no ::D suffix)
```

## Parsing XML

### Simple Element

<!-- test: test_core.py::TestXMLNewStructure::test_from_xml_simple -->

```python
from genro_tytx import from_xml

xml = "<root>hello</root>"
result = from_xml(xml)
# {"root": {"attrs": {}, "value": "hello"}}
```

### Typed Values

<!-- test: test_core.py::TestXMLNewStructure::test_from_xml_typed -->

```python
from genro_tytx import from_xml

xml = "<root>10.50::D</root>"
result = from_xml(xml)
# result["root"]["value"] → Decimal("10.50")
```

### With Attributes

<!-- test: test_core.py::TestXMLNewStructure::test_from_xml_with_attrs -->

```python
from genro_tytx import from_xml

xml = '<root id="123::I" name="test">content</root>'
result = from_xml(xml)
# result["root"]["attrs"]["id"] → 123
# result["root"]["attrs"]["name"] → "test"
# result["root"]["value"] → "content"
```

### Nested Elements

<!-- test: test_core.py::TestXMLNewStructure::test_from_xml_nested -->

```python
from genro_tytx import from_xml

xml = "<order><item>Widget</item><price>25.00::D</price></order>"
result = from_xml(xml)
# result["order"]["attrs"] → {}
# result["order"]["value"]["item"]["value"] → "Widget"
# result["order"]["value"]["price"]["value"] → Decimal("25.00")
```

### Repeated Children

<!-- test: test_core.py::TestEdgeCases::test_from_xml_repeated_children -->

```python
from genro_tytx import from_xml

xml = "<items><item>a</item><item>b</item><item>c</item></items>"
result = from_xml(xml)
# result["items"]["value"]["item"] is a list:
# [
#     {"attrs": {}, "value": "a"},
#     {"attrs": {}, "value": "b"},
#     {"attrs": {}, "value": "c"}
# ]
```

### Empty Elements

<!-- test: test_core.py::TestEdgeCases::test_from_xml_empty_element -->

```python
from genro_tytx import from_xml

xml = "<empty />"
result = from_xml(xml)
# result["empty"]["value"] → None
```

### Mixed Content

<!-- test: test_core.py::TestEdgeCases::test_from_xml_mixed_content -->

Text mixed with child elements:

```python
from genro_tytx import from_xml

xml = "<root>text<child>inner</child></root>"
result = from_xml(xml)
# result["root"]["value"]["#text"] → "text"
# result["root"]["value"]["child"]["value"] → "inner"
```

## Round-Trip

<!-- test: test_core.py::TestXMLNewStructure::test_xml_roundtrip -->

```python
from genro_tytx import as_typed_xml, from_xml
from decimal import Decimal

original = {
    "order": {
        "attrs": {"id": 42},
        "value": {
            "customer": {"attrs": {}, "value": "Acme"},
            "total": {"attrs": {}, "value": Decimal("199.99")}
        }
    }
}

# Serialize
xml = as_typed_xml(original)

# Parse back
restored = from_xml(xml)

# Verify
assert restored["order"]["attrs"]["id"] == 42
assert restored["order"]["value"]["customer"]["value"] == "Acme"
assert restored["order"]["value"]["total"]["value"] == Decimal("199.99")
```

## Error Handling

### Invalid Content

<!-- test: test_core.py::TestEdgeCases::test_xml_invalid_content_raises -->

```python
from genro_tytx import as_typed_xml

# Content must be {attrs, value} dict
data = {"root": "not a dict"}
as_typed_xml(data)  # raises ValueError
```

### Multiple Roots

<!-- test: test_core.py::TestEdgeCases::test_xml_multiple_roots_raises -->

```python
from genro_tytx import as_typed_xml

# Multiple roots without root_tag
data = {
    "a": {"attrs": {}, "value": "x"},
    "b": {"attrs": {}, "value": "y"}
}
as_typed_xml(data)  # raises ValueError

# Use root_tag to wrap
as_typed_xml(data, root_tag="root")  # OK
```

## Use Cases

### Configuration Files

```python
from genro_tytx import from_xml

config_xml = '''
<config>
    <timeout>30::I</timeout>
    <rate_limit>100.50::D</rate_limit>
    <enabled>true::B</enabled>
</config>
'''
config = from_xml(config_xml)
timeout = config["config"]["value"]["timeout"]["value"]  # → 30 (int)
```

### Data Export

```python
from genro_tytx import as_typed_xml
from decimal import Decimal

orders = {
    "orders": {
        "attrs": {"count": 2},
        "value": {
            "order": [
                {"attrs": {"id": 1}, "value": {"total": {"attrs": {}, "value": Decimal("100")}}},
                {"attrs": {"id": 2}, "value": {"total": {"attrs": {}, "value": Decimal("200")}}}
            ]
        }
    }
}
xml = as_typed_xml(orders)
```

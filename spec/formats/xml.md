# TYTX XML Format Specification

**Version**: 1.0

This document specifies how TYTX integrates with XML.

## Overview

XML attributes and text content are always strings. TYTX encodes type information directly in these strings using the `value::type_code` syntax.

## Encoding

### Attributes

```xml
<item price="100.50::D" quantity="5::I" />
```

### Text Content

```xml
<price>100.50::D</price>
<date>2025-01-15::d</date>
```

### Mixed Content

```xml
<order id="123::I" created="2025-01-15T10:30::dt">
  <item name="Widget" price="10.50::D" />
  <item name="Gadget" price="25.00::D" />
  <total>35.50::D</total>
</order>
```

### Global Marker

For entire XML documents, add a processing instruction:

```xml
<?tytx version="1.0"?>
<order>
  <price>100.50::D</price>
</order>
```

Or use a root attribute:

```xml
<order tytx="1.0">
  <price>100.50::D</price>
</order>
```

## Decoding (Hydration)

### Algorithm

1. Parse XML normally
2. Walk all attributes and text nodes
3. For each string value, check if it matches `value::type_code`
4. If matched and type_code is registered, convert to native type
5. If not matched or unknown code, keep as string

### Python Implementation

```python
import xml.etree.ElementTree as ET
from genro_tytx.encoders import hydrate_xml_element

# Parse XML
root = ET.fromstring(xml_string)

# Hydrate
data = hydrate_xml_element(root)
```

### Result Structure

XML is converted to a dictionary:

```python
# Input XML
# <order id="123::I">
#   <price>100.50::D</price>
#   <items>
#     <item name="Widget" />
#   </items>
# </order>

# Output dict
{
    "@id": 123,  # Attributes prefixed with @
    "price": Decimal("100.50"),
    "items": {
        "item": {"@name": "Widget"}
    }
}
```

## Encoding (Serialization)

### Python Implementation

```python
from genro_tytx.encoders import encode_xml

data = {
    "@id": 123,
    "price": Decimal("100.50"),
    "date": date(2025, 1, 15)
}

xml_string = encode_xml(data, root_tag="order")
# <order id="123::I">
#   <price>100.50::D</price>
#   <date>2025-01-15::d</date>
# </order>
```

## Conventions

### Attribute Prefix

Dictionary keys starting with `@` become XML attributes:

```python
{"@id": 123, "name": "Widget"}
# <item id="123::I"><name>Widget</name></item>
```

### Text Content

Use `#text` key for mixed content:

```python
{"@class": "highlight", "#text": "Hello"}
# <span class="highlight">Hello</span>
```

### Lists

Repeated elements become lists:

```python
{"item": [{"@name": "A"}, {"@name": "B"}]}
# <item name="A" /><item name="B" />
```

## Namespaces

TYTX type codes work with namespaced attributes:

```xml
<order xmlns:t="http://tytx.genro.org/1.0">
  <price t:type="D">100.50</price>
</order>
```

Alternative: keep `::` syntax in values (simpler):

```xml
<order>
  <price>100.50::D</price>
</order>
```

## Schema Considerations

### Without Schema

TYTX is self-describing; no XSD required.

### With Schema

If XSD validation is needed, define all typed values as `xs:string`:

```xml
<xs:element name="price" type="xs:string"/>
```

The `::D` suffix is valid string content.

## Edge Cases

### CDATA Sections

TYTX values in CDATA are processed:

```xml
<script><![CDATA[var price = "100::D";]]></script>
```

The content is NOT hydrated (it's code, not data).

### Comments

Comments are ignored:

```xml
<!-- price: 100::D -->
```

### Empty Elements

Empty elements with type hints:

```xml
<price type="decimal"/>
```

Or self-closing with attribute:

```xml
<price value="0::D"/>
```

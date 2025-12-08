# XML Format Reference

TYTX XML encoding for legacy systems and XML-based integrations.

> **Note**: Most web applications should use JSON (the default). Use XML only when integrating with systems that require it.

## Basic Structure

XML format requires a strict structure: `{tag: {value: ..., attrs?: {...}}}`

- `value` is **required** - the element content
- `attrs` is **optional** - element attributes (defaults to `{}`)

```python
from decimal import Decimal
from datetime import date
from genro_tytx import to_xml, from_xml

# Simple element
data = {"price": {"value": Decimal("100.50")}}
xml = to_xml(data)
# Output: <?xml version="1.0" ?><price>100.50::N</price>

# With attributes
data = {
    "order": {
        "attrs": {"id": 123, "created": date(2025, 1, 15)},
        "value": {"total": {"value": Decimal("100.50")}}
    }
}
xml = to_xml(data)
# Output: <order id="123::L" created="2025-01-15::D"><total>100.50::N</total></order>
```

## Nested Structures

```python
data = {
    "invoice": {
        "value": {
            "header": {
                "value": {
                    "date": {"value": date(2025, 1, 15)},
                    "number": {"value": 12345}
                }
            },
            "total": {"value": Decimal("999.99")}
        }
    }
}
xml = to_xml(data)
# <invoice>
#   <header>
#     <date>2025-01-15::D</date>
#     <number>12345::L</number>
#   </header>
#   <total>999.99::N</total>
# </invoice>
```

## Lists and Repeated Elements

### Named repeated elements

```python
data = {
    "order": {
        "value": {
            "item": [
                {"attrs": {"name": "Widget"}, "value": Decimal("10.50")},
                {"attrs": {"name": "Gadget"}, "value": Decimal("25.00")}
            ]
        }
    }
}
xml = to_xml(data)
# <order>
#   <item name="Widget">10.50::N</item>
#   <item name="Gadget">25.00::N</item>
# </order>
```

### Direct list (creates `_item` tags)

```python
data = {
    "prices": {
        "value": [
            {"value": Decimal("1.1")},
            {"value": Decimal("2.2")}
        ]
    }
}
xml = to_xml(data)
# <prices><_item>1.1::N</_item><_item>2.2::N</_item></prices>
```

## The `root` Parameter

Wrap arbitrary data in a root element:

```python
# root=True wraps in <tytx_root>
data = {"price": {"value": Decimal("100")}}
xml = to_xml(data, root=True)
# <tytx_root><price>100::N</price></tytx_root>

# root="custom" uses custom tag name
xml = to_xml(data, root="data")
# <data><price>100::N</price></data>

# root={...} adds attributes to tytx_root
xml = to_xml(data, root={"version": 1})
# <tytx_root version="1::L"><price>100::N</price></tytx_root>
```

### Wrapping lists

```python
data = [{"value": Decimal("1.1")}, {"value": Decimal("2.2")}]
xml = to_xml(data, root=True)
# <tytx_root><_item>1.1::N</_item><_item>2.2::N</_item></tytx_root>
```

## Auto-unwrap on Decode

When decoding, `tytx_root` is automatically unwrapped:

```python
xml = "<tytx_root><price>100.50::N</price></tytx_root>"
decoded = from_xml(xml)
# Returns: {"price": {"attrs": {}, "value": Decimal("100.50")}}
# NOT: {"tytx_root": {"attrs": {}, "value": {...}}}

# Regular root elements are NOT unwrapped
xml = "<order><price>100.50::N</price></order>"
decoded = from_xml(xml)
# Returns: {"order": {"attrs": {}, "value": {"price": {...}}}}
```

## Decoded Structure

Decoded XML always returns the full `{tag: {attrs: {...}, value: ...}}` structure:

```python
from_xml("<price>100.50::N</price>")
# Returns: {"price": {"attrs": {}, "value": Decimal("100.50")}}

from_xml('<item name="Widget" price="10::L" />')
# Returns: {"item": {"attrs": {"name": "Widget", "price": 10}, "value": None}}
```

## JavaScript/TypeScript

```javascript
import { toXml, fromXml } from 'genro-tytx';
import Decimal from 'decimal.js';

const data = {
    order: {
        attrs: { id: 123 },
        value: { total: { value: new Decimal('100.50') } }
    }
};

const xml = toXml(data);
const decoded = fromXml(xml);
```

### With root wrapper

```javascript
const data = { price: { value: new Decimal('100.50') } };

// Wrap in tytx_root
const xml = toXml(data, { root: true });

// Custom root tag
const xml2 = toXml(data, { root: 'data' });

// Root with attributes
const xml3 = toXml(data, { root: { version: 1 } });
```

## Options

### `declaration` (default: `true`)

Include XML declaration:

```python
to_xml(data, declaration=True)   # <?xml version="1.0" ?><price>...
to_xml(data, declaration=False)  # <price>...
```

## Wire Format

Type suffixes in XML:

```xml
<order id="123::L">
    <price>100.50::N</price>
    <date>2025-01-15::D</date>
    <active>1::B</active>
    <name>Widget</name>
</order>
```

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `::N` | `100.50::N` |
| Date | `::D` | `2025-01-15::D` |
| DateTime | `::DHZ` | `2025-01-15T10:30:00.000Z::DHZ` |
| Time | `::H` | `10:30:00.000::H` |
| Boolean | `::B` | `1::B` or `0::B` |
| Integer | `::L` | `123::L` |
| Float | `::R` | `3.14::R` |

Untyped values (plain strings) have no suffix.

## Error Handling

```python
# Invalid: missing 'value' key
to_xml({"price": Decimal("100")})
# Raises: ValueError: Element 'price' must be a dict with 'value' key

# Invalid: multiple root elements
to_xml({"a": {"value": 1}, "b": {"value": 2}})
# Raises: ValueError: Input must be object with single root element
```

## XML Entities

Special characters are escaped automatically:

```python
data = {"message": {"value": 'Hello <world> & "friends"'}}
xml = to_xml(data)
# <message>Hello &lt;world&gt; &amp; &quot;friends&quot;</message>

# Decoded back correctly
decoded = from_xml(xml)
# {"message": {"attrs": {}, "value": 'Hello <world> & "friends"'}}
```

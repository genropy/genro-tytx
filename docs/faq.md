# FAQ

Frequently asked questions about TYTX.

## General

### What is TYTX?

TYTX (Typed Text) is a protocol for encoding type information in text strings using `value::type_code` syntax. It solves the "stringly typed" problem where JSON loses type information for Decimal, Date, and other non-native types.

### Why not just use JSON types?

JSON only supports: string, number, boolean, null, array, object. It doesn't distinguish between:
- `float` vs `Decimal` (precision matters for money!)
- `string` vs `date` vs `datetime`

TYTX adds this distinction while remaining text-compatible.

### Is TYTX a new format?

No, TYTX is a **convention** for encoding types in existing formats (JSON, XML, etc.). A TYTX-encoded JSON file is still valid JSON.

## Usage

### Why does `as_typed_text("hello")` not add `::T`?

Strings are the default interpretation for untyped values, so adding `::T` would be redundant. This keeps output cleaner and reduces data size.

### How do I handle Decimal precision in JavaScript?

JavaScript doesn't have a native Decimal type. The JS implementation returns Decimal values as numbers (e.g., `99.99`). For financial precision, use a library like [decimal.js](https://github.com/MikeMcl/decimal.js/) for arithmetic.

```javascript
import { from_text } from 'genro-tytx';
import Decimal from 'decimal.js';

const value = from_text("99.99::N");  // Returns 99.99 (number)
const decimal = new Decimal(value);   // Use decimal.js for precise math
```

### Can I use TYTX with Pydantic?

Yes! Hydrate JSON before passing to Pydantic:

```python
from genro_tytx import from_json
from pydantic import BaseModel
from decimal import Decimal
from datetime import date

class Order(BaseModel):
    price: Decimal
    date: date

# TYTX hydrates types before Pydantic validates
data = from_json('{"price": "99.99::N", "date": "2025-01-15::D"}')
order = Order(**data)  # Works!
```

### How do I add a custom type?

Create a `DataType` subclass and register it:

```python
from genro_tytx import registry
from genro_tytx.base import DataType
import uuid

class UUIDType(DataType):
    name = "uuid"
    code = "U"
    python_type = uuid.UUID

    def parse(self, value: str) -> uuid.UUID:
        return uuid.UUID(value)

    def serialize(self, value: uuid.UUID) -> str:
        return str(value)

registry.register(UUIDType)
```

### Why use `::` as separator?

The `::` sequence is:
- Unlikely to appear in normal values
- Easy to parse (split on last `::`)
- Visually distinct
- Already used in some programming languages for type annotation

### Does TYTX work with URLs containing `::`?

Yes, TYTX uses the **last** `::` in a string as the type separator:

```python
from_text("http://example.com::T")  # → "http://example.com"
from_text("http://example.com")     # → "http://example.com" (no type)
```

## XML

### What's the `{attrs: {}, value: ...}` structure?

TYTX represents XML elements as dictionaries with:
- `attrs`: dict of attributes
- `value`: element content (scalar, nested dict, or list)

This structure preserves both attributes and content while remaining easy to work with in Python.

### How do I handle repeated XML elements?

Repeated elements automatically become lists:

```python
from genro_tytx import from_xml

xml = "<items><item>a</item><item>b</item></items>"
result = from_xml(xml)
# result["items"]["value"]["item"] is a list
```

## Performance

### Is TYTX slower than regular JSON?

Slightly. TYTX adds:
- Type suffix parsing on read
- Type lookup for serialization

For most applications, this overhead is negligible. If performance is critical, consider:
- Using `as_json()` for output (no type suffixes)
- Processing TYTX only at API boundaries

### Does TYTX increase data size?

Yes, type suffixes add ~3-5 bytes per typed value. For a JSON object with 10 typed fields, that's roughly 30-50 extra bytes. Usually not significant.

## Compatibility

### Which Python versions are supported?

Python 3.10 and higher.

### Are there other language implementations?

Currently:
- **Python**: Full implementation
- **JavaScript**: Full implementation (included in package)

### Is TYTX compatible with Genropy?

Yes! TYTX uses Genropy-compatible type codes as primary codes:

| Code | Type | Aliases |
|------|------|---------|
| `L` | integer | `I`, `INT`, `INTEGER`, `LONG` |
| `R` | float | `F`, `FLOAT`, `REAL` |
| `N` | decimal | `NUMERIC`, `DECIMAL` |
| `D` | date | `DATE` |
| `DH` | datetime | `DT`, `DHZ`, `DATETIME` |
| `H` | time | `TIME`, `HZ` |
| `T` | string | `S`, `STRING`, `TEXT` |
| `B` | boolean | `BOOL`, `BOOLEAN` |
| `JS` | json | `JSON` |

## Troubleshooting

### Why is my value returned as a string?

Check:
1. Is the type code valid? (`registry.get("X")` returns `None` for unknown types)
2. Is there a `::` in the value? (`from_text("123")` returns `"123"`)
3. Is the type registered? (custom types need `registry.register()`)

### Why does `from_xml` return wrong structure?

Ensure your XML is well-formed. Common issues:
- Missing closing tags
- Unescaped special characters
- Mixed content (text + elements)

### How do I debug type detection?

```python
from genro_tytx import registry

# Check what type a value gets
print(registry.get_for_value(my_value))

# Check if a type code exists
print(registry.get("L"))  # → IntType

# Check if string is typed
print(registry.is_typed("123::L"))  # True
print(registry.is_typed("123"))     # False
```

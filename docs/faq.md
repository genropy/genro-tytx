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

TYTX automatically uses [big.js](https://github.com/MikeMcl/big.js/) or [decimal.js](https://github.com/MikeMcl/decimal.js/) if installed. Install one for precise decimal arithmetic:

```bash
npm install big.js       # Lightweight (8KB) - recommended
# or
npm install decimal.js   # Full-featured (32KB)
```

```javascript
import { from_text, decimalLibName } from 'genro-tytx';

console.log(decimalLibName);  // "big.js", "decimal.js", or "number"

const value = from_text("99.99::N");
// With big.js: returns Big instance
// Without: returns 99.99 (number)
```

If no decimal library is installed, native JavaScript numbers are used (may lose precision for large decimals).

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

Use `register_class` to register custom extension types (prefixed with `~`):

```python
from genro_tytx import registry
import uuid

registry.register_class(
    code="UUID",  # becomes "~UUID" in wire format
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)

# Usage
from_text("550e8400-e29b-41d4-a716-446655440000::~UUID")  # → UUID
```

See the [specification](spec/type-codes.md#custom-types--prefix) for complete documentation.

### What are struct schemas?

Struct schemas let you define type patterns for data structures. Instead of typing each field inline, you define a schema once and reference it with `@`:

```python
from genro_tytx import registry, from_text

# Define a schema
registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N', 'created': 'D'})

# Use it
from_text('{"name": "Acme", "balance": "100", "created": "2025-01-15"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100"), "created": date(2025, 1, 15)}
```

See [structs.md](spec/structs.md) for complete documentation.

### What's the difference between `@` and `#@`?

- `::@STRUCT` applies the schema to a single value
- `::#@STRUCT` applies the schema to each element of an array (batch mode)

```python
# Single struct
from_text('["3.7", "7.3"]::@POINT')  # → {"x": 3.7, "y": 7.3}

# Array of structs
from_text('[["1", "2"], ["3", "4"]]::#@POINT')
# → [{"x": 1.0, "y": 2.0}, {"x": 3.0, "y": 4.0}]
```

### What are the different schema types?

| Schema Type | Definition | Best For |
|-------------|------------|----------|
| Dict | `{'name': 'T', 'balance': 'N'}` | JSON objects |
| List positional | `['T', 'L', 'N']` | Fixed-length tuples |
| List homogeneous | `['N']` | Arrays of same type |
| String named | `'x:R,y:R'` | CSV data → dict |
| String anonymous | `'R,R'` | CSV data → list |

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

### What type codes does TYTX use?

TYTX uses mnemonic type codes:

| Code | Name | Python Type |
|------|------|-------------|
| `L` | integer | `int` |
| `R` | float | `float` |
| `N` | decimal | `Decimal` |
| `D` | date | `date` |
| `DHZ` | datetime | `datetime` |
| `H` | time | `time` |
| `T` | str | `str` |
| `B` | bool | `bool` |
| `JS` | json | `dict`/`list` |

## Troubleshooting

### Why is my value returned as a string?

Check:
1. Is the type code valid? (`registry.get("X")` returns `None` for unknown types)
2. Is there a `::` in the value? (`from_text("123")` returns `"123"`)
3. Is the type registered? (custom types need `registry.register_class()`)

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

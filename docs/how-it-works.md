# How It Works

Technical details of the TYTX wire format and encoding rules.

> **Note**: You don't need to understand this to use TYTX. The middleware handles encoding/decoding automatically. This document is for those who want to understand the internals or implement TYTX in other languages.

## Wire Format Overview

TYTX encodes type information using `value::TYPE` suffixes:

```text
{"price": "100.50::N", "date": "2025-01-15::D"}::JS
```

The `::JS` suffix marks the entire payload as TYTX-encoded JSON.

## Type Codes

### Encoded Types (non-native to JSON)

| Code | Name | Wire Format | Python | JavaScript |
|------|------|-------------|--------|------------|
| `N` | Numeric/Decimal | `"100.50::N"` | `Decimal("100.50")` | `Decimal("100.50")` |
| `D` | Date | `"2025-01-15::D"` | `date(2025, 1, 15)` | `Date` (midnight UTC) |
| `DHZ` | DateTime | `"2025-01-15T10:30:00.000Z::DHZ"` | `datetime(...)` | `Date` |
| `H` | Time (Hour) | `"10:30:00::H"` | `time(10, 30, 0)` | `Date` (epoch date) |

### Decode-only Types (native to JSON, used in XML)

| Code | Name | Wire Format | Python | JavaScript |
|------|------|-------------|--------|------------|
| `L` | Long/Integer | `"42::L"` | `int` | `number` |
| `R` | Real/Float | `"3.14::R"` | `float` | `number` |
| `B` | Boolean | `"1::B"` or `"0::B"` | `bool` | `boolean` |
| `T` | Text/String | `"hello::T"` | `str` | `string` |

> **Note**: `DH` (naive datetime) is deprecated but still decoded for backward compatibility.

## Encoding Rules

### JSON Format

1. **Scalars with special types** get the type suffix:

   ```text
   Decimal("100.50")  →  "100.50::N"
   date(2025, 1, 15)  →  "2025-01-15::D"
   ```

2. **Native JSON types** pass through unchanged:

   ```text
   "hello"  →  "hello"
   42       →  42
   True     →  true
   None     →  null
   ```

3. **Objects/Arrays** containing special types get `::JS` suffix:

   ```text
   {"price": Decimal("100.50")}  →  '{"price": "100.50::N"}::JS'
   [Decimal("1"), Decimal("2")]  →  '["1::N", "2::N"]::JS'
   ```

4. **Plain objects/arrays** (no special types) have no suffix:

   ```text
   {"name": "Widget", "qty": 5}  →  '{"name": "Widget", "qty": 5}'
   ```

### DateTime Serialization

All datetime values are serialized in UTC with millisecond precision:

```python
datetime(2025, 1, 15, 10, 30, 45, 123456)
# → "2025-01-15T10:30:45.123Z::DHZ"
# (microseconds truncated to milliseconds for JS compatibility)
```

Naive datetimes are treated as UTC:

```python
datetime(2025, 1, 15, 10, 30)  # no tzinfo
# → "2025-01-15T10:30:00.000Z::DHZ"
```

### Time Serialization

Time values include milliseconds only when non-zero:

```text
time(10, 30, 0)        →  "10:30:00::H"
time(10, 30, 0, 123000) →  "10:30:00.123::H"
```

## HTTP Transport

### MIME Types

| Format | Content-Type |
|--------|-------------|
| JSON | `application/vnd.tytx+json` |
| XML | `application/vnd.tytx+xml` |
| MessagePack | `application/vnd.tytx+msgpack` |

### Query String Encoding

Typed values in query strings use the same suffix format:

```text
?date=2025-01-15::D&price=100.50::N&active=1::B
```

### Header Encoding

Custom headers with `x-tytx-` prefix can carry typed values:

```text
x-tytx-timestamp: 10:30:00::H
x-tytx-expires: 2025-12-31::D
```

## XML Format

In XML, all values are strings, so all types are encoded:

```xml
<order id="123::L">
    <price>100.50::N</price>
    <date>2025-01-15::D</date>
    <active>1::B</active>
    <name>Widget</name>
</order>
```

### XML Input Structure

**Important**: The XML encoder requires a strict `{value: ..., attrs?: {...}}` structure for every element.

```python
# ✅ Correct format
{"price": {"value": Decimal("100.50")}}
{"price": {"attrs": {}, "value": Decimal("100.50")}}
{"order": {"attrs": {"id": 123}, "value": None}}

# ❌ Invalid format - will raise ValueError
{"price": Decimal("100.50")}  # Missing 'value' key
```

### Building XML Data

Each element must be a dict with:

- `value` (required): The element content - can be scalar, dict (children), list, or None
- `attrs` (optional): Attributes dict, defaults to `{}`

```python
from decimal import Decimal
from datetime import date

# Simple scalar
data = {"price": {"value": Decimal("100.50")}}
# → <price>100.50::N</price>

# With attributes
data = {
    "order": {
        "attrs": {"id": 123, "date": date(2025, 1, 15)},
        "value": {"total": {"value": Decimal("100.50")}}
    }
}
# → <order id="123::L" date="2025-01-15::D"><total>100.50::N</total></order>

# Nested structure
data = {
    "invoice": {
        "value": {
            "header": {
                "value": {
                    "number": {"value": 12345}
                }
            }
        }
    }
}
# → <invoice><header><number>12345::L</number></header></invoice>

# Repeated elements (list of dicts)
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
# → <order><item name="Widget">10.50::N</item><item name="Gadget">25.00::N</item></order>

# Direct list as value (creates _item tags)
data = {
    "prices": {
        "value": [
            {"value": Decimal("1.1")},
            {"value": Decimal("2.2")}
        ]
    }
}
# → <prices><_item>1.1::N</_item><_item>2.2::N</_item></prices>
```

### The `root` Parameter

Use `root` to wrap arbitrary data in a root element:

```python
# root=True wraps in <tytx_root>
to_xml({"price": {"value": Decimal("100")}}, root=True)
# → <tytx_root><price>100::N</price></tytx_root>

# root="custom" wraps in custom tag
to_xml({"price": {"value": Decimal("100")}}, root="data")
# → <data><price>100::N</price></data>

# root={...} adds attributes to tytx_root
to_xml({"price": {"value": Decimal("100")}}, root={"version": 1})
# → <tytx_root version="1::L"><price>100::N</price></tytx_root>
```

### Auto-unwrap `tytx_root`

When decoding, if the root element is `tytx_root`, it is automatically unwrapped:

```python
from_xml("<tytx_root><price>100::N</price></tytx_root>")
# Returns: {"price": {"attrs": {}, "value": Decimal("100")}}
# NOT: {"tytx_root": {"attrs": {}, "value": {...}}}

from_xml("<order><price>100::N</price></order>")
# Returns: {"order": {"attrs": {}, "value": {"price": {...}}}}
# (regular root elements are NOT unwrapped)
```

### Decoded Structure

Decoded XML always returns `{tag: {attrs: {...}, value: ...}}` structure:

```python
from_xml("<price>100.50::N</price>")
# Returns: {"price": {"attrs": {}, "value": Decimal("100.50")}}

from_xml('<item name="Widget" price="10::L" />')
# Returns: {"item": {"attrs": {"name": "Widget", "price": 10}, "value": None}}
```

## MessagePack Format

MessagePack uses ExtType(42) for TYTX values:

```python
# ExtType structure
ExtType(42, b"N:100.50")  # Decimal
ExtType(42, b"D:2025-01-15")  # Date
```

## Decimal Library Detection

### Python

Python's `decimal.Decimal` is always available (stdlib).

### JavaScript/TypeScript

TYTX auto-detects decimal libraries in this order:

1. `big.js` (preferred)
2. `decimal.js`
3. Native `Number` (fallback - precision loss warning)

You can force a specific library:

```bash
TYTX_DECIMAL_LIB=big.js      # Force big.js
TYTX_DECIMAL_LIB=decimal.js  # Force decimal.js
TYTX_DECIMAL_LIB=number      # Force native Number
```

## Whitespace Handling

Decoders trim leading/trailing whitespace before processing:

```python
from_tytx('  {"price": "100::N"}::JS  ')
# Works correctly
```

## Error Handling

### Unknown Type Codes

Unknown suffixes are returned as strings:

```python
from_tytx('"something::UNKNOWN"')
# Returns: "something::UNKNOWN" (string)
```

### Invalid Values

Invalid values for a type code raise `TYTXDecodeError`:

```python
from_tytx('"not-a-date::D"')
# Raises TYTXDecodeError
```

## TYTX Base vs TYTX (Full)

| Feature | TYTX Base | TYTX |
|---------|:---------:|:----:|
| Scalar types (N, D, DHZ, H, B, L, R, T) | ✅ | ✅ |
| JSON / XML / MessagePack | ✅ | ✅ |
| HTTP middleware | ✅ | ✅ |
| Struct schemas (`@`) | ❌ | ✅ |
| XTYTX envelope | ❌ | ✅ |
| Pydantic integration | ❌ | ✅ |

**Use TYTX Base** when you only need scalar types and want a minimal footprint.

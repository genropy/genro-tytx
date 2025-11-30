# Quick Start

Get productive with TYTX in 5 minutes.

## Core Concept

TYTX uses `value::type_code` syntax to encode type information in strings:

| Syntax | Python Result | JavaScript Result |
|--------|---------------|-------------------|
| `"123::L"` | `123` (int) | `123` (number) |
| `"100.50::N"` | `Decimal("100.50")` | `100.50` (number) |
| `"2025-01-15::D"` | `date(2025, 1, 15)` | `Date` object |
| `"true::B"` | `True` | `true` |

## Basic Usage

### Parsing Typed Strings

```python
from genro_tytx import from_text
from decimal import Decimal
from datetime import date, datetime, time

# Parse with embedded type code
from_text("123::L")                    # → 123 (L = Long/int)
from_text("100.50::N")                 # → Decimal("100.50") (N = Numeric)
from_text("3.14::R")                   # → 3.14 (R = Real/float)
from_text("2025-01-15::D")             # → date(2025, 1, 15) (D = Date)
from_text("2025-01-15T10:00:00::DH")   # → datetime(...) (DH = DateTime)
from_text("10:30:00::H")               # → time(10, 30) (H = Hour/time)
from_text("true::B")                   # → True (B = Boolean)
from_text('{"a":1}::JS')               # → {"a": 1} (JS = JSON)

# Parse with explicit type
from_text("123", "L")                  # → 123
from_text("2025-01-15", "D")           # → date(2025, 1, 15)
```

### Serializing to Typed Strings

```python
from genro_tytx import as_typed_text

as_typed_text(123)                     # → "123::L"
as_typed_text(3.14)                    # → "3.14::R"
as_typed_text(Decimal("100.50"))       # → "100.50::N"
as_typed_text(date(2025, 1, 15))       # → "2025-01-15::D"
as_typed_text(datetime(2025, 1, 15, 10))  # → "2025-01-15T10:00:00::DH"
as_typed_text(True)                    # → "true::B"
as_typed_text({"a": 1})                # → '{"a": 1}::JS'
as_typed_text("hello")                 # → "hello" (no suffix for strings)
```

### Plain Serialization (No Type)

```python
from genro_tytx import as_text

as_text(123)                           # → "123"
as_text(Decimal("100.50"))             # → "100.50"
as_text(date(2025, 1, 15))             # → "2025-01-15"
as_text(True)                          # → "true"
```

## JSON Usage

### Typed JSON

```python
from genro_tytx import as_typed_json, from_json
from decimal import Decimal
from datetime import date

# Serialize with types
data = {
    "price": Decimal("99.99"),
    "date": date(2025, 1, 15),
    "name": "Widget"
}
json_str = as_typed_json(data)
# '{"price": "99.99::N", "date": "2025-01-15::D", "name": "Widget"}'

# Parse back - types are restored
result = from_json(json_str)
# {"price": Decimal("99.99"), "date": date(2025, 1, 15), "name": "Widget"}
```

### Standard JSON

```python
from genro_tytx import as_json

# For systems that don't understand TYTX
as_json({"price": Decimal("99.99")})
# '{"price": 99.99}'  (Decimal → float)
```

## XML Usage

TYTX uses `{tag: {attrs: {}, value: ...}}` structure:

```python
from genro_tytx import as_typed_xml, from_xml
from decimal import Decimal

# Create typed XML
data = {
    "order": {
        "attrs": {"id": 123},
        "value": {
            "item": {"attrs": {}, "value": "Widget"},
            "price": {"attrs": {}, "value": Decimal("99.99")}
        }
    }
}
xml = as_typed_xml(data)
# <order id="123::L"><item>Widget</item><price>99.99::N</price></order>

# Parse XML
result = from_xml(xml)
# result["order"]["attrs"]["id"] → 123
# result["order"]["value"]["price"]["value"] → Decimal("99.99")
```

## JavaScript Usage

The JavaScript API mirrors Python exactly:

```javascript
const { from_text, as_typed_text, from_json, as_typed_json } = require('genro-tytx');

// Parse
from_text("123::L")           // → 123
from_text("100.50::N")        // → 100.50
from_text("2025-01-15::D")    // → Date object

// Serialize
as_typed_text(123)            // → "123::L"
as_typed_text(new Date())     // → "2025-01-15::D"

// JSON
const data = { price: 99.99, count: 42 };
as_typed_json(data)           // → '{"price":"99.99::R","count":"42::L"}'
from_json('{"x": "10::L"}')   // → {x: 10}
```

## Type Codes Reference

| Code | Name | Python Type | Example |
|------|------|-------------|---------|
| `L` | integer | `int` | `"123::L"` |
| `R` | float | `float` | `"1.5::R"` |
| `N` | decimal | `Decimal` | `"100.50::N"` |
| `B` | bool | `bool` | `"true::B"` |
| `T` | str | `str` | `"hello::T"` |
| `D` | date | `date` | `"2025-01-15::D"` |
| `DHZ` | datetime | `datetime` | `"2025-01-15T10:00:00Z::DHZ"` |
| `H` | time | `time` | `"10:30:00::H"` |
| `JS` | json | `dict`/`list` | `'{"a":1}::JS'` |

## Next Steps

- [Type Formatting Guide](guide/formatting.md) - Locale-aware formatting
- [Custom Types](guide/custom-types.md) - Register your own types
- [API Reference](api/reference.md) - Complete API documentation

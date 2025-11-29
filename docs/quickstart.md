# Quick Start

Get productive with TYTX in 5 minutes.

## Core Concept

TYTX uses `value::type_code` syntax to encode type information in strings:

| Syntax | Result |
|--------|--------|
| `"123::I"` | `int(123)` |
| `"100.50::D"` | `Decimal("100.50")` |
| `"2025-01-15::d"` | `date(2025, 1, 15)` |
| `"true::B"` | `True` |

## Basic Usage

<!-- test: test_core.py::TestFromText -->

### Parsing Typed Strings

```python
from genro_tytx import from_text
from decimal import Decimal
from datetime import date, datetime

# Parse with embedded type
from_text("123::I")                    # → 123
from_text("100.50::D")                 # → Decimal("100.50")
from_text("2025-01-15::d")             # → date(2025, 1, 15)
from_text("2025-01-15T10:00:00::dt")   # → datetime(2025, 1, 15, 10, 0, 0)
from_text("true::B")                   # → True
from_text('{"a":1}::J')                # → {"a": 1}
from_text("a,b,c::L")                  # → ["a", "b", "c"]

# Parse with explicit type
from_text("123", "I")                  # → 123
from_text("2025-01-15", "d")           # → date(2025, 1, 15)
```

### Serializing to Typed Strings

<!-- test: test_core.py::TestAsTypedText -->

```python
from genro_tytx import as_typed_text

as_typed_text(123)                     # → "123::I"
as_typed_text(Decimal("100.50"))       # → "100.50::D"
as_typed_text(date(2025, 1, 15))       # → "2025-01-15::d"
as_typed_text(datetime(2025, 1, 15, 10))  # → "2025-01-15T10:00:00::dt"
as_typed_text(True)                    # → "true::B"
as_typed_text({"a": 1})                # → '{"a": 1}::J'
as_typed_text("hello")                 # → "hello" (no suffix for strings)
```

### Plain Serialization (No Type)

<!-- test: test_core.py::TestAsText -->

```python
from genro_tytx import as_text

as_text(123)                           # → "123"
as_text(Decimal("100.50"))             # → "100.50"
as_text(date(2025, 1, 15))             # → "2025-01-15"
as_text(True)                          # → "true"
```

## JSON Usage

<!-- test: test_core.py::TestJSONUtils -->

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
# '{"price": "99.99::D", "date": "2025-01-15::d", "name": "Widget"}'

# Parse back
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

<!-- test: test_core.py::TestXMLNewStructure -->

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
# <order id="123::I"><item>Widget</item><price>99.99::D</price></order>

# Parse XML
result = from_xml(xml)
# result["order"]["attrs"]["id"] → 123
# result["order"]["value"]["price"]["value"] → Decimal("99.99")
```

## Type Codes Reference

| Code | Aliases | Python Type | Example |
|------|---------|-------------|---------|
| `I` | `INT`, `INTEGER`, `LONG` | `int` | `"123::I"` |
| `F` | `R`, `REAL` | `float` | `"1.5::F"` |
| `D` | `N`, `NUMERIC` | `Decimal` | `"100.50::D"` |
| `B` | `BOOL`, `BOOLEAN` | `bool` | `"true::B"` |
| `S` | `T`, `TEXT` | `str` | `"hello::S"` |
| `d` | - | `date` | `"2025-01-15::d"` |
| `dt` | `DH`, `DHZ` | `datetime` | `"2025-01-15T10:00::dt"` |
| `J` | - | `dict`/`list` | `'{"a":1}::J'` |
| `L` | - | `list` | `"a,b,c::L"` |

## Next Steps

- [Type Formatting Guide](guide/formatting.md) - Locale-aware formatting
- [Custom Types](guide/custom-types.md) - Register your own types
- [API Reference](api/reference.md) - Complete API documentation

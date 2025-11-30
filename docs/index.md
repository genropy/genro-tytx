# TYTX - Typed Text Protocol

## Why TYTX?

### The Problem: JSON's Type Blindness

When building web applications, you constantly exchange data between Python backends and JavaScript frontends. JSON is the universal format, but it has a critical limitation: **it loses type information**.

```json
{
  "price": 100.50,
  "order_date": "2025-01-15",
  "quantity": 42
}
```

When your Python backend receives this:

- Is `price` a `float` (imprecise) or a `Decimal` (exact for money)?
- Is `order_date` a string or should it be a `date` object?
- You can infer `quantity` is an integer, but what about `"42"`?

This ambiguity causes bugs, especially with **financial data** where floating-point errors are unacceptable.

### The Solution: Type-Encoded Values

TYTX embeds type information directly in values using a simple `value::type_code` syntax:

```json
{
  "price": "100.50::N",
  "order_date": "2025-01-15::D",
  "quantity": "42::L"
}
```

After parsing:

- `price` → `Decimal("100.50")` - exact numeric, safe for money
- `order_date` → `date(2025, 1, 15)` - proper date object
- `quantity` → `42` - integer

No ambiguity. No surprises. **Type safety across the wire.**

## Python + JavaScript: Full Stack Type Safety

TYTX provides **identical implementations** for both Python and JavaScript:

### Python

```python
from genro_tytx import from_text, as_typed_text
from decimal import Decimal

# Parse
from_text("100.50::N")  # → Decimal("100.50")

# Serialize
as_typed_text(Decimal("100.50"))  # → "100.50::N"
```

### JavaScript

```javascript
const { from_text, as_typed_text } = require('genro-tytx');

// Parse
from_text("100.50::N")  // → 100.50 (number)

// Serialize
as_typed_text(100.50)  // → "100.50::R"
```

Your Python backend and JavaScript frontend speak the same type language.

## Real-World Use Cases

### API Responses with Exact Numbers

```python
from genro_tytx import as_typed_json
from decimal import Decimal
from datetime import date

order = {
    "id": 12345,
    "total": Decimal("1299.99"),
    "tax": Decimal("103.99"),
    "order_date": date(2025, 1, 15),
    "shipped": True
}

# Send to frontend
response = as_typed_json(order)
# '{"id": "12345::L", "total": "1299.99::N", "tax": "103.99::N",
#   "order_date": "2025-01-15::D", "shipped": "true::B"}'
```

The JavaScript frontend receives exact values:

```javascript
const { from_json } = require('genro-tytx');

const order = from_json(response);
// order.total → 1299.99 (parsed from Decimal)
// order.order_date → Date object
// order.shipped → true (boolean, not string)
```

### Configuration Files

```python
from genro_tytx import from_xml

config = from_xml('''
<settings>
    <timeout>30::L</timeout>
    <max_retries>3::L</max_retries>
    <rate_limit>100.50::N</rate_limit>
    <debug>false::B</debug>
</settings>
''')

# config["settings"]["value"]["timeout"]["value"] → 30 (int, not string)
# config["settings"]["value"]["debug"]["value"] → False (bool)
```

### Data Import/Export

```python
from genro_tytx import as_typed_json, from_json
from decimal import Decimal

# Export data with full type information
data = {"balance": Decimal("10000.00"), "last_updated": date.today()}
export = as_typed_json(data)

# Import later - types are preserved exactly
restored = from_json(export)
assert restored["balance"] == Decimal("10000.00")  # Exact match!
```

## Type Codes

TYTX uses mnemonic type codes:

| Code | Type | Python | JavaScript | Example |
|------|------|--------|------------|---------|
| `L` | Integer | `int` | `number` | `"42::L"` |
| `R` | Float | `float` | `number` | `"3.14::R"` |
| `N` | Decimal | `Decimal` | `number` | `"99.99::N"` |
| `D` | Date | `date` | `Date` | `"2025-01-15::D"` |
| `DHZ` | DateTime | `datetime` | `Date` | `"2025-01-15T10:00:00Z::DHZ"` |
| `H` | Time | `time` | `string` | `"10:30:00::H"` |
| `B` | Boolean | `bool` | `boolean` | `"true::B"` |
| `T` | Text | `str` | `string` | `"hello::T"` |
| `JS` | JSON | `dict`/`list` | `object`/`array` | `'{"a":1}::JS'` |

Each type has a unique code for serialization.

## Type Prefixes

TYTX supports three type prefix categories:

| Prefix | Category | Example | Description |
|--------|----------|---------|-------------|
| (none) | Built-in | `::L`, `::D`, `::N` | Standard types |
| `~` | Custom | `::~UUID`, `::~INV` | Extension types via `register_class` |
| `@` | Struct | `::@CUSTOMER` | Struct schemas via `register_struct` |
| `#` | Array | `::#L`, `::#@POINT` | Typed arrays |

### Custom Types (~)

Register custom classes for serialization:

```python
from genro_tytx import registry
import uuid

registry.register_class("UUID", uuid.UUID, str, uuid.UUID)
registry.from_text("550e8400-e29b-41d4-a716-446655440000::~UUID")  # → UUID object
```

### Struct Schemas (@)

Define schemas for structured data:

```python
registry.register_struct('POINT', 'x:R,y:R')
registry.from_text('["3.7", "7.3"]::@POINT')  # → {"x": 3.7, "y": 7.3}

# Arrays of structs
registry.from_text('[["1", "2"], ["3", "4"]]::#@POINT')  # → [{"x": 1, "y": 2}, ...]
```

## Key Features

- **Zero dependencies** - Python stdlib only
- **Bidirectional** - Parse and serialize
- **JSON & XML support** - Full utilities included
- **Locale formatting** - Display dates/numbers in any locale
- **Extensible** - Register custom types
- **Python + JavaScript** - Same API, same types

## Next Steps

```{toctree}
:maxdepth: 2

installation
quickstart
guide/index
examples/index
api/reference
faq
```

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

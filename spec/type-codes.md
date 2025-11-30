# TYTX Type Codes Registry

**Version**: 2.0
**Updated**: 2025-11-30
**Note**: Type codes use mnemonic single-letter conventions.

This document defines all registered type codes for the TYTX protocol.

## Reserved Codes

| Code | Purpose |
|------|---------|
| `TYTX` | Global marker for typed payloads |

## Built-in Type Codes

### Numeric Types

| Code | Python | JavaScript | Format | Example |
|------|--------|------------|--------|---------|
| `L` | `int` | `number` | Decimal string | `"123::L"` |
| `R` | `float` | `number` | Scientific notation OK | `"3.14::R"` |
| `N` | `Decimal` | `number` (string) | Decimal string | `"100.50::N"` |

### Date/Time Types

| Code | Python | JavaScript | Format | Example |
|------|--------|------------|--------|---------|
| `D` | `date` | `Date` | ISO 8601 date | `"2025-01-15::D"` |
| `DHZ` | `datetime` | `Date` | ISO 8601 datetime (UTC) | `"2025-01-15T10:30:00Z::DHZ"` |
| `DH` | `datetime` | `Date` | ISO 8601 datetime (naive, deprecated) | `"2025-01-15T10:30:00::DH"` |
| `H` | `time` | `Date` | ISO 8601 time | `"10:30:00::H"` |

> **Note**: `DHZ` is the canonical code for datetime (timezone-aware). `DH` is deprecated for new code but supported for backward compatibility.

### Boolean Types

| Code | Python | JavaScript | Format | Example |
|------|--------|------------|--------|---------|
| `B` | `bool` | `boolean` | `true` / `false` | `"true::B"` |

### String Types

| Code | Python | JavaScript | Format | Example |
|------|--------|------------|--------|---------|
| `T` | `str` | `string` | UTF-8 string | `"hello::T"` |

### Structured Types

| Code | Python | JavaScript | Format | Example |
|------|--------|------------|--------|---------|
| `JS` | `dict`/`list` | `object`/`array` | JSON encoded | `'{"a":1}::JS'` |

## Type Code Conventions

### Mnemonic Codes

Each code is a mnemonic for the type it represents:

| Code | Meaning |
|------|---------|
| `L` | **L**ong integer |
| `R` | **R**eal (float) |
| `N` | **N**umeric (decimal) |
| `D` | **D**ate |
| `DHZ` | **D**ate with **H**our, **Z**ulu/UTC (datetime, canonical) |
| `DH` | **D**ate with **H**our (datetime, naive, deprecated) |
| `H` | **H**our (time) |
| `T` | **T**ext (string) |
| `B` | **B**oolean |
| `JS` | **J**ava**S**cript object (JSON) |

## Type Code Prefixes

TYTX uses symbol prefixes to distinguish different type categories:

| Symbol | Type | Example | Description |
|--------|------|---------|-------------|
| (none) | Built-in | `100::N`, `2025-01-15::D` | Core TYTX types |
| `~` | Custom | `uuid::~UUID` | Custom extension types via `register_class` |
| `@` | Struct | `{...}::@CUSTOMER` | Struct schemas via `register_struct` |
| `#` | Typed Array | `[1,2,3]::#L` | Homogeneous arrays (each element #i is of type) |

**Note**: Type codes must start with letters A-Z. Symbol prefixes are reserved for TYTX syntax.

## Extended Type System

TYTX distinguishes three categories of extended types beyond built-ins, each identified by a symbol prefix:

| Category | Prefix | Registration | Purpose |
|----------|--------|--------------|---------|
| **Custom Classes** | `~` | `register_class` | Arbitrary Python/JS classes |
| **Struct Schemas** | `@` | `register_struct` | Schema-based data hydration |
| **Typed Arrays** | `#` | (inline) | Homogeneous array typing |

---

## Custom Types (`~` prefix)

Custom types allow you to extend TYTX with arbitrary classes. The `~` prefix (tilde) prevents collisions with built-in type codes.

### Registration Pattern

Use `register_class` to register custom classes. The code you provide is automatically prefixed with `~` in the wire format.

### Python Example

```python
from genro_tytx import registry, from_text, as_typed_text
import uuid

# Register a custom class
registry.register_class(
    code="UUID",  # becomes "~UUID" in wire format
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)

# Serialization
my_uuid = uuid.uuid4()
as_typed_text(my_uuid)
# → "550e8400-e29b-41d4-a716-446655440000::~UUID"

# Parsing
from_text("550e8400-e29b-41d4-a716-446655440000::~UUID")
# → UUID("550e8400-...")
```

### JavaScript Example

```javascript
const { registry, from_text } = require('genro-tytx');

// Register a custom class
registry.register_class({
    code: "UUID",  // becomes "~UUID" in wire format
    cls: null,     // JS doesn't have a built-in UUID class
    serialize: (u) => String(u),
    parse: (s) => s  // Store as string in JS
});

// Parsing
from_text("550e8400-e29b-41d4-a716-446655440000::~UUID");
// → "550e8400-..."
```

### Unregistering Custom Types

```python
# Python
registry.unregister_class("UUID")  # removes ~UUID
```

```javascript
// JavaScript/TypeScript
registry.unregister_class("UUID");  // removes ~UUID
```

### Complete Example: Invoice Type

```python
# Python
from decimal import Decimal
from genro_tytx import registry, as_typed_text, from_text

class Invoice:
    def __init__(self, id: int, total: Decimal):
        self.id = id
        self.total = total

registry.register_class(
    code="INV",
    cls=Invoice,
    serialize=lambda inv: f"{inv.id}|{inv.total}",
    parse=lambda s: Invoice(int(s.split("|")[0]), Decimal(s.split("|")[1]))
)

inv = Invoice(123, Decimal("100.50"))
as_typed_text(inv)  # → "123|100.50::~INV"

from_text("123|100.50::~INV")  # → Invoice(id=123, total=Decimal("100.50"))
```

```javascript
// JavaScript
const { registry, from_text } = require('genro-tytx');

class Invoice {
    constructor(id, total) {
        this.id = id;
        this.total = total;
    }
}

registry.register_class({
    code: "INV",
    cls: Invoice,
    serialize: (inv) => `${inv.id}|${inv.total}`,
    parse: (s) => {
        const [id, total] = s.split("|");
        return new Invoice(parseInt(id), parseFloat(total));
    }
});

from_text("123|100.50::~INV");
// → Invoice { id: 123, total: 100.5 }
```

### Fallback Behavior

If a parser receives an unknown `~` type:

- The value is returned as a plain string (unchanged)
- No error is raised
- This allows graceful degradation when Python and JS have different registered types

---

## Struct Schemas (`@` prefix)

Struct schemas enable schema-based hydration of JSON data. Instead of inline typing each field, you define a schema once and reference it.

### Schema Types

| Schema Type | Definition | Input | Output |
|-------------|------------|-------|--------|
| **Dict** | `{name: 'T', balance: 'N'}` | `{...}` object | `{...}` object |
| **List Positional** | `['T', 'L', 'N']` | `[...]` array | `[...]` array |
| **List Homogeneous** | `['N']` | `[...]` array | `[...]` array |
| **String Named** | `'x:R,y:R'` | `[...]` array | `{...}` object |
| **String Anonymous** | `'R,R'` | `[...]` array | `[...]` array |

### Dict Schema

Maps field names to types:

```python
registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N', 'created': 'D'})

from_text('{"name": "Acme", "balance": "100.50", "created": "2025-01-15"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100.50"), "created": date(2025, 1, 15)}
```

- Only keys in schema are typed
- Extra keys pass through unchanged
- Missing keys are not added

### List Positional Schema

Applies types by position (for fixed-length tuples):

```python
registry.register_struct('ROW', ['T', 'L', 'N'])

from_text('["Product", 2, "100.50"]::@ROW')
# → ["Product", 2, Decimal("100.50")]
```

### List Homogeneous Schema

Single-element schema applies to all elements:

```python
registry.register_struct('PRICES', ['N'])

from_text('[100, 200, "50.25"]::@PRICES')
# → [Decimal("100"), Decimal("200"), Decimal("50.25")]

# Works with nested arrays too
from_text('[[1, 2], [3, 4]]::@PRICES')
# → [[Decimal("1"), Decimal("2")], [Decimal("3"), Decimal("4")]]
```

### String Schema (CSV-like data)

String schema is ideal for CSV data with guaranteed field order:

**Named fields → dict output:**

```python
registry.register_struct('POINT', 'x:R,y:R')

from_text('["3.7", "7.3"]::@POINT')
# → {"x": 3.7, "y": 7.3}
```

**Anonymous fields → list output:**

```python
registry.register_struct('COORDS', 'R,R')

from_text('["3.7", "7.3"]::@COORDS')
# → [3.7, 7.3]
```

### Array of Structs (`#@` syntax)

Use `#@STRUCT` to apply a struct schema to each element of an array:

```python
registry.register_struct('ROW', 'name:T,qty:L,price:N')

# Batch mode: array of arrays → array of dicts
from_text('[["A", "1", "10"], ["B", "2", "20"]]::#@ROW')
# → [{"name": "A", "qty": 1, "price": Decimal("10")},
#    {"name": "B", "qty": 2, "price": Decimal("20")}]
```

### Struct in JavaScript

```javascript
const { registry, from_text } = require('genro-tytx');

// Dict schema
registry.register_struct('CUSTOMER', { name: 'T', balance: 'N' });

from_text('{"name": "Acme", "balance": "100.50"}::@CUSTOMER');
// → { name: "Acme", balance: 100.5 }  (N → number in JS)

// String schema for CSV
registry.register_struct('POINT', 'x:R,y:R');

from_text('["3.7", "7.3"]::@POINT');
// → { x: 3.7, y: 7.3 }

// Batch mode
from_text('[["1", "2"], ["3", "4"]]::#@POINT');
// → [{ x: 1, y: 2 }, { x: 3, y: 4 }]
```

### Unregistering Structs

```python
registry.unregister_struct('ROW')  # removes @ROW
```

### Struct Fallback Behavior

If `@STRUCT` is not registered:

- Value is returned as plain string (unchanged)
- No error is raised

---

## Typed Arrays (`#` prefix)

Typed arrays provide compact format for homogeneous arrays. The `#` prefix applies a single type to all leaf values.

### Basic Usage

```text
[1,2,3]::#L           → [1, 2, 3]  (all ints)
[1.5,2.5,3.5]::#R     → [1.5, 2.5, 3.5]  (all floats)
["2025-01-15"]::#D    → [date(2025, 1, 15)]  (all dates)
```

### Nested Arrays

Type applies recursively to all leaf values:

```text
[[1,2],[3,4]]::#L     → [[1, 2], [3, 4]]  (nested, all ints)
[[1,2],[3,4]]::#N     → [[Decimal("1"), ...], [...]]  (all decimals)
```

### With Struct Types

Combine `#` with `@` for arrays of structs:

```text
[["A",1],["B",2]]::#@ROW  → Apply @ROW schema to each element
```

### Serialization

With `compact_array=True` (Python) or `compactArray=true` (JS):

- Values serialized as strings in JSON array format
- Single type suffix applies to all leaf values
- Heterogeneous arrays fall back to element-by-element typing

## MessagePack Extension Type

TYTX reserves MessagePack ExtType code **42** for typed payloads.

```python
# ExtType(42, b'{"price": "100::N"}')
```

The content is a UTF-8 encoded JSON string with TYTX typed values. No `::TYTX` prefix needed - ExtType(42) itself is the marker.

## Reserved for Future Use

The following codes are reserved:

- `X` - XML (nested XML fragment)
- `REF` - Reference (internal object reference)
- `NULL` - Null with type hint
- `b64` - Base64 encoded bytes

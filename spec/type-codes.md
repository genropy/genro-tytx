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

## Custom Types (Extension Types)

Custom types use the `X_` prefix (eXtension) to avoid collisions with built-in types.

### The `register_class` Pattern

Use `register_class` to register custom classes with TYTX. The code you provide is automatically prefixed with `X_`.

### Python

```python
from genro_tytx import registry
import uuid

# Register a custom class
registry.register_class(
    code="UUID",  # becomes "X_UUID" in wire format
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)

# Usage
from genro_tytx import from_text, as_typed_text

as_typed_text(uuid.uuid4())
# → "550e8400-e29b-41d4-a716-446655440000::X_UUID"

from_text("550e8400-e29b-41d4-a716-446655440000::X_UUID")
# → UUID("550e8400-...")
```

### JavaScript

```javascript
const { registry } = require('genro-tytx');

// Register a custom class
registry.register_class({
    code: "UUID",  // becomes "X_UUID" in wire format
    cls: null,     // JS doesn't have a UUID class
    serialize: (u) => String(u),
    parse: (s) => s  // JS stores UUID as string
});

// Usage
const { from_text, as_typed_text } = require('genro-tytx');

// If the object has a registered class, it serializes with X_ prefix
from_text("550e8400-e29b-41d4-a716-446655440000::X_UUID");
// → "550e8400-..."
```

### Type Code Namespaces

| Prefix | Type | Example | Managed by |
|--------|------|---------|------------|
| (none) | Built-in | `::L`, `::D`, `::DHZ` | TYTX core |
| `X_` | Custom | `::X_UUID`, `::X_INV` | `register_class` |

### Unregistering Custom Types

Use `unregister_class` to remove a previously registered custom type:

**Python:**

```python
registry.unregister_class("UUID")  # removes X_UUID
```

**JavaScript/TypeScript:**

```javascript
registry.unregister_class("UUID");  // removes X_UUID
```

### Fallback Behavior

If a parser receives an unknown `X_` type:

- The value is returned as a plain string
- No error is raised
- This allows graceful degradation when Python and JS have different registered types

### Complete Example: Invoice Type

```python
# Python
from decimal import Decimal

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
as_typed_text(inv)  # → "123|100.50::X_INV"
```

```javascript
// JavaScript
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

from_text("123|100.50::X_INV");
// → Invoice { id: 123, total: 100.5 }
```

## Typed Arrays

Compact format for homogeneous arrays applies a single type to all leaf values:

```text
[1,2,3]::L           → [1, 2, 3]  (all ints)
[[1,2],[3,4]]::L     → [[1, 2], [3, 4]]  (nested, all ints)
[1.5,2.5,3.5]::R     → [1.5, 2.5, 3.5]  (all floats)
["2025-01-15"]::D    → [date(2025, 1, 15)]  (all dates)
```

Serialization with `compact_array=True` (Python) or `compactArray=true` (JS):

- Values are serialized as strings in JSON array format
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

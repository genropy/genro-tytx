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
| `H` | `time` | `string` | ISO 8601 time | `"10:30:00::H"` |

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

## Registering Custom Types

### Python

```python
from genro_tytx import registry
from genro_tytx.base import DataType
import uuid

class UUIDType(DataType):
    name = "uuid"
    code = "U"
    python_type = uuid.UUID
    sql_type = "UUID"

    def parse(self, value: str) -> uuid.UUID:
        return uuid.UUID(value)

    def serialize(self, value: uuid.UUID) -> str:
        return str(value)

registry.register(UUIDType)

# Usage
# "550e8400-e29b-41d4-a716-446655440000::U" → UUID("550e8400-...")
```

### JavaScript

```javascript
const { registry } = require('genro-tytx');

const UUIDType = {
    name: 'uuid',
    code: 'U',
    js_type: 'string',

    parse(value) {
        return value; // JS stores UUID as string
    },

    serialize(value) {
        return String(value);
    }
};

registry.register(UUIDType);

// Usage
// "550e8400-e29b-41d4-a716-446655440000::U" → "550e8400-..."
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

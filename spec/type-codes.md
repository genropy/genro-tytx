# TYTX Type Codes Registry

**Version**: 1.1
**Updated**: 2025-01-29
**Note**: Type codes are aligned with Genropy framework standards.

This document defines all registered type codes for the TYTX protocol.

## Reserved Codes

| Code | Purpose |
|------|---------|
| `TYTX` | Global marker for typed payloads |

## Built-in Type Codes (Genropy-compatible)

### Numeric Types

| Code | Aliases | Python | JavaScript | Format | Example |
|------|---------|--------|------------|--------|---------|
| `L` | `I`, `INT`, `INTEGER`, `LONG`, `LONGINT` | `int` | `number` | Decimal string | `"123::L"` |
| `R` | `F`, `REAL`, `FLOAT` | `float` | `number` | Scientific notation OK | `"3.14::R"` |
| `N` | `NUMERIC`, `DECIMAL` | `Decimal` | `number` (string) | Decimal string | `"100.50::N"` |

### Date/Time Types

| Code | Aliases | Python | JavaScript | Format | Example |
|------|---------|--------|------------|--------|---------|
| `D` | `DATE` | `date` | `Date` | ISO 8601 date | `"2025-01-15::D"` |
| `DH` | `DT`, `DHZ`, `DATETIME`, `timestamp` | `datetime` | `Date` | ISO 8601 datetime | `"2025-01-15T10:30:00::DH"` |
| `H` | `TIME`, `HZ` | `time` | `string` | ISO 8601 time | `"10:30:00::H"` |

### Boolean Types

| Code | Aliases | Python | JavaScript | Format | Example |
|------|---------|--------|------------|--------|---------|
| `B` | `BOOL`, `BOOLEAN` | `bool` | `boolean` | `true` / `false` | `"true::B"` |

### String Types

| Code | Aliases | Python | JavaScript | Format | Example |
|------|---------|--------|------------|--------|---------|
| `T` | `TEXT`, `S`, `STRING`, `P`, `A` | `str` | `string` | UTF-8 string | `"hello::T"` |

### Structured Types

| Code | Aliases | Python | JavaScript | Format | Example |
|------|---------|--------|------------|--------|---------|
| `JS` | `JSON`, `J` | `dict`/`list` | `object`/`array` | JSON encoded | `'{"a":1}::JS'` |

## Type Code Conventions

### Genropy Standard Codes

The primary codes follow the Genropy framework conventions:

| Code | Genropy Meaning |
|------|-----------------|
| `L` | **L**ong integer |
| `R` | **R**eal (float) |
| `N` | **N**umeric (decimal) |
| `D` | **D**ate |
| `DH` | **D**ate with **H**our (datetime) |
| `H` | **H**our (time) |
| `T` | **T**ext (string) |
| `B` | **B**oolean |
| `JS` | **J**ava**S**cript object (JSON) |

### Aliases for Compatibility

Aliases are provided for compatibility with common conventions:

- `I`, `INT`, `INTEGER` → `L` (integer)
- `F`, `FLOAT` → `R` (float)
- `DECIMAL` → `N` (decimal)
- `DT`, `DHZ`, `DATETIME` → `DH` (datetime)
- `TIME`, `HZ` → `H` (time)
- `S`, `STRING` → `T` (text)
- `JSON`, `J` → `JS` (json)

## Registering Custom Types

### Python

```python
from genro_tytx import registry
from genro_tytx.base import DataType
import uuid

class UUIDType(DataType):
    name = "uuid"
    code = "U"
    aliases = ["UUID"]
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
    aliases: ['UUID'],
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

## MessagePack Extension Type

TYTX reserves MessagePack ExtType code **42** for typed payloads.

```python
# ExtType(42, b'{"price": "100::N"}::TYTX')
```

The content is always a UTF-8 encoded TYTX string.

## Reserved for Future Use

The following codes are reserved:

- `X` - XML (nested XML fragment)
- `REF` - Reference (internal object reference)
- `NULL` - Null with type hint
- `b64` - Base64 encoded bytes

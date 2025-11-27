# TYTX Type Codes Registry

**Version**: 1.0

This document defines all registered type codes for the TYTX protocol.

## Reserved Codes (0x00 - 0x1F)

These codes are reserved for protocol use:

| Code | Purpose |
|------|---------|
| `TYTX` | Global marker for typed payloads |

## Built-in Type Codes

### Numeric Types

| Code | Alias | Python | JavaScript | Format | Example |
|------|-------|--------|------------|--------|---------|
| `I` | `int` | `int` | `number` / `BigInt` | Decimal string | `"123::I"` |
| `D` | `decimal` | `Decimal` | `Decimal` | Decimal string | `"100.50::D"` |
| `F` | `float` | `float` | `number` | Scientific notation OK | `"3.14::F"` |

### Date/Time Types

| Code | Alias | Python | JavaScript | Format | Example |
|------|-------|--------|------------|--------|---------|
| `d` | `date` | `date` | `Date` | ISO 8601 date | `"2025-01-15::d"` |
| `dt` | `datetime` | `datetime` | `Date` | ISO 8601 datetime | `"2025-01-15T10:30:00::dt"` |
| `t` | `time` | `time` | `string` | ISO 8601 time | `"10:30:00::t"` |
| `ts` | `timestamp` | `datetime` | `Date` | Unix timestamp (seconds) | `"1705312200::ts"` |

### Boolean Types

| Code | Alias | Python | JavaScript | Format | Example |
|------|-------|--------|------------|--------|---------|
| `B` | `bool` | `bool` | `boolean` | `true` / `false` | `"true::B"` |

### String/Binary Types

| Code | Alias | Python | JavaScript | Format | Example |
|------|-------|--------|------------|--------|---------|
| `b64` | `bytes` | `bytes` | `Uint8Array` | Base64 encoded | `"SGVsbG8=::b64"` |
| `U` | `uuid` | `UUID` | `string` | UUID string | `"550e8400-...::U"` |

### Collection Types

| Code | Alias | Python | JavaScript | Format | Example |
|------|-------|--------|------------|--------|---------|
| `L` | `list` | `list[str]` | `string[]` | Comma-separated | `"a,b,c::L"` |
| `T` | `table` | `Table` | `Table` | JSON structure | `"{...}::T"` |

## Code Naming Conventions

1. **Single uppercase letter**: Core types (`I`, `D`, `B`, `T`, `U`, `F`, `L`)
2. **Single lowercase letter**: Date/time types (`d`, `t`)
3. **Two lowercase letters**: Extended core types (`dt`, `ts`)
4. **Three+ lowercase letters**: Special encodings (`b64`)
5. **Custom codes**: Uppercase, 2-4 characters (`MT`, `GEO`, `JSON`)

## Registering Custom Types

### Python

```python
from genro_tytx import registry

@registry.register("GeoPoint", "GEO")
class GeoPointHandler:
    python_type = GeoPoint

    @staticmethod
    def parse(value: str) -> GeoPoint:
        lat, lon = value.split(",")
        return GeoPoint(float(lat), float(lon))

    @staticmethod
    def serialize(obj: GeoPoint) -> str:
        return f"{obj.lat},{obj.lon}"

# Usage
# "40.7128,-74.0060::GEO" -> GeoPoint(40.7128, -74.0060)
```

### JavaScript

```typescript
import { registry } from 'genro-tytx';

registry.register("GeoPoint", "GEO", {
  parse: (value: string) => {
    const [lat, lon] = value.split(",").map(Number);
    return { lat, lon };
  },
  serialize: (obj: GeoPoint) => `${obj.lat},${obj.lon}`
});

// Usage
// "40.7128,-74.0060::GEO" -> { lat: 40.7128, lon: -74.0060 }
```

## MessagePack Extension Type

TYTX reserves MessagePack ExtType code **42** for typed payloads.

```python
# ExtType(42, b'{"price": "100::D"}::TYTX')
```

The content is always a UTF-8 encoded TYTX string.

## Reserved for Future Use

The following codes are reserved:

- `J` - JSON (nested JSON object)
- `X` - XML (nested XML fragment)
- `R` - Reference (internal object reference)
- `N` - Null with type hint

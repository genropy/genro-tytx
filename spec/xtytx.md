# XTYTX - Extended TYTX Envelope

**Version**: 0.4.0
**Status**: Draft

## Overview

XTYTX (Extended TYTX) is an envelope format that wraps a TYTX payload with struct definitions. It enables sending struct schemas alongside data, eliminating the need for pre-registration.

## Format

```
XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}
```

The `XTYTX://` prefix is placed at the **beginning** to allow:
- Immediate format detection without buffering the entire payload
- Streaming-friendly processing
- Early struct registration before data parsing

### Protocol Prefix Syntax

Both TYTX and XTYTX use the `://` separator (URL-style) for global payloads:

| Protocol | Syntax | Description |
|----------|--------|-------------|
| TYTX | `TYTX://{"price": "100::N"}` | Standard typed payload |
| XTYTX | `XTYTX://{"gstruct": {...}, ...}` | Extended envelope with structs |

This syntax is distinct from the `::` separator used for inline type codes (`value::TYPE`).

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gstruct` | object | Yes | Global structs - registered permanently |
| `lstruct` | object | Yes | Local structs - valid only for this payload |
| `data` | string | Yes | TYTX payload (can be empty) |

### gstruct (Global Structs)

Struct definitions that are registered globally via `register_struct()`. These persist after decoding and affect all subsequent operations.

- **Overwrites**: If a struct with the same code already exists, it is replaced
- **Format**: `{code: schema, ...}` where schema follows standard struct format

### lstruct (Local Structs)

Struct definitions valid only during the decoding of `data`. These are discarded after decoding completes.

- **Precedence**: lstruct takes priority over gstruct and registry when both define the same code
- **Scope**: Only visible during this payload's decoding
- **Format**: Same as gstruct

### data

The actual TYTX payload to decode. Can be:
- Empty string `""` - returns `None` (useful for struct-only registration)
- Full TYTX payload `"TYTX://{...}"` - decoded using combined struct context

## Processing Flow

1. **Parse envelope**: Detect `XTYTX://` prefix, parse JSON envelope
2. **Register gstruct**: Call `register_struct()` for each entry (overwrites existing)
3. **Build lookup context**: Create virtual dict = lstruct + registry (lstruct wins on conflict)
4. **Decode data**: If `data` is non-empty, decode as TYTX using the lookup context
5. **Cleanup**: Discard lstruct (gstruct remains registered)
6. **Return**: Decoded data or `None` if data was empty

## Struct Lookup Precedence

During decoding, struct lookup follows this order:

1. **lstruct** (highest priority)
2. **registry** (including newly registered gstruct)

Example:

```
XTYTX://{
  "gstruct": {"POINT": "x:L,y:L"},
  "lstruct": {"POINT": "x:R,y:R,z:R"},
  "data": "TYTX://{\"p\": \"1.5,2.5,3.5::@POINT\"}"
}
```

Result: `{"p": {"x": 1.5, "y": 2.5, "z": 3.5}}` (lstruct version used)

After decoding: registry has `POINT` = `"x:L,y:L"` (gstruct version persisted)

## Use Cases

### 1. Struct-Only Registration

Send struct definitions without data:

```
XTYTX://{"gstruct": {"CUSTOMER": {"name": "T", "balance": "N"}}, "lstruct": {}, "data": ""}
```

Returns `None`, but `@CUSTOMER` is now registered globally.

### 2. Self-Contained Payload

Send data with its schema definitions:

```
XTYTX://{
  "gstruct": {},
  "lstruct": {"ORDER": {"id": "L", "total": "N"}},
  "data": "TYTX://{\"order\": \"{\\\"id\\\": \\\"123\\\", \\\"total\\\": \\\"99.99\\\"}::@ORDER\"}"
}
```

Decodes the order without pre-registration. `@ORDER` is not available after.

### 3. Mixed Registration

Register some structs globally, use others locally:

```
XTYTX://{
  "gstruct": {"CUSTOMER": {"name": "T", "balance": "N"}},
  "lstruct": {"TEMP_ROW": ["T", "L", "N"]},
  "data": "TYTX://{\"customer\": \"{\\\"name\\\": \\\"Acme\\\", \\\"balance\\\": \\\"100\\\"}::@CUSTOMER\"}"
}
```

After: `@CUSTOMER` persists, `@TEMP_ROW` discarded.

## API

### Python

```python
from genro_tytx import from_json

# Automatic detection of XTYTX:// prefix
result = from_json('XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}')

# Struct-only registration
from_json('XTYTX://{"gstruct": {"CUSTOMER": {"name": "T"}}, "lstruct": {}, "data": ""}')
# Returns None, but @CUSTOMER is now registered
```

### JavaScript

```javascript
const { from_json } = require('genro-tytx');

// Automatic detection of XTYTX:// prefix
const result = from_json('XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}');
```

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Invalid JSON envelope | Raise parse error |
| Missing required field | Raise validation error |
| Invalid struct schema | Raise schema error |
| Unknown type in struct | Pass through unchanged |

## Comparison with TYTX

| Feature | TYTX | XTYTX |
|---------|------|-------|
| Prefix | `TYTX://` | `XTYTX://` |
| Struct definitions | Pre-registered | Inline (gstruct/lstruct) |
| Self-contained | No | Yes |

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0

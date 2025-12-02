# XTYTX - Extended TYTX Envelope

**Version**: 0.5.0
**Status**: Draft

## Overview

XTYTX (Extended TYTX) is an envelope format that wraps a TYTX payload with struct definitions and optional JSON Schemas. It enables sending struct schemas alongside data, eliminating the need for pre-registration.

**Note**: TYTX is a **transport format**, not a validator. Validation is delegated to JSON Schema, which can be included in the envelope for client-side validation.

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
| `gschema` | object | No | Global JSON Schemas - registered permanently |
| `lschema` | object | No | Local JSON Schemas - valid only for this payload |
| `data` | string | Yes | TYTX payload (can be empty) |

### gstruct (Global Structs)

TYTX struct definitions that are registered globally via `register_struct()`. These persist after decoding and affect all subsequent operations.

- **Overwrites**: If a struct with the same code already exists, it is replaced
- **Format**: `{code: schema, ...}` where schema follows standard TYTX struct format
- **Purpose**: Type mapping for hydration/serialization

### lstruct (Local Structs)

TYTX struct definitions valid only during the decoding of `data`. These are discarded after decoding completes.

- **Precedence**: lstruct takes priority over gstruct and registry when both define the same code
- **Scope**: Only visible during this payload's decoding
- **Format**: Same as gstruct

### gschema (Global JSON Schemas)

JSON Schema definitions that are registered globally via `register_schema()`. These persist after decoding and can be used for client-side validation.

- **Overwrites**: If a schema with the same name already exists, it is replaced
- **Format**: `{name: {type: "object", properties: {...}, ...}, ...}` (standard JSON Schema)
- **Usage**: Clients can use these schemas with any JSON Schema validator (e.g., Zod, Ajv, jsonschema)
- **Purpose**: Full validation (TYTX is transport-only, not a validator)

### lschema (Local JSON Schemas)

JSON Schema definitions valid only during the decoding of `data`. These are discarded after decoding completes.

- **Precedence**: lschema takes priority over gschema and registry when both define the same name
- **Scope**: Only visible during this payload's decoding
- **Format**: Same as gschema

### data

The actual TYTX payload to decode. Can be:
- Empty string `""` - returns `None` (useful for struct-only registration)
- Full TYTX payload `"TYTX://{...}"` - decoded using combined struct context

## Processing Flow

1. **Parse envelope**: Detect `XTYTX://` prefix, parse JSON envelope
2. **Register gschema**: Call `register_schema()` for each entry (overwrites existing)
3. **Register gstruct**: Call `register_struct()` for each entry (overwrites existing)
4. **Build lookup context**: Create virtual dicts for structs (lstruct + registry) and schemas (lschema + registry)
5. **Decode data**: If `data` is non-empty, decode as TYTX using the struct lookup context
6. **Cleanup**: Discard lstruct and lschema (gstruct and gschema remain registered)
7. **Return**: Decoded data or `None` if data was empty

## Lookup Precedence

### Struct Lookup (for hydration)

During decoding, struct lookup follows this order:

1. **lstruct** (highest priority)
2. **registry** (including newly registered gstruct)

### Schema Lookup (for validation)

During validation, schema lookup follows this order:

1. **lschema** (highest priority)
2. **registry** (including newly registered gschema)

**Note**: Schema lookup is used by clients for validation, not by TYTX core (which is transport-only).

## Example

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

### 4. With JSON Schema for Validation

Include JSON Schemas for client-side validation. TYTX handles type hydration via `gstruct`/`lstruct`, while `gschema`/`lschema` provide full validation schemas:

```json
{
  "gstruct": {
    "CUSTOMER": {"name": "T", "email": "T", "balance": "N"}
  },
  "lstruct": {},
  "gschema": {
    "CUSTOMER": {
      "type": "object",
      "properties": {
        "name": {"type": "string", "minLength": 1, "maxLength": 100},
        "email": {"type": "string", "format": "email"},
        "balance": {"type": "number", "minimum": 0}
      },
      "required": ["name", "email", "balance"]
    }
  },
  "lschema": {},
  "data": "TYTX://..."
}
```

After decoding:

- `@CUSTOMER` struct is registered globally (for hydration)
- `CUSTOMER` JSON Schema is registered globally (for validation)

Clients can use the schema with any JSON Schema validator (e.g., Zod, Ajv, jsonschema).

### 5. Local Schema for One-Time Validation

Use `lschema` for schemas needed only during this payload:

```json
{
  "gstruct": {},
  "lstruct": {"TEMP_DATA": {"id": "L", "value": "N"}},
  "gschema": {},
  "lschema": {
    "TEMP_DATA": {
      "type": "object",
      "properties": {
        "id": {"type": "integer", "minimum": 1},
        "value": {"type": "number"}
      },
      "required": ["id", "value"]
    }
  },
  "data": "TYTX://..."
}
```

After decoding: both `@TEMP_DATA` struct and its JSON Schema are discarded.

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
| JSON Schema | Pre-registered | Inline (gschema/lschema) |
| Self-contained | No | Yes |

## Design Philosophy

TYTX is a **transport format**, not a validator. The separation between structs and schemas reflects this:

- **Structs** (`gstruct`/`lstruct`): Define type mapping for hydration/serialization
- **Schemas** (`gschema`/`lschema`): Define validation rules in standard JSON Schema format

This allows:

1. TYTX core to remain simple and focused on type conversion
2. Clients to use any JSON Schema validator (Zod, Ajv, jsonschema, etc.)
3. Full validation rules to be portable across languages via JSON Schema as universal interchange format

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0

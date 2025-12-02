# TYTX Validation Approach

**Version**: 2.0
**Status**: Draft
**Date**: 2025-12-02

## Design Philosophy

TYTX is a **transport format**, not a validator. This document explains the validation approach.

## Separation of Concerns

TYTX separates two distinct responsibilities:

1. **Type Hydration** (TYTX core): Converting typed text to native types
2. **Validation** (Client responsibility): Ensuring data meets business rules

### Why This Separation?

- **Simplicity**: TYTX core remains focused on one task
- **Flexibility**: Clients can use their preferred validation library
- **Portability**: JSON Schema is a universal interchange format
- **Standards**: Leverages existing JSON Schema ecosystem (Zod, Ajv, jsonschema, etc.)

## XTYTX Envelope Structure

```json
{
    "gstruct": {"CUSTOMER": {"name": "T", "balance": "N"}},
    "lstruct": {},
    "gschema": {
        "CUSTOMER": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1},
                "balance": {"type": "number", "minimum": 0}
            },
            "required": ["name", "balance"]
        }
    },
    "lschema": {},
    "data": "TYTX://..."
}
```

### Fields

| Field | Purpose | Scope |
|-------|---------|-------|
| `gstruct` | TYTX struct for type hydration | Global (persists) |
| `lstruct` | TYTX struct for type hydration | Local (discarded) |
| `gschema` | JSON Schema for validation | Global (persists) |
| `lschema` | JSON Schema for validation | Local (discarded) |

## Inline Validation Hints

Structs can include simple validation hints in the `validate` section:

```json
{
    "name": {
        "type": "T",
        "validate": {
            "min": 1,
            "max": 100,
            "required": true
        }
    }
}
```

### Available Hints

| Key | Type | Description |
|-----|------|-------------|
| `min` | number | Minimum value or length |
| `max` | number | Maximum value or length |
| `length` | number | Exact length |
| `pattern` | string | Regex pattern |
| `enum` | array | Allowed values |
| `required` | boolean | Field is required |
| `default` | any | Default value |

**Note**: These are hints only. For full validation, use JSON Schema.

## JSON Schema Validation

For comprehensive validation, use JSON Schema:

### Python

```python
import jsonschema
from genro_tytx import registry

# Get JSON Schema from registry
schema = registry.get_schema('CUSTOMER')

# Validate data
jsonschema.validate(data, schema)
```

### JavaScript

```javascript
import Ajv from 'ajv';
import { registry } from 'genro-tytx';

const ajv = new Ajv();
const schema = registry.getSchema('CUSTOMER');
const validate = ajv.compile(schema);

if (!validate(data)) {
    console.error(validate.errors);
}
```

### TypeScript with Zod

```typescript
import { z } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { registry } from 'genro-tytx';

const schema = registry.getSchema('CUSTOMER');
const zodSchema = jsonSchemaToZod(schema);
const result = zodSchema.safeParse(data);
```

## Migration from Named Validations

If you were using named validations (`validation:email`, `validation:cf|piva`), convert them to JSON Schema:

### Before (Deprecated)

```json
{
    "email": {
        "type": "T",
        "validate": {"validation": "email"}
    }
}
```

### After (JSON Schema)

```json
{
    "gstruct": {
        "CUSTOMER": {"email": "T"}
    },
    "gschema": {
        "CUSTOMER": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "format": "email"}
            }
        }
    }
}
```

## Benefits of JSON Schema

1. **Universal**: Works across all languages
2. **Tooling**: Rich ecosystem (validators, code generators, UI generators)
3. **Standards-based**: JSON Schema is an IETF standard
4. **Expressive**: Supports complex validation rules
5. **Composable**: Schemas can reference other schemas

## Common Patterns

### Email Validation

```json
{"type": "string", "format": "email"}
```

### Italian Fiscal Code

```json
{
    "type": "string",
    "pattern": "^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$",
    "minLength": 16,
    "maxLength": 16
}
```

### Enum

```json
{"type": "string", "enum": ["active", "inactive", "pending"]}
```

### Number Range

```json
{"type": "number", "minimum": 0, "maximum": 100}
```

### Required Fields

```json
{
    "type": "object",
    "properties": {...},
    "required": ["name", "email"]
}
```

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0

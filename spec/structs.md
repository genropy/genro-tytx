# TYTX Struct Types

**Version**: 2.0.0
**Updated**: 2025-12-01
**Status**: Draft

This document defines the struct type system for TYTX, enabling schema-based hydration of JSON data with full metadata support.

## Overview

Structs provide a way to define type schemas for JSON data structures. A struct defines the type and metadata for each field in a data structure.

## Type Code Prefix

Struct types use the `@` prefix (at-sign) to distinguish them from:
- Built-in types (no prefix): `::L`, `::D`, `::N`
- Custom class types (`~` prefix): `::~UUID`, `::~INV`
- Typed arrays (`#` prefix): `::#L`, `::#N`

| Prefix | Type | Managed by |
|--------|------|------------|
| (none) | Built-in | TYTX core |
| `~` | Custom class | `register_class` |
| `@` | Struct schema | `register_struct` |
| `#` | Typed array | inline |
| `_` | System reserved | TYTX core (meta-structs) |

## Field Definition

A field in a struct can be defined in two ways:

### Simple Form (string)

When a field only needs a type, use a string:

```json
{
    "name": "T",
    "age": "L",
    "price": "N"
}
```

### Extended Form (object)

When a field needs metadata (validation, UI hints, etc.), use an object:

```json
{
    "name": {
        "type": "T",
        "validate": {
            "min": 1,
            "max": 100
        },
        "ui": {
            "label": "Full Name",
            "placeholder": "Enter your name"
        }
    }
}
```

### Field Object Structure

```json
{
    "type": "T",           // Required: TYTX type code
    "validate": { ... },   // Optional: validation constraints
    "ui": { ... }          // Optional: UI presentation hints
}
```

## Validation Section

The `validate` object contains constraints for data validation.

### Constraint Keys

| Key | Type | Description | Applies to |
|-----|------|-------------|------------|
| `min` | number | Minimum value or length | All |
| `max` | number | Maximum value or length | All |
| `length` | number | Exact length | T |
| `pattern` | string | Regex pattern | T |
| `enum` | array | Allowed values | T, L |
| `required` | boolean | Field is required | All |
| `default` | any | Default value if missing | All |

**Note**: The `validate` section in structs provides hints for simple inline validation. For full validation, use JSON Schema via `gschema`/`lschema` in XTYTX envelopes.

### Examples

```json
{
    "email": {
        "type": "T",
        "validate": {
            "pattern": "^[^@]+@[^@]+\\.[^@]+$",
            "required": true
        }
    },
    "age": {
        "type": "L",
        "validate": {
            "min": 0,
            "max": 120
        }
    },
    "status": {
        "type": "T",
        "validate": {
            "enum": ["active", "inactive", "pending"],
            "default": "pending"
        }
    },
    "code": {
        "type": "T",
        "validate": {
            "pattern": "^[A-Z]{3}[0-9]{4}$",
            "length": 7
        }
    }
}
```

## UI Section

The `ui` object contains presentation hints for consuming applications.

### UI Keys

| Key | Type | Description |
|-----|------|-------------|
| `label` | string | Display label |
| `placeholder` | string | Input placeholder text |
| `hint` | string | Help text / tooltip |
| `readonly` | boolean | Field is read-only |
| `hidden` | boolean | Field is hidden |
| `format` | string | Display format |
| `width` | number/string | Field width |
| `rows` | number | Textarea rows |

### Examples

```json
{
    "description": {
        "type": "T",
        "ui": {
            "label": "Description",
            "placeholder": "Enter a description...",
            "hint": "Maximum 500 characters",
            "rows": 5
        }
    },
    "created_at": {
        "type": "D",
        "ui": {
            "label": "Created",
            "readonly": true,
            "format": "DD/MM/YYYY"
        }
    }
}
```

### Conditional UI

UI properties can depend on other field values:

```json
{
    "vat_number": {
        "type": "T",
        "ui": {
            "label": "VAT Number",
            "hidden": "is_private=true"
        },
        "validate": {
            "required": "is_company=true"
        }
    }
}
```

Syntax: `"field_name=value"` or `"field_name!=value"`

## Complete Example

```json
{
    "id": "L",
    "name": {
        "type": "T",
        "validate": {
            "min": 1,
            "max": 100,
            "required": true
        },
        "ui": {
            "label": "Full Name",
            "placeholder": "John Doe"
        }
    },
    "email": {
        "type": "T",
        "validate": {
            "pattern": "^[^@]+@[^@]+\\.[^@]+$",
            "required": true
        },
        "ui": {
            "label": "Email Address"
        }
    },
    "age": {
        "type": "L",
        "validate": {
            "min": 0,
            "max": 120
        },
        "ui": {
            "label": "Age"
        }
    },
    "status": {
        "type": "T",
        "validate": {
            "enum": ["active", "inactive"],
            "default": "active"
        },
        "ui": {
            "label": "Status"
        }
    },
    "created": "D",
    "notes": {
        "type": "T",
        "ui": {
            "label": "Notes",
            "rows": 3
        }
    }
}
```

## System Meta-Structs

Meta-structs define the structure of struct components. Names starting with `_` are reserved for system use.

### @_VALIDATE

Defines the structure of the `validate` section:

```json
{
    "min": "L",
    "max": "L",
    "length": {"type": "L", "validate": {"min": 0}},
    "pattern": "T",
    "enum": "#T",
    "required": "B",
    "default": "T"
}
```

### @_UI

Defines the structure of the `ui` section:

```json
{
    "label": {"type": "T", "validate": {"max": 100}},
    "placeholder": {"type": "T", "validate": {"max": 200}},
    "hint": {"type": "T", "validate": {"max": 500}},
    "readonly": "B",
    "hidden": "T",
    "format": "T",
    "width": "T",
    "rows": {"type": "L", "validate": {"min": 1}}
}
```

### @_FIELD

Defines the structure of a complete field definition:

```json
{
    "type": {
        "type": "T",
        "validate": {
            "enum": ["T", "L", "R", "N", "B", "D", "DH", "DHZ", "H", "JS"],
            "required": true
        }
    },
    "validate": "@_VALIDATE",
    "ui": "@_UI"
}
```

## Struct Types

### Dict Schema

Schema maps field names to definitions:

```python
register_struct('CUSTOMER', {
    'name': 'T',
    'balance': {'type': 'N', 'validate': {'min': 0}},
    'created': 'D'
})
```

### List Schema (Positional)

Schema with multiple types applies by position:

```python
register_struct('ROW', ['T', 'L', 'N'])
```

### List Schema (Homogeneous)

Schema with single type applies to all elements:

```python
register_struct('PRICES', ['N'])
```

### Nested Structs

Reference other structs using `@NAME`:

```json
{
    "customer": "@CUSTOMER",
    "items": "#@ITEM",
    "shipping": "@ADDRESS",
    "billing": "@ADDRESS"
}
```

## Wire Format

```
<json_data>::@<CODE>
```

The JSON data is standard JSON (no inline types). The `::@CODE` suffix indicates which schema to use for hydration.

### Examples

```
{"name": "Acme", "balance": "100.50"}::@CUSTOMER
[["Product", 2, "100"]]::@ROW
[100, 200, 50]::@PRICES
```

## XTYTX Integration

Structs and JSON Schemas are defined in XTYTX envelopes:

```json
{
    "gstruct": {
        "ADDRESS": {
            "street": "T",
            "city": "T",
            "zip": "T"
        }
    },
    "lstruct": {
        "ORDER": {
            "id": "L",
            "customer": "@CUSTOMER",
            "items": "#@ITEM",
            "total": "N"
        }
    },
    "gschema": {
        "ADDRESS": {
            "type": "object",
            "properties": {
                "street": {"type": "string"},
                "city": {"type": "string"},
                "zip": {"type": "string", "pattern": "^[0-9]{5}$"}
            },
            "required": ["street", "city", "zip"]
        }
    },
    "lschema": {
        "ORDER": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "total": {"type": "number", "minimum": 0}
            },
            "required": ["id", "total"]
        }
    },
    "data": "..."
}
```

Fields:

- `gstruct`: Global TYTX structs (registered permanently) - for type hydration
- `lstruct`: Local TYTX structs (document-specific) - for type hydration
- `gschema`: Global JSON Schemas (registered permanently) - for validation
- `lschema`: Local JSON Schemas (document-specific) - for validation

### Design Philosophy

TYTX is a **transport format**, not a validator. The separation is clear:

- **Structs** define type mapping for hydration/serialization (TYTX core responsibility)
- **Schemas** define validation rules in standard JSON Schema format (client responsibility)

This allows:

- TYTX to handle type hydration using simple structs
- Clients to implement full validation using JSON Schema (e.g., Zod in JavaScript, jsonschema in Python)

## API

### Python

```python
from genro_tytx import registry, schema_registry

# Register struct (for type hydration)
registry.register_struct('CUSTOMER', {
    'name': {'type': 'T', 'validate': {'required': True}},
    'email': 'T',
    'balance': 'N'
})

# Register JSON Schema (for validation)
schema_registry.register('CUSTOMER', {
    'type': 'object',
    'properties': {
        'name': {'type': 'string', 'minLength': 1},
        'email': {'type': 'string', 'format': 'email'},
        'balance': {'type': 'number', 'minimum': 0}
    },
    'required': ['name', 'email', 'balance']
})

# Parse with struct (hydration)
result = registry.from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER')
# -> {"name": "Acme", "balance": Decimal("100")}

# Validate with JSON Schema (client-side)
schema = schema_registry.get('CUSTOMER')
# Use jsonschema library: jsonschema.validate(data, schema)
```

### JavaScript

```javascript
const { registry } = require('genro-tytx');

// Register struct (for type hydration)
registry.registerStruct('CUSTOMER', {
    name: {type: 'T', validate: {required: true}},
    email: 'T',
    balance: 'N'
});

// Register JSON Schema (for validation)
registry.registerSchema('CUSTOMER', {
    type: 'object',
    properties: {
        name: {type: 'string', minLength: 1},
        email: {type: 'string', format: 'email'},
        balance: {type: 'number', minimum: 0}
    },
    required: ['name', 'email', 'balance']
});

// Parse with struct
const result = registry.fromText('{"name": "Acme", "balance": "100"}::@CUSTOMER');
// -> {name: "Acme", balance: 100}

// Validate with JSON Schema (use Ajv, Zod, etc.)
const schema = registry.getSchema('CUSTOMER');
```

### TypeScript

```typescript
import { registry, StructSchema } from 'genro-tytx';

const customerSchema: StructSchema = {
    name: {type: 'T', validate: {required: true}},
    email: 'T',
    balance: 'N'
};

registry.registerStruct('CUSTOMER', customerSchema);
registry.registerSchema('CUSTOMER', {
    type: 'object',
    properties: {
        name: {type: 'string', minLength: 1},
        email: {type: 'string', format: 'email'},
        balance: {type: 'number', minimum: 0}
    },
    required: ['name', 'email', 'balance']
});
```

## JSON Schema Conversion

Convert between JSON Schema and TYTX structs.

### struct_from_jsonschema()

Convert JSON Schema to TYTX struct, returning a `StructEntry`:

```python
from genro_tytx import struct_from_jsonschema

json_schema = {
    "title": "Customer",
    "type": "object",
    "properties": {
        "name": {"type": "string", "minLength": 1},
        "age": {"type": "integer", "minimum": 0}
    },
    "required": ["name"]
}

# Get StructEntry with TYTX schema only
entry = struct_from_jsonschema(json_schema)
# entry.code = "Customer"  # from title, or "Root" if missing
# entry.schema = {'name': {'type': 'T', 'validate': {'min': 1}}, 'age': {'type': 'L', 'validate': {'min': 0}}}
# entry.jsonschema = None

# Preserve original JSON Schema
entry = struct_from_jsonschema(json_schema, include_jsonschema=True)
# entry.jsonschema = json_schema (original preserved)
```

### struct_to_jsonschema()

Convert TYTX struct to JSON Schema:

```python
from genro_tytx import struct_to_jsonschema

struct = {'name': 'T', 'age': 'L', 'balance': 'N'}
schema = struct_to_jsonschema(struct, name="Customer")
# {
#     "title": "Customer",
#     "type": "object",
#     "properties": {
#         "name": {"type": "string"},
#         "age": {"type": "integer"},
#         "balance": {"type": "number"}
#     }
# }
```

## Pydantic Integration (Python)

TYTX provides two approaches for Pydantic integration:

### Simple Registration

For basic type mapping only:

```python
from pydantic import BaseModel, Field
from decimal import Decimal
from genro_tytx import registry

class Customer(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    balance: Decimal = Field(ge=0)

# Auto-generate struct from model
registry.register_struct_from_model('CUSTOMER', Customer)
```

### Full Schema with StructEntry

For complete validation support, use `struct_from_pydantic_model()` which returns a `StructEntry` containing both TYTX schema and optional JSON Schema:

```python
from dataclasses import dataclass
from typing import Any

@dataclass
class StructEntry:
    """Complete struct definition with optional JSON Schema."""
    code: str                           # Struct code, e.g., "CUSTOMER"
    description: str | None             # Human-readable description
    schema: dict[str, Any]              # TYTX schema: {"name": "T", "balance": "N"}
    jsonschema: dict | None             # Full JSON Schema for validation
```

Usage:

```python
from genro_tytx import struct_from_pydantic_model

# Get StructEntry with TYTX schema only
entry = struct_from_pydantic_model(Customer)
# entry.code = "CUSTOMER"
# entry.schema = {"name": "T", "email": "T", "balance": "N"}
# entry.jsonschema = None

# Get StructEntry with full JSON Schema
entry = struct_from_pydantic_model(
    Customer,
    include_jsonschema=True,
    description="Customer entity"
)
# entry.jsonschema = {
#     "type": "object",
#     "properties": {
#         "name": {"type": "string", "minLength": 1, "maxLength": 100},
#         "email": {"type": "string"},
#         "balance": {"type": "number", "minimum": 0}
#     },
#     "required": ["name", "email", "balance"]
# }
```

## XSD Integration (Python)

Convert XSD schemas to TYTX structs with optional JSON Schema generation.

**Installation**: `pip install genro-tytx[xsd]`

```python
from genro_tytx import struct_from_xsd

# Get StructEntry with TYTX schema only
entry = struct_from_xsd("customer.xsd")
# entry.code = "Customer"  # from XSD root element
# entry.schema = {"name": "T", "email": "T", "balance": "N"}
# entry.jsonschema = None

# Get StructEntry with full JSON Schema
entry = struct_from_xsd(
    "customer.xsd",
    include_jsonschema=True,
    description="Customer from XSD"
)
# entry.jsonschema = {
#     "type": "object",
#     "properties": {...},
#     "required": [...]
# }
```

The `struct_from_xsd()` function uses the same `StructEntry` return type and `include_jsonschema` parameter as `struct_from_pydantic_model()` for API consistency.

### XSD Type Mapping

| XSD Type | TYTX Code |
|----------|-----------|
| `xs:string` | `T` |
| `xs:integer`, `xs:int`, `xs:long` | `L` |
| `xs:decimal` | `N` |
| `xs:float`, `xs:double` | `R` |
| `xs:boolean` | `B` |
| `xs:date` | `D` |
| `xs:dateTime` | `DH` |
| `xs:time` | `H` |

## Reserved Names

Names starting with `_` are reserved for system meta-structs:

- `@_VALIDATE` - Validation section schema
- `@_UI` - UI section schema
- `@_FIELD` - Field definition schema
- `@_STRUCT` - Struct definition schema

User-defined structs MUST NOT start with `_`.

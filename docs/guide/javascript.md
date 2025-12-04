# JavaScript / TypeScript API

TYTX includes full JavaScript and TypeScript implementations for use in Node.js and browsers. TypeScript type definitions are included in the package.

## Installation

```bash
npm install genro-tytx
```

### Optional: Decimal Support

For precise decimal arithmetic (recommended for financial applications):

```bash
npm install big.js       # Lightweight (8KB) - recommended
# or
npm install decimal.js   # Full-featured (32KB)
```

TYTX automatically detects and uses whichever library is installed.

## Quick Start

```javascript
const { from_text, as_typed_text, from_json, as_typed_json } = require('genro-tytx');

// Parse typed strings
from_text("123::L");           // → 123 (number)
from_text("99.99::N");         // → 99.99 (number, or Big if big.js installed)
from_text("2025-01-15::D");    // → Date object
from_text("true::B");          // → true (boolean)

// Serialize with types
as_typed_text(123);            // → "123::L"
as_typed_text(new Date());     // → "2025-01-15::D"
as_typed_text(true);           // → "true::B"
```

## Core Functions

### from_text(value, type_code?)

Parse a typed string into a JavaScript value.

```javascript
from_text("123::L")              // → 123
from_text("100.50::N")           // → 100.50 (or Big instance)
from_text("2025-01-15::D")       // → Date(2025, 0, 15)
from_text("hello")               // → "hello" (no type)
from_text("123", "L")            // → 123 (explicit type)
```

### as_text(value, format?, locale?)

Convert a value to string, optionally formatted.

```javascript
as_text(123)                     // → "123"
as_text(new Date(2025, 0, 15))   // → "2025-01-15"
as_text(99.99, true, "it-IT")    // → "99,99" (formatted)
```

### as_typed_text(value)

Convert a value to typed string with `::type_code` suffix.

```javascript
as_typed_text(123)               // → "123::L"
as_typed_text(99.99)             // → "99.99::R"
as_typed_text(true)              // → "true::B"
as_typed_text("hello")           // → "hello" (strings have no suffix)
```

## JSON Functions

### as_typed_json(data)

Serialize to JSON with type suffixes (TYTX format).

```javascript
as_typed_json({
    price: 99.99,
    date: new Date(2025, 0, 15),
    active: true
});
// → '{"price":"99.99::R","date":"2025-01-15::D","active":"true::B"}'
```

### as_json(data)

Serialize to standard JSON (no type suffixes).

```javascript
as_json({
    price: 99.99,
    date: new Date(2025, 0, 15)
});
// → '{"price":99.99,"date":"2025-01-15"}'
```

### from_json(json_str)

Parse JSON and hydrate typed values.

```javascript
from_json('{"price": "99.99::N", "date": "2025-01-15::D"}');
// → { price: 99.99, date: Date(2025, 0, 15) }
```

## XML Functions

### as_typed_xml(data)

Serialize to XML with type suffixes.

```javascript
as_typed_xml({
    order: {
        attrs: { id: 123 },
        value: { price: { attrs: {}, value: 99.99 } }
    }
});
// → '<order id="123::L"><price>99.99::R</price></order>'
```

### from_xml(xml_str)

Parse XML and hydrate typed values.

```javascript
from_xml('<root><price>99.99::N</price></root>');
// → { root: { attrs: {}, value: { price: { attrs: {}, value: 99.99 } } } }
```

## Type Codes

| Code | Name | JS Type | Example |
|------|------|---------|---------|
| `L` | int | `number` | `"123::L"` |
| `R` | float | `number` | `"1.5::R"` |
| `N` | decimal | `number`/`Big` | `"100.50::N"` |
| `B` | bool | `boolean` | `"true::B"` |
| `T` | str | `string` | `"hello::T"` |
| `D` | date | `Date` | `"2025-01-15::D"` |
| `DHZ` | datetime | `Date` | `"2025-01-15T10:00:00Z::DHZ"` |
| `DH` | naive_datetime | `Date` | `"2025-01-15T10:00::DH"` (deprecated) |
| `H` | time | `Date` | `"10:30:00::H"` |
| `TYTX` | tytx | `object` | `'{"a":"1::L"}::TYTX'` |

## Decimal Library Support

TYTX automatically detects installed decimal libraries:

```javascript
const { decimalLibName, DecimalLib, isDecimalInstance } = require('genro-tytx');

console.log(decimalLibName);  // "big.js", "decimal.js", or "number"

// Check if a value is a Decimal instance
const value = from_text("99.99::N");
console.log(isDecimalInstance(value));  // true if big.js/decimal.js installed
```

**Priority order:**
1. `big.js` (lightweight, recommended)
2. `decimal.js` (full-featured)
3. Native `Number` (fallback)

## Registry API

### registry.register_class(options)

Register a custom extension type (prefixed with `~`).

```javascript
const { registry, from_text } = require('genro-tytx');

registry.register_class({
    code: 'UUID',  // becomes "~UUID" in wire format
    cls: null,     // JS doesn't have a built-in UUID class
    serialize: (value) => value.toLowerCase(),
    parse: (value) => {
        if (!/^[0-9a-f-]{36}$/i.test(value)) {
            throw new Error('Invalid UUID');
        }
        return value;
    }
});

// Now works
from_text("550e8400-e29b-41d4-a716-446655440000::~UUID");
```

See the [specification](../../spec/type-codes.md#custom-types--prefix) for complete documentation.

### registry.register_struct(code, schema)

Register a struct schema (prefixed with `@`).

```javascript
const { registry, from_text } = require('genro-tytx');

// Dict schema (JSON string) - keys map to types
registry.register_struct('CUSTOMER', '{"name": "T", "balance": "N"}');

// List positional schema (JSON string) - types by position
registry.register_struct('ROW', '["T", "L", "N"]');

// List homogeneous schema (JSON string) - one type for all elements
registry.register_struct('PRICES', '["N"]');
```

Usage:

```javascript
// Dict schema
from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER');
// → { name: "Acme", balance: 100 }

// List schema (positional)
from_text('[1, 2, 3]::@ROW');
// → ["1", 2, 3.0]

// Array of structs with #@
from_text('[[1, 2, 3], [4, 5, 6]]::#@ROW');
// → [["1", 2, 3.0], ["4", 5, 6.0]]
```

See the [structs specification](../../spec/structs.md) for complete documentation.

### registry.unregister_struct(code)

Remove a previously registered struct.

```javascript
registry.unregister_struct('CUSTOMER');  // removes @CUSTOMER
```

### registry.get_struct(code)

Get struct schema by code.

```javascript
registry.get_struct('CUSTOMER');  // → { name: 'T', balance: 'N' }
registry.get_struct('UNKNOWN');   // → undefined
```

### registry.get(code)

Get a type by code or name.

```javascript
registry.get("L");      // → IntType
registry.get("int");    // → IntType
registry.get("~UUID");  // → custom type info (if registered)
registry.get("@ROW");   // → struct type info (if registered)
registry.get("X");      // → null (unknown)
```

### registry.is_typed(value)

Check if a string contains a type suffix.

```javascript
registry.is_typed("123::L");        // → true
registry.is_typed("data::@ROW");    // → true (struct)
registry.is_typed("arr::#@ROW");    // → true (array of struct)
registry.is_typed("123");           // → false
```

## Browser Usage

For browser environments, use a bundler like webpack or esbuild:

```javascript
// ES modules (with bundler)
import { from_text, as_typed_text } from 'genro-tytx';
```

Or include directly (UMD build coming soon):

```html
<script src="path/to/genro-tytx.min.js"></script>
<script>
    const { from_text } = window.genroTytx;
    console.log(from_text("123::L"));  // 123
</script>
```

## TypeScript Support

Type definitions are included:

```typescript
import { from_text, as_typed_text, registry } from 'genro-tytx';

const value: number = from_text("123::L");
const typed: string = as_typed_text(123);
```

## Examples

### Express API Response

```javascript
const express = require('express');
const { as_typed_json } = require('genro-tytx');

app.get('/order/:id', async (req, res) => {
    const order = await getOrder(req.params.id);
    // Response preserves types for TYTX-aware clients
    res.type('application/json').send(as_typed_json(order));
});
```

### Configuration File

```javascript
const fs = require('fs');
const { from_json } = require('genro-tytx');

const config = from_json(fs.readFileSync('config.json', 'utf-8'));
// config.port is number, config.startDate is Date, etc.
```

### WebSocket Messages

```javascript
const { as_typed_json, from_json } = require('genro-tytx');

// Send
ws.send(as_typed_json({ timestamp: new Date(), value: 123.45 }));

// Receive
ws.on('message', (data) => {
    const msg = from_json(data);
    // msg.timestamp is Date, msg.value is number
});
```

## XTYTX Envelope Processing

XTYTX (Extended TYTX) provides self-describing payloads with embedded struct definitions.

### processEnvelope(envelope, options?)

Process an XTYTX envelope containing struct definitions and data.

```javascript
const { processEnvelope } = require('genro-tytx');

const envelope = {
    struct: { name: 'T', balance: 'N', active: 'B' },
    data: { name: 'Acme Corp', balance: '1000.50', active: 'true' }
};

const result = processEnvelope(envelope);
// result.data → { name: 'Acme Corp', balance: 1000.50, active: true }
```

#### With JSON Schemas

XTYTX supports global and local JSON Schemas for client-side validation:

```javascript
const envelope = {
    gstruct: { CUSTOMER: { code: 'T', email: 'T' } },
    lstruct: {},
    gschema: {
        CUSTOMER: {
            type: 'object',
            properties: {
                code: { type: 'string', pattern: '^[A-Z]{3}$' },
                email: { type: 'string', format: 'email' }
            },
            required: ['code', 'email']
        }
    },
    lschema: {},
    data: { code: 'ABC', email: 'test@example.com' }
};

const result = processEnvelope(envelope);
// result.data is hydrated
// result.globalSchemas contains global JSON schemas (registered in SchemaRegistry)
// result.localSchemas contains local JSON schemas (not registered)
// Use Ajv, Zod, or other JSON Schema validators for validation
```

## JSON Schema Conversion

Convert between JSON Schema / OpenAPI and TYTX struct definitions.

### structFromJsonSchema(schema, options?)

Convert JSON Schema to TYTX v2 struct definition.

```javascript
const { structFromJsonSchema } = require('genro-tytx');

const schema = {
    type: 'object',
    properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        email: { type: 'string', title: 'Email', description: 'User email' },
        price: { type: 'number', format: 'decimal' }
    },
    required: ['id', 'name']
};

const struct = structFromJsonSchema(schema);
// {
//     id: { type: 'L', validate: { required: true } },
//     name: { type: 'T', validate: { min: 1, max: 100, required: true } },
//     email: { type: 'T', ui: { label: 'Email', hint: 'User email' } },
//     price: 'N'
// }
```

**Options:**

- `name` (string): Name for root struct (used for nested struct naming)
- `registry` (TypeRegistry): Registry to register nested structs
- `registerNested` (boolean): Whether to register nested structs (default: true)

### structToJsonSchema(struct, options?)

Convert TYTX v2 struct to JSON Schema.

```javascript
const { structToJsonSchema } = require('genro-tytx');

const struct = {
    id: { type: 'L', validate: { required: true } },
    name: { type: 'T', validate: { min: 1, max: 100 } },
    email: { type: 'T', ui: { label: 'Email', hint: 'User email' } },
    price: 'N'
};

const schema = structToJsonSchema(struct, { name: 'User' });
// {
//     title: 'User',
//     type: 'object',
//     properties: {
//         id: { type: 'integer' },
//         name: { type: 'string', minLength: 1, maxLength: 100 },
//         email: { type: 'string', title: 'Email', description: 'User email' },
//         price: { type: 'number', format: 'decimal' }
//     },
//     required: ['id']
// }
```

**Options:**

- `name` (string): Title for the schema
- `registry` (TypeRegistry): Registry to resolve struct references (@NAME)
- `includeDefinitions` (boolean): Include definitions for nested structs (default: true)

## Struct v2 Format

The v2 struct format separates type, validation, and UI metadata.

### Field Formats

```javascript
// Simple field (no constraints)
{ name: 'T' }

// Field with constraints
{
    name: {
        type: 'T',                              // TYTX type code
        validate: {                             // Validation constraints
            min: 1,                             // minLength for strings, minimum for numbers
            max: 100,                           // maxLength for strings, maximum for numbers
            length: 10,                         // exact length
            pattern: '^[A-Z]+$',                // regex pattern
            enum: ['active', 'inactive'],       // allowed values
            required: true,                     // field is required
            default: 'value'                    // default value
        },
        ui: {                                   // UI presentation hints
            label: 'Name',                      // display label
            hint: 'Enter your name',            // help text
            placeholder: 'John Doe',            // input placeholder
            readonly: true                      // read-only field
        }
    }
}
```

### Field Helper Functions

```javascript
const { getFieldType, getFieldValidate, getFieldUI } = require('genro-tytx');

const field = { type: 'T', validate: { min: 1 }, ui: { label: 'Name' } };

getFieldType(field);     // → 'T'
getFieldValidate(field); // → { min: 1 }
getFieldUI(field);       // → { label: 'Name' }

// Works with simple strings too
getFieldType('L');       // → 'L'
getFieldValidate('L');   // → undefined
getFieldUI('L');         // → undefined
```

## TypeScript Types

TypeScript includes full type definitions for struct v2:

```typescript
import type {
    FieldDef,       // { type, validate?, ui? }
    FieldValidate,  // { min?, max?, pattern?, enum?, required?, default? }
    FieldUI,        // { label?, hint?, placeholder?, readonly? }
    FieldValue,     // string | FieldDef
    StructSchema    // FieldValue[] | Record<string, FieldValue> | string
} from 'genro-tytx';

// Type-safe struct definition
const struct: Record<string, FieldValue> = {
    id: { type: 'L', validate: { required: true } },
    name: 'T'
};
```

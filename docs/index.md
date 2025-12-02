# TYTX - Typed Text Protocol

**A multi-language protocol for type-safe data exchange over JSON, XML, and MessagePack.**

```text
"99.99::N"      →  Decimal("99.99")
"2025-01-15::D" →  date(2025, 1, 15)
"true::B"       →  True
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-language** | Python, JavaScript, TypeScript - same API, same types |
| **Multi-format** | JSON, XML, MessagePack support |
| **Schema integration** | Pydantic, JSON Schema, OpenAPI, XSD |
| **Progressive complexity** | From simple types to complex nested structures |
| **Self-describing payloads** | XTYTX envelope ships schema + data together |
| **Framework independent** | No dependencies on Genropy or any other framework |

**Version**: 0.3.0 | **License**: Apache 2.0 | **Python**: 3.10+

---

## The Problem: JSON's Type Blindness

JSON only knows: string, number, boolean, null. What about `Decimal`, `Date`, `DateTime`?

```json
{
  "price": 100.50,
  "order_date": "2025-01-15",
  "quantity": 42
}
```

When your Python backend receives this:

- Is `price` a `float` (imprecise) or a `Decimal` (exact for money)?
- Is `order_date` a string or should it be a `date` object?
- This ambiguity causes bugs, especially with **financial data**.

## The Solution: Type-Encoded Values

TYTX embeds type information directly in values:

```json
{
  "price": "100.50::N",
  "order_date": "2025-01-15::D",
  "quantity": "42::L"
}
```

After parsing:

- `price` → `Decimal("100.50")` - exact numeric, safe for money
- `order_date` → `date(2025, 1, 15)` - proper date object
- `quantity` → `42` - integer

**No ambiguity. No surprises. Type safety across the wire.**

---

## Multi-Language Support

TYTX is available in **three implementations**:

| Package | Language | Install | Notes |
|---------|----------|---------|-------|
| `genro-tytx` | **Python** | `pip install genro-tytx` | Full feature set |
| `genro-tytx` | **JavaScript** | `npm install genro-tytx` | Pure JS (CommonJS + ESM) |
| `genro-tytx-ts` | **TypeScript** | `npm install genro-tytx-ts` | Native TS with full type definitions |

### Python

```python
from genro_tytx import from_text, as_typed_text
from decimal import Decimal

from_text("100.50::N")           # → Decimal("100.50")
as_typed_text(Decimal("100.50")) # → "100.50::N"
```

### JavaScript (Pure JS)

The JavaScript package works in **Node.js** and **browsers** with no build step required:

```javascript
// CommonJS
const { fromText, asTypedText } = require('genro-tytx');

// ESM
import { fromText, asTypedText } from 'genro-tytx';

fromText("100.50::N");  // → 100.50
asTypedText(100.50);    // → "100.50::R"
```

### TypeScript (Native)

The TypeScript package provides **full type definitions** and type inference:

```typescript
import { fromText, registry, StructSchema } from 'genro-tytx-ts';

const price: number = fromText("100.50::N");
const schema: StructSchema = { id: 'L', total: 'N' };
```

Your Python backend and JavaScript/TypeScript frontend speak the same type language.

---

## Progressive Complexity Levels

TYTX supports 8 levels of complexity. Use only what you need.

### Level 0: Simple Types

Basic type encoding with `value::code` syntax.

| Code | Type | Python | JS/TS |
|------|------|--------|-------|
| `L` | Integer | `int` | `number` |
| `R` | Real | `float` | `number` |
| `N` | Numeric | `Decimal` | `number` |
| `B` | Boolean | `bool` | `boolean` |
| `T` | Text | `str` | `string` |
| `D` | Date | `date` | `Date` |
| `DH` | DateTime | `datetime` | `Date` |
| `DHZ` | DateTime+TZ | `datetime` | `Date` |
| `H` | Time | `time` | `string` |

### Level 1: JSON/XML Integration

Full document parsing with automatic type hydration.

```python
from genro_tytx import from_json, as_typed_json

data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
json_str = as_typed_json(data)
# '{"price": "99.99::N", "date": "2025-01-15::D"}'
```

### Level 2: Typed Arrays

Homogeneous arrays with `#` prefix.

```python
from_text("[1,2,3]::#L")         # → [1, 2, 3]
from_text("[[1,2],[3,4]]::#L")   # → [[1, 2], [3, 4]] (nested)
```

### Level 3: Custom Types

Register your own types with `~` prefix.

```python
registry.register_class("UUID", uuid.UUID, str, uuid.UUID)
from_text("550e8400-...::~UUID")  # → UUID object
```

### Level 4: Struct Schemas

Define reusable schemas with `@` prefix.

```python
registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N'})
from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100")}
```

### Level 5: Nested Structures & Arrays of Structs

Hierarchical schemas with `@STRUCT` references and arrays with `#@STRUCT`.

```python
# Nested structs
registry.register_struct('ADDRESS', {'city': 'T', 'zip': 'L'})
registry.register_struct('CUSTOMER', {
    'name': 'T',
    'address': '@ADDRESS'  # nested struct reference
})

# Array of structs
registry.register_struct('ROW', 'name:T,qty:L,price:N')
from_text('[["A",1,"10"],["B",2,"20"]]::#@ROW')
# → [{"name": "A", "qty": 1, "price": Decimal("10")}, ...]
```

### Level 6: Field Metadata (Validation & UI)

Extended field definitions with validation and UI hints.

```python
registry.register_struct('PRODUCT', {
    'name': {
        'type': 'T',
        'validate': {'min': 1, 'max': 100},
        'ui': {'label': 'Product Name'}
    },
    'price': {
        'type': 'N',
        'validate': {'min': 0},
        'ui': {'format': 'currency'}
    }
})
```

### Level 7: XTYTX Self-Describing Payloads

Send schema and data together - the receiver doesn't need pre-registered structs.

```python
from genro_tytx import from_json

payload = '''XTYTX://{
    "gstruct": {},
    "lstruct": {"ORDER": {"id": "L", "total": "N"}},
    "data": "TYTX://{\\"id\\": \\"123\\", \\"total\\": \\"99.99\\"}::@ORDER"
}'''

result = from_json(payload)
# result.data → {"id": 123, "total": Decimal("99.99")}
```

**XTYTX fields:**

- `gstruct`: Global structs - registered permanently (for type hydration)
- `lstruct`: Local structs - valid only for this payload (for type hydration)
- `gschema`: Global JSON Schemas - registered permanently (for validation)
- `lschema`: Local JSON Schemas - valid only for this payload (for validation)
- `data`: TYTX-encoded data

**Note**: TYTX is a transport format, not a validator. Validation is delegated to JSON Schema via `gschema`/`lschema`.

---

## Format Support

| Format | Serialize | Parse | Notes |
|--------|-----------|-------|-------|
| **JSON** | `as_typed_json()` | `from_json()` | Primary format |
| **XML** | `as_typed_xml()` | `from_xml()` | Full attribute support |
| **MessagePack** | `packb()` | `unpackb()` | Binary, uses ExtType 42 |

### MessagePack

Binary serialization with full type preservation across all languages:

**Python** (requires `pip install genro-tytx[msgpack]`):

```python
from genro_tytx.msgpack_utils import packb, unpackb

data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
packed = packb(data)      # → bytes (compact binary)
restored = unpackb(packed)  # → original types preserved
```

**JavaScript/TypeScript** (requires `npm install @msgpack/msgpack`):

```javascript
import { packb, unpackb } from 'genro-tytx';

const data = { price: 99.99, date: new Date() };
const packed = packb(data);      // → Uint8Array
const restored = unpackb(packed);  // → types preserved
```

MessagePack is ideal for:

- High-performance APIs
- WebSocket communication
- Large data transfers (30-50% smaller than JSON)

---

## Schema Integration

### Pydantic ↔ TYTX

```python
# Pydantic → TYTX
registry.register_struct_from_model('ORDER', Order)

# TYTX → Pydantic
OrderModel = schema_to_model('ORDER', {'id': 'L', 'total': 'N'})
```

### JSON Schema / OpenAPI

```python
struct = struct_from_jsonschema(json_schema)  # JSON Schema → TYTX
schema = struct_to_jsonschema(struct)         # TYTX → JSON Schema
```

### XSD

```bash
python scripts/xsd_to_tytx.py schema.xsd --json > struct.json
```

---

## Visual Tools

| Tool | Status | Description |
|------|--------|-------------|
| **Structure Editor** | ✅ Done | Interactive editor for struct definitions |
| **Data Editor** | 🔜 Planned | Edit data instances using struct schemas |

---

## Framework Independence

TYTX is a **standalone protocol** with zero framework dependencies.

While developed by the same team behind [Genropy](https://github.com/genropy), TYTX is completely independent and can be used with:

- Any web framework (Flask, FastAPI, Django, Express...)
- Any frontend framework (React, Vue, Angular, Svelte...)
- Any data pipeline (Pandas, Polars, Spark...)
- Any API style (REST, GraphQL, gRPC...)

---

## Feature Status

| Feature | Python | JS | TS |
|---------|:------:|:--:|:--:|
| Base types (10 codes) | ✅ | ✅ | ✅ |
| Typed arrays (`#`) | ✅ | ✅ | ✅ |
| Custom types (`~`) | ✅ | ✅ | ✅ |
| Struct schemas (`@`) | ✅ | ✅ | ✅ |
| Nested structs | ✅ | ✅ | ✅ |
| XTYTX envelope | ✅ | ✅ | ✅ |
| Field metadata (v2) | ✅ | ✅ | ✅ |
| JSON serialization | ✅ | ✅ | ✅ |
| XML serialization | ✅ | ✅ | ✅ |
| MessagePack | ✅ | ✅ | ✅ |
| Pydantic integration | ✅ | N/A | N/A |
| JSON Schema | ✅ | ✅ | ✅ |
| XSD converter | ✅ | N/A | N/A |

---

## Next Steps

```{toctree}
:maxdepth: 2

installation
quickstart
guide/index
examples/index
api/reference
faq
```

---

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

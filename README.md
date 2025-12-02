# TYTX - Typed Text Protocol

**A multi-language protocol for type-safe data exchange over JSON, XML, and MessagePack.**

[![PyPI version](https://img.shields.io/pypi/v/genro-tytx)](https://pypi.org/project/genro-tytx/)
[![npm version](https://img.shields.io/npm/v/genro-tytx)](https://www.npmjs.com/package/genro-tytx)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tests](https://github.com/genropy/genro-tytx/actions/workflows/tests.yml/badge.svg)](https://github.com/genropy/genro-tytx/actions/workflows/tests.yml)
[![Documentation](https://readthedocs.org/projects/genro-tytx/badge/?version=latest)](https://genro-tytx.readthedocs.io/en/latest/)

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

---

## The Problem

JSON only knows: string, number, boolean, null. What about `Decimal`, `Date`, `DateTime`?

```json
{"price": 100.50, "date": "2025-01-15"}
```

Is `price` a float (imprecise) or a Decimal (exact for money)? Is `date` a string or a Date?

## The Solution

TYTX encodes type information directly in values:

```json
{"price": "100.50::N", "date": "2025-01-15::D"}
```

After parsing: `price` → `Decimal("100.50")`, `date` → `date(2025, 1, 15)`.

---

## Multi-Language Support

TYTX is available in **three implementations**:

| Package | Language | Install | Notes |
|---------|----------|---------|-------|
| `genro-tytx` | **Python** | `pip install genro-tytx` | Full feature set |
| `genro-tytx` | **JavaScript** | `npm install genro-tytx` | Pure JS (CommonJS + ESM) |
| `genro-tytx-ts` | **TypeScript** | `npm install genro-tytx-ts` | Native TS with full type definitions |

### HTTP helpers (Python / JS / TS)

Use the cross-language helpers to fetch APIs and get hydrated data via TYTX:

```ts
import { fetchTyped } from 'genro-tytx-ts';

// JSON with TYTX markers
const order = await fetchTyped('/api/order/123');

// Typed text
const active = await fetchTyped('/api/flag', { expect: 'text' });

// Typed XML (JS: from_xml, TS: falls back to fromText)
const qty = await fetchTyped('/api/xml/qty', { expect: 'xml' });

// Send typed payloads
import { fetchTypedRequest } from 'genro-tytx-ts';
const resp = await fetchTypedRequest('/api/order', {
    method: 'POST',
    body: { price: 99.99, qty: 5 },
    sendAs: 'json',               // default
    expect: 'json',
}); // headers include X-TYTX-Request and matching Content-Type

// Python: same behavior
from genro_tytx.http_utils import fetch_typed_request
resp = fetch_typed_request(
    "https://api.example.com/order",
    body={"price": Decimal("10.5")},
    send_as="json",
    expect="json",
)
```

Also available in JS (`genro-tytx`) as `fetch_typed` / `fetch_typed_request`.
See the HTTP helpers guide for XTYTX envelopes, MessagePack, and middleware usage.
For Node.js servers, use `hydrateTypedBody` (TS) to hydrate request bodies in Express/Koa/Fastify.
Async in Python: mirror helpers via `genro_tytx.http_async_utils` (`fetch_typed_async`, `fetch_typed_request_async`, `fetch_xtytx_async`).
Server-side hydration in Python: ASGI (`TytxASGIMiddleware`) and WSGI (`TytxWSGIMiddleware`) to auto-hydrate incoming TYTX/XTYTX/json/text/msgpack bodies.

### Python

```bash
pip install genro-tytx
```

```python
from genro_tytx import from_text, as_typed_text, from_json, as_typed_json
from decimal import Decimal

from_text("100.50::N")           # → Decimal("100.50")
as_typed_text(Decimal("99.99"))  # → "99.99::N"

from_json('{"price": "99.99::N", "qty": "5::L"}')
# → {"price": Decimal("99.99"), "qty": 5}
```

### JavaScript (Pure JS)

```bash
npm install genro-tytx
```

The JavaScript package works in **Node.js** and **browsers** with no build step required:

```javascript
// CommonJS
const { fromText, asTypedText, fromJson } = require('genro-tytx');

// ESM
import { fromText, asTypedText, fromJson } from 'genro-tytx';

fromText("100.50::N");           // → 100.50
asTypedText(99.99);              // → "99.99::R"

fromJson('{"price": "99.99::N", "qty": "5::L"}');
// → {price: 99.99, qty: 5}
```

### TypeScript (Native)

```bash
npm install genro-tytx-ts
```

The TypeScript package provides **full type definitions** and type inference:

```typescript
import { fromText, asTypedText, registry, StructSchema } from 'genro-tytx-ts';

const price: number = fromText("100.50::N");
const schema: StructSchema = { id: 'L', total: 'N' };

registry.registerStruct('ORDER', schema);
```

---

## Progressive Complexity Levels

TYTX supports 8 levels of complexity. Use only what you need.

### Level 0: Simple Types

Basic type encoding with `value::code` syntax.

```python
from_text("123::L")           # → 123 (integer)
from_text("99.99::N")         # → Decimal("99.99")
from_text("2025-01-15::D")    # → date(2025, 1, 15)
from_text("true::B")          # → True
```

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

restored = from_json(json_str)
# {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
```

### Level 2: Typed Arrays

Homogeneous arrays with `#` prefix - type applied to all elements.

```python
from_text("[1,2,3]::#L")              # → [1, 2, 3]
from_text("[[1,2],[3,4]]::#L")        # → [[1, 2], [3, 4]] (nested)
from_text('["10.5","20.3"]::#N')      # → [Decimal("10.5"), Decimal("20.3")]
```

### Level 3: Custom Types

Register your own types with `~` prefix.

```python
import uuid
from genro_tytx import registry

registry.register_class("UUID", uuid.UUID, str, uuid.UUID)

from_text("550e8400-e29b-41d4-a716-446655440000::~UUID")
# → UUID("550e8400-e29b-41d4-a716-446655440000")
```

### Level 4: Struct Schemas

Define reusable schemas for data structures with `@` prefix. Try the structure editor: `gui/index.html`
```python
# Dict schema - for objects
registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N'})
from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100")}

# String schema - for CSV-like data
registry.register_struct('POINT', 'x:R,y:R')
from_text('["3.7", "7.3"]::@POINT')
# → {"x": 3.7, "y": 7.3}
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

from_text('{"name": "John", "address": {"city": "Rome", "zip": "00100"}}::@CUSTOMER')
# → {"name": "John", "address": {"city": "Rome", "zip": 100}}

# Array of structs
registry.register_struct('ROW', 'name:T,qty:L,price:N')
from_text('[["A",1,"10"],["B",2,"20"]]::#@ROW')
# → [{"name": "A", "qty": 1, "price": Decimal("10")},
#    {"name": "B", "qty": 2, "price": Decimal("20")}]
```

### Level 6: Field Metadata (Validation & UI)

Extended field definitions with validation constraints and UI hints.

```python
registry.register_struct('PRODUCT', {
    'name': {
        'type': 'T',
        'validate': {'min': 1, 'max': 100},
        'ui': {'label': 'Product Name', 'placeholder': 'Enter name'}
    },
    'price': {
        'type': 'N',
        'validate': {'min': 0},
        'ui': {'label': 'Price', 'format': 'currency'}
    }
})
```

### Level 7: XTYTX Self-Describing Payloads

Send schema and data together - the receiver doesn't need pre-registered structs.

```python
from genro_tytx import from_json

# Self-contained payload with embedded schema
payload = '''XTYTX://{
    "gstruct": {},
    "lstruct": {
        "ORDER": {"id": "L", "total": "N", "date": "D"}
    },
    "data": "TYTX://{\\"id\\": \\"123\\", \\"total\\": \\"99.99\\", \\"date\\": \\"2025-01-15\\"}::@ORDER"
}'''

result = from_json(payload)
# result.data → {"id": 123, "total": Decimal("99.99"), "date": date(2025, 1, 15)}
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

### JSON

```python
from genro_tytx import from_json, as_typed_json

as_typed_json({"price": Decimal("99.99")})
# '{"price": "99.99::N"}'
```

### XML

```python
from genro_tytx import from_xml, as_typed_xml

from_xml('<order><price>99.99::N</price></order>')
# {"order": {"attrs": {}, "value": {"price": {..., "value": Decimal("99.99")}}}}
```

### MessagePack

Binary serialization with full type preservation across all languages. Uses ExtType 42 for TYTX payloads.

**Python** (requires `pip install genro-tytx[msgpack]`):

```python
from genro_tytx.msgpack_utils import packb, unpackb

data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
packed = packb(data)      # → bytes (compact binary)
restored = unpackb(packed)  # → original types preserved
```

**JavaScript** (requires `npm install @msgpack/msgpack`):

```javascript
import { packb, unpackb } from 'genro-tytx';

const data = { price: 99.99, date: new Date() };
const packed = packb(data);      // → Uint8Array
const restored = unpackb(packed);  // → types preserved
```

**TypeScript** (requires `npm install @msgpack/msgpack`):

```typescript
import { packb, unpackb } from 'genro-tytx-ts';

const data = { price: 99.99, date: new Date() };
const packed: Uint8Array = packb(data);
const restored = unpackb(packed);
```

MessagePack is ideal for:

- High-performance APIs
- WebSocket communication
- Large data transfers (30-50% smaller than JSON)

---

## Schema Integration

### Pydantic → TYTX

```python
from pydantic import BaseModel
from genro_tytx import registry

class Order(BaseModel):
    id: int
    total: Decimal
    date: date

registry.register_struct_from_model('ORDER', Order)
# Registers: {'id': 'L', 'total': 'N', 'date': 'D'}
```

### TYTX → Pydantic

```python
from genro_tytx.utils import schema_to_model

OrderModel = schema_to_model('ORDER', {'id': 'L', 'total': 'N', 'date': 'D'})
order = OrderModel(id=123, total=Decimal("99.99"), date=date.today())
```

### JSON Schema / OpenAPI

```python
from genro_tytx import struct_from_jsonschema, struct_to_jsonschema

# JSON Schema → TYTX
json_schema = {"type": "object", "properties": {"id": {"type": "integer"}}}
struct = struct_from_jsonschema(json_schema)  # → {"id": "L"}

# TYTX → JSON Schema
struct_to_jsonschema({"id": "L", "name": "T"})
# → {"type": "object", "properties": {...}}
```

### XSD

```bash
python scripts/xsd_to_tytx.py schema.xsd --json > struct.json
```

---

## Installation

### Python

```bash
pip install genro-tytx                    # Core
pip install genro-tytx[pydantic]          # + Pydantic support
pip install genro-tytx[msgpack]           # + MessagePack support
pip install genro-tytx[pydantic,msgpack]  # All extras
```

### JavaScript / TypeScript

```bash
npm install genro-tytx
```

---

## Dependencies

TYTX has **zero required dependencies** - it uses only the Python standard library.

**Optional dependencies** (install only if needed):

- `pydantic` - for Pydantic model integration (`pip install genro-tytx[pydantic]`)
- `msgpack` - for MessagePack binary format (`pip install genro-tytx[msgpack]`)
- `orjson` - for faster JSON serialization (auto-detected)

TYTX can be used with any framework:

- Web framework (Flask, FastAPI, Django, Express, Fastify...)
- Frontend framework (React, Vue, Angular, Svelte...)
- Data pipeline (Pandas, Polars, Apache Spark...)
- API (REST, GraphQL, gRPC...)

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

See [spec/roadmap.md](spec/roadmap.md) for detailed documentation.

---

## Documentation

- **[Full Documentation](https://genro-tytx.readthedocs.io/)** (ReadTheDocs)
- [Quick Start](docs/quickstart.md)
- [Type Guide](docs/guide/types.md)
- [Pydantic Integration](docs/guide/pydantic.md)
- [Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)

---

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

Copyright 2025 Softwell S.r.l.

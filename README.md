# genro-tytx

**TYTX (Typed Text)** - A protocol for exchanging typed data over text-based formats.

[![PyPI version](https://badge.fury.io/py/genro-tytx.svg)](https://badge.fury.io/py/genro-tytx)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview

TYTX solves the "stringly typed" problem of JSON and other text formats by encoding type information directly into value strings using a concise syntax.

### The Problem

JSON only supports: string, number, boolean, null. What about `Decimal`, `Date`, `DateTime`, `Table`?

```json
{
  "price": 100.50,
  "date": "2025-01-15"
}
```

Is `price` a float or a precise Decimal? Is `date` a string or a Date object?

### The TYTX Solution

```json
{
  "price": "100.50::D",
  "date": "2025-01-15::d"
}
```

The `::` suffix encodes type information. After hydration:
- `price` → `Decimal("100.50")`
- `date` → `date(2025, 1, 15)`

## Syntax

```
value::type_code
```

| Native Type | TYTX Syntax | Description |
|-------------|-------------|-------------|
| `int` | `"123::I"` | Integer |
| `Decimal` | `"100.50::D"` | Exact decimal (money) |
| `datetime` | `"2025-01-15T10:00::dt"` | ISO DateTime |
| `date` | `"2025-01-15::d"` | ISO Date |
| `bool` | `"true::B"` | Boolean |
| `list` | `"a,b,c::L"` | Comma-separated list |
| `Table` | `"{...}::T"` | Tabular data |

### Global Marker

For entire payloads containing TYTX values:

```
{"price": "100::D", "date": "2025-01-15::d"}::TYTX
```

The `::TYTX` suffix indicates the payload contains typed values that need hydration.

## Installation

```bash
pip install genro-tytx
```

### Optional Dependencies

```bash
# Fast JSON with orjson
pip install genro-tytx[json]

# MessagePack support
pip install genro-tytx[msgpack]

# All extras
pip install genro-tytx[all]
```

## Quick Start

### Python

```python
from genro_tytx import hydrate, serialize, registry

# Hydrate TYTX values
data = {"price": "100.50::D", "date": "2025-01-15::d"}
result = hydrate(data)
# result = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}

# Serialize Python objects
from decimal import Decimal
from datetime import date

data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
result = serialize(data)
# result = {"price": "100.50::D", "date": "2025-01-15::d"}
```

### JavaScript

```javascript
import { hydrate, serialize } from 'genro-tytx';

// Hydrate TYTX values
const data = { price: "100.50::D", date: "2025-01-15::d" };
const result = hydrate(data);
// result = { price: new Decimal("100.50"), date: new Date("2025-01-15") }

// Serialize JavaScript objects
const data = { price: new Decimal("100.50"), date: new Date("2025-01-15") };
const result = serialize(data);
// result = { price: "100.50::D", date: "2025-01-15::d" }
```

## Format Support

TYTX works with multiple formats:

### JSON
```python
import json
from genro_tytx.encoders import TYTXEncoder, tytx_decoder

# Encode
json.dumps(data, cls=TYTXEncoder)

# Decode
json.loads(text, object_hook=tytx_decoder)
```

### XML
```xml
<item price="100.50::D" date="2025-01-15::d" />
```

### MessagePack
```python
import msgpack
from genro_tytx.encoders import msgpack_encode, msgpack_decode

# TYTX uses ExtType(42) for typed payloads
packed = msgpack.packb(data, default=msgpack_encode)
unpacked = msgpack.unpackb(packed, ext_hook=msgpack_decode)
```

## Custom Types

Register custom types with the registry:

```python
from genro_tytx import registry

@registry.register("UUID", "U")
class UUIDType:
    python_type = uuid.UUID

    @staticmethod
    def parse(value: str) -> uuid.UUID:
        return uuid.UUID(value)

    @staticmethod
    def serialize(obj: uuid.UUID) -> str:
        return str(obj)

# Now works automatically
hydrate({"id": "550e8400-e29b-41d4-a716-446655440000::U"})
# {"id": UUID("550e8400-e29b-41d4-a716-446655440000")}
```

## Integration

### With genro-asgi

```python
from genro_asgi import WebSocket

async def handler(ws: WebSocket):
    await ws.accept()

    # Receive with automatic TYTX hydration
    data = await ws.receive_typed()

    # Send with automatic TYTX serialization
    await ws.send_typed({"price": Decimal("100.50")})
```

### With Pydantic

TYTX hydration happens **before** Pydantic validation:

```python
from pydantic import BaseModel
from decimal import Decimal

class Order(BaseModel):
    price: Decimal
    date: date

# 1. JSON arrives: {"price": "100::D", "date": "2025-01-15::d"}
# 2. TYTX hydrates: {"price": Decimal("100"), "date": date(2025, 1, 15)}
# 3. Pydantic validates the already-typed data
```

## Specification

See [spec/](spec/) for the complete TYTX specification.

## Development Status

**Pre-Alpha** - Protocol specification phase. API may change.

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

Copyright 2025 Softwell S.r.l.

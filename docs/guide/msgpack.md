# MessagePack Utilities

TYTX provides optional MessagePack support for binary serialization with type preservation.

## Installation

MessagePack support requires the optional `msgpack` dependency:

```bash
pip install genro-tytx[msgpack]
```

## Overview

TYTX uses MessagePack ExtType code **42** for typed payloads. The content is UTF-8 encoded TYTX JSON.

| Function | Purpose |
|----------|---------|
| `packb(data)` | Pack with TYTX types preserved |
| `unpackb(packed)` | Unpack with types restored |
| `tytx_encoder` | Custom encoder for `msgpack.packb` |
| `tytx_decoder` | Custom decoder for `msgpack.unpackb` |

## Basic Usage

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_packb_unpackb_roundtrip -->

```python
from genro_tytx.msgpack_utils import packb, unpackb
from decimal import Decimal
from datetime import date, datetime

data = {
    "price": Decimal("99.99"),
    "date": date(2025, 1, 15),
    "timestamp": datetime(2025, 1, 15, 10, 30, 0),
    "count": 42,
    "name": "Test",
}

# Pack to bytes
packed = packb(data)

# Unpack with types restored
restored = unpackb(packed)

assert restored["price"] == Decimal("99.99")  # Decimal preserved!
assert restored["date"] == date(2025, 1, 15)  # date preserved!
```

## Nested Structures

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_nested_structures -->

TYTX types in nested dicts and lists are preserved:

```python
from genro_tytx.msgpack_utils import packb, unpackb
from decimal import Decimal
from datetime import date

data = {
    "order": {
        "items": [
            {"name": "Widget", "price": Decimal("25.00")},
            {"name": "Gadget", "price": Decimal("75.50")},
        ],
        "total": Decimal("100.50"),
        "date": date(2025, 6, 15),
    }
}

packed = packb(data)
restored = unpackb(packed)

assert restored["order"]["total"] == Decimal("100.50")
assert restored["order"]["items"][0]["price"] == Decimal("25.00")
```

## Direct msgpack Integration

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_encoder_decoder_direct -->

Use the encoder/decoder functions directly with msgpack:

```python
import msgpack
from genro_tytx.msgpack_utils import tytx_encoder, tytx_decoder
from decimal import Decimal

data = {"price": Decimal("50.00")}

# Pack with custom encoder
packed = msgpack.packb(data, default=tytx_encoder)

# Unpack with custom decoder
restored = msgpack.unpackb(packed, ext_hook=tytx_decoder)

assert restored["price"] == Decimal("50.00")
```

## ExtType Code 42

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_ext_type_code -->

TYTX reserves MessagePack ExtType code **42**:

```python
import msgpack
from genro_tytx.msgpack_utils import TYTX_EXT_TYPE, tytx_encoder
from decimal import Decimal

assert TYTX_EXT_TYPE == 42

data = {"price": Decimal("10.00")}
ext = tytx_encoder(data)

assert isinstance(ext, msgpack.ExtType)
assert ext.code == 42  # TYTX marker
```

The ExtType content is UTF-8 encoded TYTX JSON:

```python
# ExtType(42, b'{"price": "10.00::N"}::TYTX')
```

## Primitives Pass Through

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_primitives_only -->

Data without TYTX types uses native MessagePack encoding:

```python
from genro_tytx.msgpack_utils import packb, unpackb

data = {"name": "Test", "count": 42, "active": True}

packed = packb(data)
restored = unpackb(packed)

assert restored == data  # Native types preserved
```

## Unknown ExtType Handling

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_unknown_ext_type -->

Unknown ExtType codes are returned as-is:

```python
import msgpack
from genro_tytx.msgpack_utils import tytx_decoder

# Some other application's ExtType
result = tytx_decoder(99, b"some data")

assert isinstance(result, msgpack.ExtType)
assert result.code == 99
```

## Error Handling

<!-- test: test_core.py::TestMsgpackUtils::test_msgpack_encoder_non_serializable -->

Non-TYTX types that can't be serialized raise `TypeError`:

```python
from genro_tytx.msgpack_utils import tytx_encoder

class CustomType:
    pass

tytx_encoder(CustomType())  # raises TypeError
```

## Performance Considerations

1. **Overhead**: ExtType adds ~3 bytes header + UTF-8 JSON string
2. **Parsing**: JSON parsing inside ExtType adds CPU cost
3. **When to use**: Best for mixed data with TYTX types

For high-throughput scenarios with only native types, use native MessagePack:

```python
import msgpack

# Data without TYTX types - use native msgpack
data = {"count": 42, "name": "test"}
packed = msgpack.packb(data)
```

## Use Cases

### Binary Protocol

```python
from genro_tytx.msgpack_utils import packb, unpackb

async def handle_binary(data: bytes):
    message = unpackb(data)
    result = process(message)
    return packb(result)
```

### File Storage

```python
from genro_tytx.msgpack_utils import packb, unpackb
from decimal import Decimal

def save_state(state: dict, path: str):
    with open(path, "wb") as f:
        f.write(packb(state))

def load_state(path: str) -> dict:
    with open(path, "rb") as f:
        return unpackb(f.read())

# Decimal precision preserved across save/load
state = {"balance": Decimal("1234567.89")}
save_state(state, "state.msgpack")
restored = load_state("state.msgpack")
assert restored["balance"] == Decimal("1234567.89")
```

### Redis Cache

```python
import redis
from genro_tytx.msgpack_utils import packb, unpackb

r = redis.Redis()

def cache_set(key: str, value: dict, ttl: int = 3600):
    r.setex(key, ttl, packb(value))

def cache_get(key: str) -> dict | None:
    data = r.get(key)
    return unpackb(data) if data else None
```

## Comparison with JSON

| Feature | JSON | MessagePack |
|---------|------|-------------|
| Format | Text | Binary |
| Size | Larger | Smaller |
| Parse Speed | Slower | Faster |
| Human Readable | Yes | No |
| TYTX Support | Built-in | Via ExtType |

Use MessagePack when:
- Binary protocol is acceptable
- Size/speed is critical
- Data is machine-to-machine

Use JSON when:
- Human readability needed
- Debugging is important
- Web API compatibility required

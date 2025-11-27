# TYTX MessagePack Format Specification

**Version**: 1.0

This document specifies how TYTX integrates with MessagePack.

## Overview

MessagePack is a binary serialization format. It supports Extension Types for custom data.

TYTX uses **ExtType code 42** for typed payloads.

## Extension Type

### Code Assignment

| ExtType Code | Purpose |
|--------------|---------|
| 42 | TYTX typed payload |

### Content Format

The ExtType content is always a UTF-8 encoded TYTX string (same format as JSON):

```python
ExtType(42, b'{"price": "100::D"}::TYTX')
```

This design allows:
- Single parser for all formats
- Human-readable debugging
- Consistent behavior across JSON/XML/MessagePack

## Encoding

### Python Implementation

```python
import msgpack
from genro_tytx.encoders import msgpack_encode

def msgpack_encode(obj):
    """Default function for msgpack.packb."""
    if has_tytx_types(obj):
        # Serialize to TYTX JSON string
        tytx_str = json.dumps(serialize(obj)) + "::TYTX"
        return msgpack.ExtType(42, tytx_str.encode('utf-8'))
    raise TypeError(f"Unknown type: {type(obj)}")

# Usage
packed = msgpack.packb(data, default=msgpack_encode)
```

### JavaScript Implementation

```typescript
import { encode, ExtensionCodec } from '@msgpack/msgpack';
import { serialize } from 'genro-tytx';

const extensionCodec = new ExtensionCodec();
extensionCodec.register({
  type: 42,
  encode: (obj) => {
    const tytxStr = JSON.stringify(serialize(obj)) + "::TYTX";
    return new TextEncoder().encode(tytxStr);
  },
  decode: (data) => {
    const tytxStr = new TextDecoder().decode(data);
    return hydrateTYTX(tytxStr);
  }
});

const packed = encode(data, { extensionCodec });
```

## Decoding

### Python Implementation

```python
import msgpack
from genro_tytx.encoders import msgpack_decode

def msgpack_decode(code, data):
    """ext_hook function for msgpack.unpackb."""
    if code == 42:
        tytx_str = data.decode('utf-8')
        if tytx_str.endswith("::TYTX"):
            json_str = tytx_str[:-6]  # Remove ::TYTX
            return hydrate(json.loads(json_str))
        return json.loads(tytx_str)
    return msgpack.ExtType(code, data)

# Usage
unpacked = msgpack.unpackb(packed, ext_hook=msgpack_decode)
```

### JavaScript Implementation

```typescript
import { decode, ExtensionCodec } from '@msgpack/msgpack';
import { hydrate } from 'genro-tytx';

const extensionCodec = new ExtensionCodec();
extensionCodec.register({
  type: 42,
  decode: (data) => {
    const tytxStr = new TextDecoder().decode(data);
    if (tytxStr.endsWith("::TYTX")) {
      const jsonStr = tytxStr.slice(0, -6);
      return hydrate(JSON.parse(jsonStr));
    }
    return JSON.parse(tytxStr);
  }
});

const unpacked = decode(packed, { extensionCodec });
```

## When to Use ExtType

### Use ExtType (code 42) when:

1. The object contains TYTX types (Decimal, date, etc.)
2. You want to preserve type information across the wire
3. The receiver expects typed data

### Skip ExtType when:

1. Data is already primitive (string, number, boolean, null)
2. Arrays/objects contain only primitives
3. Performance is critical and types aren't needed

## Hybrid Approach

For efficiency, you can mix native MessagePack types with TYTX:

```python
def smart_encode(obj):
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj  # Native MessagePack
    if isinstance(obj, (list, tuple)):
        return [smart_encode(item) for item in obj]
    if isinstance(obj, dict):
        return {k: smart_encode(v) for k, v in obj.items()}
    # Complex types -> TYTX ExtType
    return msgpack.ExtType(42, serialize_single(obj).encode('utf-8'))
```

## Performance Considerations

1. **Overhead**: ExtType adds ~3 bytes header + UTF-8 string
2. **Parsing**: JSON parsing inside ExtType adds CPU cost
3. **Recommendation**: For high-throughput, consider batching or native MessagePack types

## Compatibility

- msgpack-python >= 1.0.0
- @msgpack/msgpack >= 3.0.0

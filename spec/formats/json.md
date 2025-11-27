# TYTX JSON Format Specification

**Version**: 1.0

This document specifies how TYTX integrates with JSON.

## Overview

JSON natively supports: string, number, boolean, null, object, array.

TYTX extends JSON by encoding type information in string values using the `value::type_code` syntax.

## Encoding

### Single Values

TYTX values are JSON strings with the `::type_code` suffix:

```json
{
  "price": "100.50::D",
  "date": "2025-01-15::d",
  "active": "true::B"
}
```

### Global Marker

For payloads containing TYTX values, append `::TYTX` to the JSON string:

```
{"price": "100.50::D", "date": "2025-01-15::d"}::TYTX
```

This marker indicates the payload should be hydrated.

### Nested Objects

TYTX values can appear at any nesting level:

```json
{
  "order": {
    "items": [
      {"name": "Widget", "price": "10.50::D"},
      {"name": "Gadget", "price": "25.00::D"}
    ],
    "total": "35.50::D",
    "created": "2025-01-15T10:30:00::dt"
  }
}
```

## Decoding (Hydration)

### Algorithm

1. Parse JSON normally
2. Walk the resulting object recursively
3. For each string value, check if it matches `value::type_code`
4. If matched and type_code is registered, convert to native type
5. If not matched or unknown code, keep as string

### Python Implementation

```python
import json
from genro_tytx.encoders import tytx_decoder

# Method 1: object_hook (per-object)
data = json.loads(text, object_hook=tytx_decoder)

# Method 2: Post-process (full tree)
from genro_tytx import hydrate
data = hydrate(json.loads(text))
```

### JavaScript Implementation

```typescript
import { hydrate } from 'genro-tytx';

// Method 1: reviver function
const data = JSON.parse(text, tytxReviver);

// Method 2: Post-process
const data = hydrate(JSON.parse(text));
```

## Encoding (Serialization)

### Algorithm

1. Walk the object recursively
2. For each value, check if it's a registered type
3. If registered, convert to `value::type_code` string
4. Serialize to JSON

### Python Implementation

```python
import json
from genro_tytx.encoders import TYTXEncoder

# Custom encoder
text = json.dumps(data, cls=TYTXEncoder)

# Or pre-process
from genro_tytx import serialize
text = json.dumps(serialize(data))
```

### JavaScript Implementation

```typescript
import { serialize } from 'genro-tytx';

// Pre-process then stringify
const text = JSON.stringify(serialize(data));

// Or custom replacer
const text = JSON.stringify(data, tytxReplacer);
```

## orjson Integration (Python)

For high-performance JSON, use orjson with a custom default:

```python
import orjson
from genro_tytx.encoders import orjson_default

# Encode
data = orjson.dumps(obj, default=orjson_default)

# Decode (post-process required)
from genro_tytx import hydrate
obj = hydrate(orjson.loads(data))
```

## Edge Cases

### Escaping

If a literal string needs to contain `::`, it's safe - TYTX only processes known type codes:

```json
{"note": "Use :: for namespaces"}
```

This is NOT hydrated because there's no valid type code after `::`.

### Null Values

Null values are preserved as-is:

```json
{"price": null}
```

To distinguish typed null, use explicit type:

```json
{"price": "null::D"}
```

This hydrates to `None` with Decimal type hint (useful for schemas).

### Empty Strings

Empty strings with type codes are valid:

```json
{"name": "::S"}
```

This hydrates to an empty string.

### Arrays

Arrays are walked recursively:

```json
["100::D", "200::D", "300::D"]
```

Hydrates to `[Decimal("100"), Decimal("200"), Decimal("300")]`.

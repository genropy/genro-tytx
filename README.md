# genro-tytx

**TYTX Base** - Typed Text Protocol for Scalar Types

Minimal implementation of the TYTX protocol supporting scalar types over JSON, XML, and MessagePack.

## Installation

```bash
pip install genro-tytx

# With optional dependencies
pip install genro-tytx[fast]      # orjson for faster JSON
pip install genro-tytx[msgpack]   # MessagePack support
pip install genro-tytx[all]       # All optional dependencies
```

## Quick Start

```python
from datetime import date
from decimal import Decimal
from genro_tytx import to_typed_text, from_text, to_typed_json, from_json

# Encode dict (text format - with ::JS suffix)
data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
text_str = to_typed_text(data)
# '{"price": "100.50::N", "date": "2025-01-15::D"}::JS'

# Encode scalar (no ::JS suffix)
scalar_str = to_typed_text(date(2025, 1, 15))
# '"2025-01-15::D"'

# Decode
result = from_text(text_str)
# {"price": Decimal("100.50"), "date": date(2025, 1, 15)}

# Encode (JSON format - with TYTX:// protocol prefix)
json_str = to_typed_json(data)
# 'TYTX://{"price": "100.50::N", "date": "2025-01-15::D"}::JS'

# Decode
result = from_json(json_str)
# {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
```

### API Functions

| Function | Format | Description |
|----------|--------|-------------|
| `to_typed_text` | `...::JS` or `"value::T"` | Encode dict/list with `::JS` suffix, scalar with type suffix only |
| `from_text` | `...::JS` or `"value::T"` | Decode text format |
| `to_typed_json` | `TYTX://...::JS` or `TYTX://"value::T"` | Encode with protocol prefix |
| `from_json` | `TYTX://...` | Decode JSON format (prefix optional) |

## Supported Types

### JSON (non-native types only)

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `N` | `"100.50::N"` |
| date | `D` | `"2025-01-15::D"` |
| datetime | `DHZ` | `"2025-01-15T10:30:00Z::DHZ"` |
| time | `H` | `"10:30:00::H"` |

> **Note**: `DH` is deprecated but still accepted for backward compatibility.

### XML (all types, everything is string)

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `N` | `<price>100.50::N</price>` |
| date | `D` | `<d>2025-01-15::D</d>` |
| datetime | `DHZ` | `<dt>2025-01-15T10:30:00.000Z::DHZ</dt>` |
| time | `H` | `<t>10:30:00::H</t>` |
| bool | `B` | `<flag>1::B</flag>` |
| int | `L` | `<count>42::L</count>` |

## Formats

### JSON

```python
from decimal import Decimal
from genro_tytx import to_typed_text, from_text, to_typed_json, from_json

# Text format (suffix only)
encoded = to_typed_text({"price": Decimal("100.50")})
# '{"price": "100.50::N"}::JS'
decoded = from_text(encoded)

# JSON format (with TYTX:// protocol prefix)
encoded = to_typed_json({"price": Decimal("100.50")})
# 'TYTX://{"price": "100.50::N"}::JS'
decoded = from_json(encoded)
```

### XML

```python
from decimal import Decimal
from genro_tytx import to_xml, from_xml

data = {
    "order": {
        "attrs": {"id": 123},
        "value": {"price": {"attrs": {}, "value": Decimal("100.50")}}
    }
}
encoded = to_xml(data)
# '<order id="123::L"><price>100.50::N</price></order>'

decoded = from_xml(encoded)
```

### MessagePack

```python
from genro_tytx import to_msgpack, from_msgpack

packed = to_msgpack({"price": Decimal("100.50")})
unpacked = from_msgpack(packed)
```

## HTTP Utilities

```python
from genro_tytx import encode_body, decode_body, make_headers

# Create request
headers = make_headers("json")
body = encode_body(data, format="json")

# Parse response
result = decode_body(response_body, content_type=response.headers["Content-Type"])
```

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

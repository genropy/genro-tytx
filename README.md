# genro-tytx-base

**TYTX Base** - Typed Text Protocol for Scalar Types

Minimal implementation of the TYTX protocol supporting scalar types over JSON, XML, and MessagePack.

## Installation

```bash
pip install genro-tytx-base

# With optional dependencies
pip install genro-tytx-base[fast]      # orjson for faster JSON
pip install genro-tytx-base[msgpack]   # MessagePack support
pip install genro-tytx-base[all]       # All optional dependencies
```

## Quick Start

```python
from datetime import date
from decimal import Decimal
from genro_tytx_base import to_tytx, from_tytx

# Encode
data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
json_str = to_tytx(data)
# '{"price": "100.50::D", "date": "2025-01-15::d"}::JS'

# Decode
result = from_tytx(json_str)
# {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
```

## Supported Types

### JSON (non-native types only)

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `D` | `"100.50::D"` |
| date | `d` | `"2025-01-15::d"` |
| datetime | `DH` | `"2025-01-15T10:30:00Z::DH"` |
| time | `t` | `"10:30:00::t"` |

### XML (all types, everything is string)

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `D` | `<price _type="D">100.50</price>` |
| date | `d` | `<d _type="d">2025-01-15</d>` |
| datetime | `DH` | `<dt _type="DH">2025-01-15T10:30:00Z</dt>` |
| time | `t` | `<t _type="t">10:30:00</t>` |
| bool | `B` | `<flag _type="B">1</flag>` |
| int | `I` | `<count _type="I">42</count>` |

## Formats

### JSON

```python
from genro_tytx_base import to_tytx, from_tytx

encoded = to_tytx({"price": Decimal("100.50")})
decoded = from_tytx(encoded)
```

### XML

```python
from genro_tytx_base import to_xml, from_xml

encoded = to_xml({"price": Decimal("100.50")})
# '<root><price _type="D">100.50</price></root>'

decoded = from_xml(encoded)
```

### MessagePack

```python
from genro_tytx_base import to_msgpack, from_msgpack

packed = to_msgpack({"price": Decimal("100.50")})
unpacked = from_msgpack(packed)
```

## HTTP Utilities

```python
from genro_tytx_base import encode_body, decode_body, make_headers

# Create request
headers = make_headers("json")
body = encode_body(data, format="json")

# Parse response
result = decode_body(response_body, content_type=response.headers["Content-Type"])
```

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

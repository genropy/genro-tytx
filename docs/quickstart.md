# Quick Start

Get productive with TYTX Base in 5 minutes.

## Core Concept

TYTX uses `value::type_code` syntax to encode type information in strings:

| Syntax | Python Result |
|--------|---------------|
| `"100.50::N"` | `Decimal("100.50")` |
| `"2025-01-15::D"` | `date(2025, 1, 15)` |
| `"2025-01-15T10:30:00Z::DHZ"` | `datetime(2025, 1, 15, 10, 30, tzinfo=...)` |
| `"10:30:00::H"` | `time(10, 30, 0)` |

## Basic Usage

### Encode Python to TYTX JSON

```python
from datetime import date, datetime, time
from decimal import Decimal
from genro_tytx import to_typed_text, to_typed_json

data = {
    "price": Decimal("99.99"),
    "date": date(2025, 1, 15),
    "time": time(10, 30, 0),
    "name": "Widget"  # Native JSON type, no encoding
}

# Text format (suffix only)
to_typed_text(data)
# '{"price": "99.99::N", "date": "2025-01-15::D", "time": "10:30:00::H", "name": "Widget"}::JS'

# JSON format (with TYTX:// protocol prefix)
to_typed_json(data)
# 'TYTX://{"price": "99.99::N", "date": "2025-01-15::D", "time": "10:30:00::H", "name": "Widget"}::JS'
```

### Decode TYTX JSON to Python

```python
from genro_tytx import from_text, from_json

# Decode text format
result = from_text('{"price": "99.99::N", "date": "2025-01-15::D"}::JS')
# {"price": Decimal("99.99"), "date": date(2025, 1, 15)}

# Decode JSON format (with or without TYTX:// prefix)
result = from_json('TYTX://{"price": "99.99::N", "date": "2025-01-15::D"}::JS')
# {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
```

## XML Usage

TYTX Base encodes types in XML using inline `::SUFFIX` syntax (same as JSON):

```python
from decimal import Decimal
from datetime import date
from genro_tytx import to_xml, from_xml

# Encode to XML (requires attrs/value structure)
data = {
    "order": {
        "attrs": {"id": 123},
        "value": {
            "price": {"attrs": {}, "value": Decimal("99.99")},
            "date": {"attrs": {}, "value": date(2025, 1, 15)}
        }
    }
}
xml = to_xml(data)
# '<order id="123::L"><price>99.99::N</price><date>2025-01-15::D</date></order>'

# Decode from XML
result = from_xml(xml)
```

## MessagePack Usage

TYTX Base uses ExtType(42) for binary serialization:

```python
from decimal import Decimal
from genro_tytx import to_msgpack, from_msgpack

data = {"price": Decimal("99.99")}

# Encode to binary
packed = to_msgpack(data)

# Decode from binary
result = from_msgpack(packed)
# {"price": Decimal("99.99")}
```

> **Note**: Requires `pip install genro-tytx[msgpack]`

## HTTP Utilities

For web applications:

```python
from genro_tytx import encode_body, decode_body, make_headers

# Create request with TYTX MIME type
headers = make_headers("json")  # {"Content-Type": "application/vnd.tytx+json"}
body = encode_body(data, format="json")

# Parse response
result = decode_body(response_body, content_type="application/vnd.tytx+json")
```

> **Important**: When using HTTP with TYTX MIME types (`application/vnd.tytx+json`), the body is valid JSON **without** the `TYTX://` prefix. The Content-Type header already identifies the protocol. The `TYTX://` prefix would invalidate the JSON and is only used for self-identifying payloads stored without HTTP metadata.

## Type Codes Reference

### JSON (non-native types only)

TYTX Base only encodes types that JSON cannot represent natively:

| Code | Name | Python Type | Example |
|------|------|-------------|---------|
| `N` | decimal | `Decimal` | `"100.50::N"` |
| `D` | date | `date` | `"2025-01-15::D"` |
| `DHZ` | datetime | `datetime` | `"2025-01-15T10:00:00Z::DHZ"` |
| `H` | time | `time` | `"10:30:00::H"` |

> **Note**: `DH` is deprecated but still accepted for backward compatibility.

### Receive-only types

These are decoded but never encoded (they are native JSON types in Python):

| Code | Python Type |
|------|-------------|
| `L` | `int` |
| `R` | `float` |
| `B` | `bool` |
| `T` | `str` |

### XML (all types)

In XML, all values are strings, so all types are encoded with inline suffixes:

| Code | Python Type | Example |
|------|-------------|---------|
| `N` | `Decimal` | `<price>100.50::N</price>` |
| `D` | `date` | `<d>2025-01-15::D</d>` |
| `DHZ` | `datetime` | `<dt>2025-01-15T10:30:00.000Z::DHZ</dt>` |
| `H` | `time` | `<t>10:30:00::H</t>` |
| `B` | `bool` | `<flag>1::B</flag>` |
| `L` | `int` | `<count>42::L</count>` |

## Nested Structures

TYTX Base handles nested dicts and lists:

```python
from decimal import Decimal
from datetime import date
from genro_tytx import to_typed_text, from_text

invoice = {
    "invoice": {
        "total": Decimal("999.99"),
        "date": date(2025, 1, 15),
        "items": [
            {"price": Decimal("100.00"), "qty": 2},
            {"price": Decimal("200.00"), "qty": 1},
        ],
    }
}

encoded = to_typed_text(invoice)
decoded = from_text(encoded)

assert decoded == invoice  # ✓ Perfect roundtrip
```

## Next Steps

- See [Installation](installation.md) for optional dependencies
- Check TYTX (full) for advanced features like typed arrays, custom types, and struct schemas

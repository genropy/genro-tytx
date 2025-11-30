# TYTX Protocol Specification (Typed Text)

**Status**: Draft
**Version**: 1.0

## 1. Overview

TYTX (Typed Text) is a protocol for exchanging typed data structures between Server and Client (Browser/API) using standard text-based formats like JSON, XML, and MessagePack.

It solves the "stringly typed" problem of JSON (which only supports string, number, bool, null) by encoding type information directly into the value string using a concise syntax.

### Key Goals

- **Rich Types**: Support Decimal, Date, DateTime, Table, and custom types over JSON/XML/MessagePack.
- **Boundary Serialization**: Use ONLY at the edges (Input/Output). Internally, use native Python/JS objects.
- **Pluggability**: Allow defining new types with custom parsers/serializers.
- **Framework Agnostic**: Core logic resides in `genro-tytx`, usable by any Python/JavaScript project.
- **Format Agnostic**: Works with JSON, XML, MessagePack, and other text/binary formats.

---

## 2. The Protocol Syntax

The core syntax is `value::type_code`.

- `value`: The string representation of the data.
- `::`: The separator (two colons).
- `type_code`: A short code (e.g., `L`, `D`, `DHZ`) or type name (e.g., `int`, `decimal`) identifying the type.

### Examples

| Native Type | Serialized (TYTX) | Description |
|-------------|-------------------|-------------|
| `int` | `"123::I"` | Integer |
| `Decimal` | `"100.50::D"` | Exact decimal (money) |
| `datetime` | `"2023-10-27T10:00::dt"` | ISO DateTime |
| `date` | `"2023-10-27::d"` | ISO Date |
| `bool` | `"true::B"` | Boolean |
| `list` | `"a,b,c::L"` | Simple comma-separated list |

If a value does not contain `::`, it is treated as a standard string (or native JSON type if already parsed).

### Global Marker

For entire payloads containing TYTX values, append `::TYTX`:

```
{"price": "100::D", "date": "2025-01-15::d"}::TYTX
```

The `::TYTX` suffix indicates the payload contains typed values that need hydration. The format (JSON, XML, etc.) is auto-detected from the content.

---

## 3. Type Codes Registry

### Built-in Type Codes

| Code | Name | Python Type | JavaScript Type | Description |
|------|------|-------------|-----------------|-------------|
| `L` | integer | `int` | `number` | Integer |
| `R` | float | `float` | `number` | Float |
| `N` | decimal | `Decimal` | `number` / `Big` | Exact decimal |
| `B` | bool | `bool` | `boolean` | Boolean |
| `T` | str | `str` | `string` | String/Text |
| `D` | date | `date` | `Date` | ISO Date |
| `DHZ` | datetime | `datetime` | `Date` | ISO DateTime (timezone-aware) |
| `DH` | naive_datetime | `datetime` | `Date` | ISO DateTime (naive, deprecated) |
| `H` | time | `time` | `Date` | ISO Time |
| `JS` | json | `dict`/`list` | `object`/`array` | JSON structure |

### Custom Types

Custom types can be registered with the registry:

```python
@registry.register("MyType", "MT")
class MyTypeHandler:
    python_type = MyType

    @staticmethod
    def parse(value: str) -> MyType:
        return MyType.from_string(value)

    @staticmethod
    def serialize(obj: MyType) -> str:
        return obj.to_string()
```

---

## 4. Architecture & Implementation

### 4.1 Core Logic (`genro-tytx`)

The reference implementation resides in `genro-tytx` (Python) and `genro-tytx` (npm).

- **Registry**: Manages registered types.
- **Hydrate**: Converts TYTX strings into native objects.
- **Serialize**: Converts native objects into TYTX strings.

### 4.2 Python Implementation

```python
from genro_tytx import hydrate, serialize

# Hydrate
data = hydrate({"price": "100.50::D", "date": "2025-01-15::d"})
# {"price": Decimal("100.50"), "date": date(2025, 1, 15)}

# Serialize
result = serialize({"price": Decimal("100.50"), "date": date(2025, 1, 15)})
# {"price": "100.50::D", "date": "2025-01-15::d"}
```

### 4.3 JavaScript Implementation

```typescript
import { hydrate, serialize } from 'genro-tytx';

// Hydrate
const data = hydrate({ price: "100.50::D", date: "2025-01-15::d" });
// { price: Decimal("100.50"), date: Date("2025-01-15") }

// Serialize
const result = serialize({ price: new Decimal("100.50"), date: new Date("2025-01-15") });
// { price: "100.50::D", date: "2025-01-15::d" }
```

### 4.4 ASGI Integration (`genro-asgi`)

The protocol integrates with the web framework layer:

#### Input (Request)

- **Query Parameters**: Middleware or Request helper to automatically hydrate query parameters.
  - `GET /api/items?price=100::D` -> `request.query_params["price"]` is `Decimal("100")`.
- **JSON Body**: `receive_typed()` method that walks the received JSON and hydrates types.

#### Output (Response)

- **Serialization**: `send_typed()` method that serializes Python objects with TYTX encoding.
  - Example: `await ws.send_typed({"price": Decimal("10.5")})` sends `{"price": "10.5::D"}::TYTX`.

---

## 5. Encoders & Decoders

### 5.1 JSON

- **Encoder**: Custom `json.JSONEncoder` that serializes registered types.
- **Decoder**: `json.JSONDecoder` hook that scans strings for `::` and calls hydrate.

```python
import json
from genro_tytx.encoders import TYTXEncoder, tytx_decoder

# Encode
json.dumps(data, cls=TYTXEncoder)

# Decode
json.loads(text, object_hook=tytx_decoder)
```

### 5.2 XML

- **Attributes**: XML attributes are always strings. TYTX fits perfectly.
  - `<item price="100::D" />`
- **Content**: Typed content.
  - `<value>100::D</value>`
- **Schema**: XSD is not required; type is self-contained in the value.

```python
from genro_tytx.encoders import encode_xml, decode_xml

# Encode
xml = encode_xml({"price": Decimal("100.50")})
# <root><price>100.50::D</price></root>

# Decode
data = decode_xml(xml)
# {"price": Decimal("100.50")}
```

### 5.3 MessagePack

MessagePack uses Extension Types. TYTX reserves ExtType code **42**.

```python
import msgpack
from genro_tytx.encoders import msgpack_encode, msgpack_decode

# Encode - wraps typed payloads in ExtType(42)
packed = msgpack.packb(data, default=msgpack_encode)

# Decode - unwraps ExtType(42) and hydrates
unpacked = msgpack.unpackb(packed, ext_hook=msgpack_decode)
```

The content inside ExtType(42) is always a TYTX-encoded string (same format as JSON/XML).

---

## 6. Extended Types: Table

A special `Table` type (`::T` or `::table`) transports tabular data efficiently.

### Structure (JSON)

```json
{
  "title": "My Table",
  "headers": [
    {"name": "ID", "type": "int", "align": "right"},
    {"name": "Name", "type": "str", "align": "left"},
    {"name": "Price", "type": "decimal", "format": "%.2f"}
  ],
  "rows": [
    ["1", "Item A", "10.50"],
    ["2", "Item B", "20.00"]
  ]
}
```

### Serialization

The entire JSON object is serialized into a string with `::T` suffix:

```
"{\"title\":\"My Table\",...}::T"
```

### Parsing

The parser reads the JSON and constructs a `Table` object where columns are typed according to `headers[i].type`.

---

## 7. Pydantic Integration

Pydantic is a validation library; TYTX is a transport protocol. They are complementary.

- **Validation**: Pydantic models define fields with target Python types (`price: Decimal`).
- **Flow**:
  1. **Transport**: JSON arrives with `"100::D"`.
  2. **Hydration**: TYTX middleware converts `"100::D"` -> `Decimal("100")`.
  3. **Validation**: Pydantic receives `Decimal("100")` and validates.

**Recommendation**: Let the TYTX layer handle hydration *before* Pydantic sees the data. This keeps Pydantic models clean and standard.

---

## 8. Security Considerations

- **Type Codes**: Only registered type codes are processed. Unknown codes are treated as plain strings.
- **Validation**: TYTX only handles type conversion; validation is the application's responsibility.
- **Injection**: The `::` separator in user input is safe; it only triggers type conversion for valid codes.

---

## 9. Versioning

The protocol version is embedded in implementations but not in the wire format. Breaking changes increment the major version.

Current version: **1.0**

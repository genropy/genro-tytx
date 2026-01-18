# TYTX Protocol Specification v0.7.0

**TYTX** (Typed Text) is a protocol for transmitting typed scalar values over text-based formats (JSON, XML) and binary formats (MessagePack).

## 1. Core Concept

TYTX extends JSON/XML by adding type suffixes to string values that represent non-native types. The suffix format is:

```
value::SUFFIX
```

Where `SUFFIX` is a 1-3 character type code.

## 2. Type Codes

### 2.1 Non-Native Types (JSON)

These types are NOT native to JSON and MUST be encoded with type suffixes:

| Suffix | Type | Format | Example |
|--------|------|--------|---------|
| `N` | Decimal | Arbitrary precision number as string | `"100.50::N"` |
| `D` | Date | ISO 8601 date (YYYY-MM-DD) | `"2025-01-15::D"` |
| `DHZ` | DateTime | ISO 8601 datetime with milliseconds and Z suffix | `"2025-01-15T10:30:00.000Z::DHZ"` |
| `H` | Time | ISO 8601 time with milliseconds (HH:MM:SS.sss) | `"10:30:00.000::H"` |

### 2.2 Native Types (for XML and interop)

These types ARE native to JSON but need encoding in XML (where everything is string):

| Suffix | Type | Format | Example |
|--------|------|--------|---------|
| `L` | Integer (Long) | Decimal integer string | `"42::L"` |
| `R` | Real (Float) | Decimal floating point string | `"3.14159::R"` |
| `B` | Boolean | "true" for true, "false" for false | `"true::B"` |
| `T` | Text | Plain string (rarely used) | `"hello::T"` |
| `NN` | None/Null | Explicit null value | `"::NN"` |

### 2.3 Structure Types

These suffixes indicate structured data formats:

| Suffix | Type           | Format                  | Example                               |
|--------|----------------|-------------------------|---------------------------------------|
| `JS`   | JSON Structure | JSON with typed values  | `{"price": "100::N"}::JS`             |
| `QS`   | Query String   | Key=value pairs or list | `alfa=33::L&date=2025-01-15::D::QS`   |

### 2.4 Deprecated Suffixes

| Suffix | Replacement | Notes |
|--------|-------------|-------|
| `DH` | `DHZ` | Still accepted on decode, never emitted |

## 3. JSON Format

### 3.1 Structure Marker

When encoding a dict or list containing typed values, the entire JSON string is suffixed with `::JS`:

```
{"price": "100.50::N", "date": "2025-01-15::D"}::JS
```

The `::JS` marker indicates:
- The JSON contains typed values that need hydration
- Decoders MUST recursively process all string values looking for type suffixes

### 3.2 Scalar Values

When encoding a single typed value (not wrapped in dict/list), NO `::JS` suffix is added:

```
"2025-01-15::D"
```

### 3.3 Encoding Rules

1. **Typed scalars at root**: Return `"value::SUFFIX"` (no `::JS`)
2. **Dict/List with typed values**: Return `{...}::JS` or `[...]::JS`
3. **Dict/List without typed values**: Return plain JSON (no suffix)
4. **Native JSON types** (bool, int, float, str, null): Pass through unchanged

### 3.4 Decoding Rules

1. Check if string ends with a valid type suffix (`::N`, `::D`, `::DHZ`, `::H`, `::JS`, etc.)
2. If ends with `::JS`:
   - Remove the `::JS` suffix
   - Parse as JSON
   - Recursively hydrate all string values containing `::`
3. If ends with a scalar type suffix (`::N`, `::D`, etc.):
   - Parse as JSON (result is a string like `"2025-01-15::D"`)
   - Hydrate the string value
4. If no valid type suffix: Parse as plain JSON

### 3.5 Hydration Algorithm

For each string value in the parsed JSON:

```
function hydrate(value):
    if value is not string:
        if value is dict:
            return {k: hydrate(v) for k, v in value}
        if value is list:
            return [hydrate(item) for item in value]
        return value

    if "::" not in value:
        return value

    idx = value.rfind("::")
    raw_value = value[:idx]
    suffix = value[idx+2:]

    if suffix not in KNOWN_SUFFIXES:
        return value  # Unknown suffix, return as-is

    return deserialize(raw_value, suffix)
```

## 4. XML Format

### 4.1 Data Structure Convention

Each XML element maps to a dictionary with two keys:

```python
{
  "tag": {
    "attrs": {...},   # dict of attributes (hydrated)
    "value": ...      # scalar, dict of children, list, or None
  }
}
```

### 4.2 Value Types

- **Scalar**: string, int, Decimal, date, etc. (from text content)
- **Dict**: children elements `{"child_tag": {"attrs": ..., "value": ...}}`
- **List**: repeated elements with same tag
- **None**: empty element with no text content

### 4.3 Type Suffixes in XML

Type suffixes are used in both text content AND attributes:

```xml
<order id="123::L" created="2025-01-15::D">
  <item name="Widget" price="10.50::N" />
  <item name="Gadget" price="25.00::N" />
  <total>35.50::N</total>
</order>
```

### 4.4 Encoding Rules

1. Input MUST be a dict with a single root element
2. Root element value MUST have `attrs` and `value` keys
3. Attributes are serialized with type suffixes (strings without suffix)
4. Text content is serialized with type suffixes
5. Lists of elements are serialized as repeated tags

### 4.5 Decoding Rules

1. Parse XML normally
2. For each element, create `{"attrs": {...}, "value": ...}`
3. Hydrate attributes: parse type suffixes (e.g., `"123::L"` → `123`)
4. Parse children or text content for value
5. Repeated tags become lists

### 4.6 Empty Elements

Empty elements (no text, no children) have `value: None`:

```xml
<item name="Widget" />
```

```python
{"item": {"attrs": {"name": "Widget"}, "value": None}}
```

### 4.7 Encoding Example

```python
data = {
  "order": {
    "attrs": {"id": 123, "created": date(2025, 1, 15)},
    "value": {
      "item": [
        {"attrs": {"name": "Widget", "price": Decimal("10.50")}, "value": None},
        {"attrs": {"name": "Gadget", "price": Decimal("25.00")}, "value": None}
      ],
      "total": {"attrs": {}, "value": Decimal("35.50")}
    }
  }
}

xml_string = to_xml(data)
```

Output:

```xml
<order id="123::L" created="2025-01-15::D">
  <item name="Widget" price="10.50::N" />
  <item name="Gadget" price="25.00::N" />
  <total>35.50::N</total>
</order>
```

### 4.8 Decoding Example

Input XML:

```xml
<order id="123::L" created="2025-01-15::D">
  <item name="Widget" price="10.50::N" />
  <item name="Gadget" price="25.00::N" />
  <total>35.50::N</total>
</order>
```

Output dict:

```python
{
  "order": {
    "attrs": {
      "id": 123,
      "created": date(2025, 1, 15)
    },
    "value": {
      "item": [
        {"attrs": {"name": "Widget", "price": Decimal("10.50")}, "value": None},
        {"attrs": {"name": "Gadget", "price": Decimal("25.00")}, "value": None}
      ],
      "total": {"attrs": {}, "value": Decimal("35.50")}
    }
  }
}
```

## 5. Query String Format (QS)

### 5.1 Overview

The QS format provides a compact representation for flat data structures in URL query strings. It supports two modes:

- **Object mode**: Key=value pairs for flat dictionaries
- **Array mode**: Values without `=` for lists

### 5.2 Object Mode

When encoding a flat dictionary, each key-value pair is serialized with TYTX type suffixes:

```
alfa=33::L&date=2025-01-15::D&price=100.50::N::QS
```

Decodes to:

```python
{"alfa": 33, "date": date(2025, 1, 15), "price": Decimal("100.50")}
```

### 5.3 Array Mode

When encoding a list of strings, values are joined with `&`:

```
alfa&beta&gamma::QS
```

Decodes to:

```python
["alfa", "beta", "gamma"]
```

### 5.4 Mixed Mode Error

Mixing items with and without `=` is not allowed:

```
alfa&beta=2::QS  # ERROR: mixed items
```

For complex structures, use `::JS` embedded in the query string.

### 5.5 Encoding

```python
# Python
to_tytx({"alfa": 33, "date": date(2025, 1, 15)}, qs=True)
# 'alfa=33::L&date=2025-01-15::D::QS'

to_tytx(["alfa", "beta", "gamma"], qs=True)
# 'alfa&beta&gamma::QS'
```

```javascript
// JavaScript
toTytx({alfa: 33, date: new Date(Date.UTC(2025, 0, 15))}, null, {qs: true});
// 'alfa=33::L&date=2025-01-15::D::QS'
```

### 5.6 Decoding

The `::QS` suffix is automatically detected by `from_tytx`:

```python
from_tytx("alfa=33::L&date=2025-01-15::D::QS")
# {"alfa": 33, "date": date(2025, 1, 15)}
```

## 6. MessagePack Format

### 6.1 Encoding

Typed values are serialized as strings with type suffix (same as JSON inner values):

```
Decimal("100.50") -> "100.50::N"
date(2025, 1, 15) -> "2025-01-15::D"
```

### 5.2 Decoding

After MessagePack unpacking, recursively hydrate all string values using the same algorithm as JSON.

## 6. Value Serialization

### 6.1 Decimal (N)

- Serialize: `str(value)` - Preserve full precision
- Example: `Decimal("100.50")` -> `"100.50"`
- Example: `Decimal("1E+10")` -> `"1E+10"`

### 6.2 Date (D)

- Serialize: ISO 8601 date format `YYYY-MM-DD`
- Example: `date(2025, 1, 15)` -> `"2025-01-15"`

### 6.3 DateTime (DHZ)

**IMPORTANT**: TYTX always serializes datetime as DHZ (UTC) for cross-language compatibility.

#### Precision

- **Encoding**: Millisecond precision (3 decimal places)
- **Format**: `YYYY-MM-DDTHH:MM:SS.sssZ::DHZ`
- **Example**: `datetime(2025, 1, 15, 10, 30, 45, 123456)` → `"2025-01-15T10:30:45.123Z::DHZ"`

**Note**: Microseconds are truncated to milliseconds during encoding. This ensures cross-language compatibility since JavaScript `Date` has millisecond precision.

#### The Problem

Python distinguishes between:
- **Naive datetime**: `datetime(2025, 1, 15, 10, 30)` - no timezone information
- **Aware datetime**: `datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)` - with timezone

JavaScript `Date` is **always internally UTC**. When JS receives a datetime string without a `Z` suffix, it interprets it as **local time** and converts to UTC based on the system's timezone. This breaks cross-language roundtrips.

#### The Solution

- **Serialization**: Always `DHZ` (UTC) with millisecond precision, even for Python naive datetimes
- **Naive datetime**: Use `isoformat(timespec="milliseconds")` + `Z`
- **Aware datetime**: Convert to UTC, use `isoformat(timespec="milliseconds")`
- **Deserialization**: Returns aware datetime with UTC timezone (accepts both 3 and 6 decimal places)

#### Roundtrip Equality

When comparing values in roundtrip tests, these are considered **semantically equivalent**:

| Original (Python) | After Roundtrip |
|-------------------|-----------------|
| `datetime(2025, 1, 15, 10, 30)` (naive) | `datetime(2025, 1, 15, 10, 30, tzinfo=UTC)` (aware) |

They represent the same instant in time (assuming naive datetime was implicitly UTC).

#### Language Support

| Language | Supports Naive | Notes |
|----------|----------------|-------|
| Python | ✅ Yes | `datetime` without `tzinfo` |
| JavaScript | ❌ No | `Date` is always UTC internally |
| TypeScript | ❌ No | Same as JavaScript |
| Rust | ❌ No | `chrono::DateTime<Utc>` requires timezone |

Since JavaScript is the most common target for TYTX (browsers, Node.js), the protocol defaults to UTC-safe serialization.

#### Backward Compatibility

The `::DH` type code is still supported in **deserialization** for backward compatibility with existing data. However, it is **never used in serialization**.

### 6.4 Time (H)

- Serialize: ISO 8601 time format `HH:MM:SS.sss` (millisecond precision)
- Example: `time(10, 30, 0)` -> `"10:30:00.000"`
- Example: `time(10, 30, 0, 123000)` -> `"10:30:00.123"`

### 6.5 Boolean (B)

- Serialize: `"true"` for true, `"false"` for false
- Deserialize: `"true"` -> true, `"false"` -> false

### 6.6 Integer (L)

- Serialize: Decimal string representation
- Example: `42` -> `"42"`
- Example: `-1000000` -> `"-1000000"`

### 6.7 Float (R)

- Serialize: String representation
- Example: `3.14159` -> `"3.14159"`

## 7. API Functions

### 7.1 Core API

| Function | Input | Output | Notes |
|----------|-------|--------|-------|
| `to_tytx(value, transport=None)` | Any value | Encoded data | Default: JSON string |
| `from_tytx(data, transport=None)` | Encoded data | Native value | Auto-detect or specify |

### 7.2 Transport Parameter

| Transport | Encode Output | Decode Input |
|-----------|--------------|--------------|
| `None` (default) | JSON string with `::JS` | JSON string |
| `"json"` | JSON string with `::JS` | JSON string |
| `"xml"` | XML string | XML string |
| `"msgpack"` | bytes | bytes |

**XML Input/Output:**
- Input: Dict with `{"tag": {"attrs": {}, "value": ...}}`
- Output: Same structure

### 7.3 HTTP Utilities (language-specific)

**Python:**

| Function | Description |
|----------|-------------|
| `asgi_data(scope, receive)` | Extract TYTX data from ASGI request |
| `wsgi_data(environ)` | Extract TYTX data from WSGI request |

**JavaScript:**

| Function | Description |
|----------|-------------|
| `fetchTytx(url, options)` | Fetch wrapper with TYTX encoding/decoding |
| `getTransport(contentType)` | Detect transport from Content-Type header |

## 8. Examples

### 8.1 JSON Encoding Examples

```python
# Dict with typed values
to_tytx({"price": Decimal("100.50")})
# '{"price": "100.50::N"}::JS'

# Scalar typed value
to_tytx(date(2025, 1, 15))
# '"2025-01-15::D"'

# Dict without typed values
to_tytx({"name": "test", "count": 42})
# '{"name": "test", "count": 42}'

# Nested structure
to_tytx({
    "invoice": {
        "total": Decimal("999.99"),
        "items": [
            {"price": Decimal("100.00")},
            {"price": Decimal("200.00")}
        ]
    }
})
# '{"invoice": {"total": "999.99::N", "items": [{"price": "100.00::N"}, {"price": "200.00::N"}]}}::JS'
```

### 8.2 JSON Decoding Examples

```python
# Dict with typed values
from_tytx('{"price": "100.50::N"}::JS')
# {"price": Decimal("100.50")}

# Scalar typed value
from_tytx('"2025-01-15::D"')
# date(2025, 1, 15)

# Plain JSON (no typed values)
from_tytx('{"name": "test"}')
# {"name": "test"}
```

### 8.3 XML Examples

```python
# Encoding
to_xml({
    "order": {
        "attrs": {"id": 123},
        "value": {
            "total": {"attrs": {}, "value": Decimal("100.50")}
        }
    }
})
# '<order id="123::L"><total>100.50::N</total></order>'

# Decoding
from_xml('<order id="123::L"><total>100.50::N</total></order>')
# {
#     "order": {
#         "attrs": {"id": 123},
#         "value": {"total": {"attrs": {}, "value": Decimal("100.50")}}
#     }
# }
```

## 9. Implementation Notes

### 9.1 Suffix Detection

When checking for type suffix:
1. Find the LAST occurrence of `::`
2. Extract the suffix after `::`
3. Check if suffix is in the known suffix registry
4. If unknown suffix, treat as plain string

### 9.2 Escaping

Strings containing `::` followed by a valid type code will be incorrectly interpreted as typed values. This is by design - such strings should be rare in practice.

### 9.3 Null Values

- JSON `null` passes through unchanged
- No TYTX encoding for null

### 9.4 Empty Values

- Empty string `""` passes through unchanged
- Empty dict `{}` and empty list `[]` pass through unchanged

### 9.5 DateTime Roundtrip

Due to the UTC normalization and millisecond precision, datetime roundtrips may change:

1. **Timezone representation**: Naive → Aware (UTC)
2. **Microsecond precision**: Truncated to milliseconds

```python
# Input (naive with microseconds)
original = datetime(2025, 1, 15, 10, 30, 45, 123456)

# After roundtrip (aware UTC, milliseconds only)
result = datetime(2025, 1, 15, 10, 30, 45, 123000, tzinfo=timezone.utc)

# These are semantically equivalent (within millisecond precision)
# but not equal in Python: original != result
# Use timestamp comparison with millisecond tolerance:
# abs(original.timestamp() - result.timestamp()) < 0.001
```

### 9.6 HTTP Transport

When transmitting TYTX payloads over HTTP, the Content-Type header identifies the protocol.

#### MIME Types

| Format | Standard MIME | TYTX MIME |
|--------|---------------|-----------|
| JSON | `application/json` | `application/vnd.tytx+json` |
| XML | `application/xml` | `application/vnd.tytx+xml` |
| MessagePack | `application/msgpack` | `application/vnd.tytx+msgpack` |

#### Example HTTP Request

```http
POST /api/invoice HTTP/1.1
Content-Type: application/vnd.tytx+json
Accept: application/vnd.tytx+json

{"total": "999.99::N", "date": "2025-01-15::D"}::JS
```

Note: The body is valid JSON (parseable by standard parsers), but contains TYTX type suffixes that require hydration.

## 10. Version History

| Version | Changes |
|---------|---------|
| 0.7.0 | Scalar values without `::JS` suffix; MessagePack simplified; XML attrs/value structure |
| 0.6.x | Initial release with `::JS` for all typed outputs |

---

**Copyright 2025 Softwell S.r.l. - Apache License 2.0**

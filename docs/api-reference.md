# TYTX API Reference

Complete API reference for Python and JavaScript implementations.

---

## Python API

### Core Functions

#### `to_tytx(value, transport=None)`

Encode a Python value to TYTX format.

```python
from genro_tytx import to_tytx
from decimal import Decimal
from datetime import date

# Dict with typed values → JSON string with ::JS suffix
to_tytx({"price": Decimal("100.50")})
# '{"price": "100.50::N"}::JS'

# Scalar typed value → JSON string
to_tytx(date(2025, 1, 15))
# '"2025-01-15::D"'

# Plain dict (no typed values) → plain JSON
to_tytx({"name": "test", "count": 42})
# '{"name": "test", "count": 42}'
```

**Parameters:**

| Parameter   | Type         | Default    | Description                                                     |
|-------------|--------------|------------|-----------------------------------------------------------------|
| `value`     | Any          | required   | Value to encode                                                 |
| `transport` | str \| None  | `None`     | Transport format: `None`/`"json"`, `"xml"`, `"msgpack"`         |
| `raw`       | bool         | `False`    | If `True`, output raw format without TYTX type suffixes         |
| `qs`        | bool         | `False`    | If `True`, output as query string format (flat dict or list)    |

**Returns:** `str` for JSON/XML/QS, `bytes` for MessagePack

**Query String Example:**

```python
from genro_tytx import to_tytx
from datetime import date

# Flat dict → QS format
to_tytx({"alfa": 33, "date": date(2025, 1, 15)}, qs=True)
# 'alfa=33::L&date=2025-01-15::D::QS'

# List → QS format
to_tytx(["alfa", "beta", "gamma"], qs=True)
# 'alfa&beta&gamma::QS'
```

---

#### `from_tytx(data, transport=None)`

Decode TYTX data to Python values.

```python
from genro_tytx import from_tytx

# JSON with typed values
from_tytx('{"price": "100.50::N"}::JS')
# {"price": Decimal("100.50")}

# Scalar typed value
from_tytx('"2025-01-15::D"')
# date(2025, 1, 15)

# Plain JSON
from_tytx('{"name": "test"}')
# {"name": "test"}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | str \| bytes | required | Data to decode |
| `transport` | str \| None | `None` | Transport format (auto-detected if `None`) |

**Returns:** Decoded Python value with hydrated types

---

### HTTP Functions

#### `asgi_data(scope, receive)` (async)

Decode TYTX data from an ASGI request.

```python
from fastapi import FastAPI, Request
from genro_tytx import asgi_data

app = FastAPI()

@app.post("/api/order")
async def create_order(request: Request):
    data = await asgi_data(request.scope, request.receive)

    body = data["body"]       # Request body (dict)
    query = data["query"]     # Query parameters (dict)
    headers = data["headers"] # HTTP headers (dict)
    cookies = data["cookies"] # Cookies (dict)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | dict | ASGI scope dict |
| `receive` | Callable | ASGI receive callable |

**Returns:** `dict` with keys `query`, `headers`, `cookies`, `body`

---

#### `wsgi_data(environ)`

Decode TYTX data from a WSGI request.

```python
from flask import Flask, request
from genro_tytx import wsgi_data

app = Flask(__name__)

@app.route("/api/order", methods=["POST"])
def create_order():
    data = wsgi_data(request.environ)

    body = data["body"]
    query = data["query"]
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `environ` | dict | WSGI environ dict |

**Returns:** `dict` with keys `query`, `headers`, `cookies`, `body`

---

### XML Functions

#### `to_xml(value)`

Encode a dict to XML with TYTX type suffixes.

```python
from genro_tytx import to_xml
from decimal import Decimal

data = {
    "order": {
        "attrs": {"id": 123},
        "value": {
            "total": {"attrs": {}, "value": Decimal("100.50")}
        }
    }
}

to_xml(data)
# '<order id="123::L"><total>100.50::N</total></order>'
```

**Input Structure:**

```python
{
    "tag_name": {
        "attrs": {"attr1": value1, ...},  # Attributes
        "value": ...  # Scalar, dict of children, list, or None
    }
}
```

---

#### `from_xml(data)`

Decode XML with TYTX type suffixes.

```python
from genro_tytx import from_xml

from_xml('<order id="123::L"><total>100.50::N</total></order>')
# {
#     "order": {
#         "attrs": {"id": 123},
#         "value": {"total": {"attrs": {}, "value": Decimal("100.50")}}
#     }
# }
```

---

### MessagePack Functions

#### `to_msgpack(value)`

Encode a value to MessagePack binary format.

```python
from genro_tytx import to_msgpack
from decimal import Decimal

packed = to_msgpack({"price": Decimal("100.50")})
# bytes
```

> Requires `pip install genro-tytx[msgpack]`

---

#### `from_msgpack(data)`

Decode MessagePack binary data.

```python
from genro_tytx import from_msgpack

unpacked = from_msgpack(packed)
# {"price": Decimal("100.50")}
```

---

## JavaScript API

### Core Functions

#### `toTytx(value, transport='json')`

Encode a JavaScript value to TYTX format.

```javascript
import { toTytx } from 'genro-tytx';
import Big from 'big.js';

// Object with typed values
toTytx({ price: new Big('100.50') });
// '{"price":"100.50::N"}::JS'

// Scalar typed value
toTytx(new Date(Date.UTC(2025, 0, 15)));
// '"2025-01-15::D"'
```

**Parameters:**

| Parameter     | Type    | Default    | Description                                              |
|---------------|---------|------------|----------------------------------------------------------|
| `value`       | any     | required   | Value to encode                                          |
| `transport`   | string  | `null`     | Transport: `null`/`'json'`, `'xml'`, `'msgpack'`         |
| `options.raw` | boolean | `false`    | If `true`, output raw format without TYTX type suffixes  |
| `options.qs`  | boolean | `false`    | If `true`, output as query string format                 |

**Returns:** `string` for JSON/XML/QS, `Uint8Array` for MessagePack

**Query String Example:**

```javascript
import { toTytx } from 'genro-tytx';

// Flat object → QS format
toTytx({alfa: 33, date: new Date(Date.UTC(2025, 0, 15))}, null, {qs: true});
// 'alfa=33::L&date=2025-01-15::D::QS'

// Array → QS format
toTytx(['alfa', 'beta', 'gamma'], null, {qs: true});
// 'alfa&beta&gamma::QS'
```

---

#### `fromTytx(data, transport='json')`

Decode TYTX data to JavaScript values.

```javascript
import { fromTytx } from 'genro-tytx';

// JSON with typed values
fromTytx('{"price":"100.50::N"}::JS');
// { price: Decimal("100.50") }

// Scalar typed value
fromTytx('"2025-01-15::D"');
// Date object
```

---

### HTTP Functions

#### `fetchTytx(url, options)`

Fetch wrapper with automatic TYTX encoding/decoding.

```javascript
import { fetchTytx } from 'genro-tytx';
import Big from 'big.js';

const result = await fetchTytx('/api/order', {
    method: 'POST',
    body: {
        price: new Big('100.50'),
        date: new Date(Date.UTC(2025, 0, 15)),
    },
    headers: {
        'Authorization': 'Bearer token',
    },
});

// result is already decoded
console.log(result.total.toFixed(2));
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `body` | any | - | Request body (will be encoded) |
| `transport` | string | `'json'` | Transport format |
| `method` | string | `'GET'` or `'POST'` | HTTP method (auto-detected if body present) |
| `headers` | object | `{}` | Additional headers |

**Returns:** `Promise<any>` - Decoded response body

---

#### `getTransport(contentType)`

Detect transport format from Content-Type header.

```javascript
import { getTransport } from 'genro-tytx';

getTransport('application/json');           // 'json'
getTransport('application/vnd.tytx+json');  // 'json'
getTransport('application/xml');            // 'xml'
getTransport('application/msgpack');        // 'msgpack'
```

---

## Type Suffixes

| Suffix | Type | Python | JavaScript | Example |
|--------|------|--------|------------|---------|
| `N` | Decimal | `Decimal` | `Decimal` (big.js) | `"99.99::N"` |
| `D` | Date | `date` | `Date` (midnight UTC) | `"2025-01-15::D"` |
| `DHZ` | DateTime | `datetime` | `Date` | `"2025-01-15T10:30:00.000Z::DHZ"` |
| `H` | Time | `time` | `Date` (epoch) | `"10:30:00.000::H"` |
| `L` | Integer | `int` | `number` | `"42::L"` |
| `R` | Float | `float` | `number` | `"3.14::R"` |
| `B` | Boolean | `bool` | `boolean` | `"true::B"` |
| `T` | Text | `str` | `string` | `"hello::T"` |
| `JS` | JSON Structure | `dict`/`list` | `object`/`array` | `{"a":1}::JS` |
| `QS` | Query String | `dict`/`list` | `object`/`array` | `a=1::L&b=2::L::QS` |

**Notes:**
- `L`, `R`, `B`, `T` are mainly used for XML (where all values are strings)
- In JSON, native types pass through unchanged
- `DH` is deprecated, use `DHZ` instead (still accepted on decode)
- `QS` is used for URL query string encoding via `to_tytx(..., qs=True)`

---

## Constants

### JavaScript: `CONTENT_TYPES`

```javascript
import { CONTENT_TYPES } from 'genro-tytx';

CONTENT_TYPES.json;     // 'application/json'
CONTENT_TYPES.xml;      // 'application/xml'
CONTENT_TYPES.msgpack;  // 'application/msgpack'
```

---

## Framework Examples

### FastAPI

```python
from fastapi import FastAPI, Request, Response
from genro_tytx import asgi_data, to_tytx
from decimal import Decimal

app = FastAPI()

@app.post("/api/order")
async def create_order(request: Request):
    data = await asgi_data(request.scope, request.receive)
    body = data["body"]

    result = {"total": body["price"] * body["quantity"]}

    return Response(
        content=to_tytx(result),
        media_type="application/vnd.tytx+json"
    )
```

### Flask

```python
from flask import Flask, request
from genro_tytx import wsgi_data, to_tytx

app = Flask(__name__)

@app.route("/api/order", methods=["POST"])
def create_order():
    data = wsgi_data(request.environ)
    body = data["body"]

    result = {"total": body["price"] * body["quantity"]}

    response = app.response_class(
        response=to_tytx(result),
        mimetype="application/vnd.tytx+json"
    )
    return response
```

### Starlette

```python
from starlette.applications import Starlette
from starlette.responses import Response
from starlette.routing import Route
from genro_tytx import asgi_data, to_tytx

async def create_order(request):
    data = await asgi_data(request.scope, request.receive)
    result = {"total": data["body"]["price"]}
    return Response(
        content=to_tytx(result),
        media_type="application/vnd.tytx+json"
    )

app = Starlette(routes=[Route("/api/order", create_order, methods=["POST"])])
```

---

## Wire Format Examples

### Query String

```
# Native values (no encoding)
?name=John&limit=10

# Typed values
?date=2025-01-15::D&price=100.50::N&active=true::B
```

### Body (JSON)

```text
{"price":"100.50::N","date":"2025-01-15::D","active":true}::JS
```

### Response

```
HTTP/1.1 200 OK
Content-Type: application/vnd.tytx+json

{"total":"122.61::N","created_at":"2025-01-15T10:30:00.000Z::DHZ"}::JS
```

# TYTX Middleware API Specification

API specification for ASGI/WSGI middleware and JS/TS `tytx_fetch`.

## Python Middleware

### ASGI Middleware

```python
from genro_tytx.middleware import TYTXMiddleware

app = TYTXMiddleware(your_app)
```

#### Class: `TYTXMiddleware`

ASGI middleware that automatically decodes TYTX-encoded requests and encodes responses.

**Constructor:**

```python
TYTXMiddleware(
    app: ASGIApp,
    decode_query: bool = True,
    decode_headers: bool = True,
    decode_cookies: bool = True,
    decode_body: bool = True,
    encode_response: bool = True,
    header_prefix: str = "x-tytx-",
)
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `app` | ASGIApp | required | The ASGI application to wrap |
| `decode_query` | bool | `True` | Decode TYTX values in query string |
| `decode_headers` | bool | `True` | Decode TYTX values in headers with prefix |
| `decode_cookies` | bool | `True` | Decode TYTX values in cookies |
| `decode_body` | bool | `True` | Decode TYTX JSON body |
| `encode_response` | bool | `True` | Encode response body with TYTX |
| `header_prefix` | str | `"x-tytx-"` | Prefix for typed headers |

**Request Modification:**

The middleware adds a `tytx` attribute to the ASGI scope with decoded values:

```python
scope["tytx"] = {
    "query": {"date": date(2025, 1, 15), ...},
    "headers": {"timestamp": time(10, 30), ...},
    "cookies": {"session_start": datetime(...), ...},
    "body": {"price": Decimal("100.50"), ...},
}
```

**Response Handling:**

If the response Content-Type is `application/json` and `encode_response=True`:
- Response body is encoded with TYTX
- Content-Type is changed to `application/vnd.tytx+json`

### WSGI Middleware

```python
from genro_tytx.middleware import TYTXWSGIMiddleware

app = TYTXWSGIMiddleware(your_app)
```

#### Class: `TYTXWSGIMiddleware`

WSGI middleware with same parameters as ASGI version.

**Constructor:**

```python
TYTXWSGIMiddleware(
    app: WSGIApp,
    decode_query: bool = True,
    decode_headers: bool = True,
    decode_cookies: bool = True,
    decode_body: bool = True,
    encode_response: bool = True,
    header_prefix: str = "x-tytx-",
)
```

**Request Modification:**

Adds `tytx` key to `environ`:

```python
environ["tytx"] = {
    "query": {...},
    "headers": {...},
    "cookies": {...},
    "body": {...},
}
```

### Helper Functions

#### `decode_query_string(query_string: str) -> dict[str, Any]`

Decode a URL query string with TYTX values.

```python
from genro_tytx.middleware import decode_query_string

params = decode_query_string("date=2025-01-15::D&limit=10")
# {"date": date(2025, 1, 15), "limit": "10"}
```

#### `encode_query_string(params: dict[str, Any]) -> str`

Encode a dict to URL query string with TYTX values.

```python
from genro_tytx.middleware import encode_query_string

qs = encode_query_string({"date": date(2025, 1, 15), "limit": 10})
# "date=2025-01-15::D&limit=10"
```

#### `decode_header_value(value: str) -> Any`

Decode a single header value with TYTX suffix.

```python
from genro_tytx.middleware import decode_header_value

ts = decode_header_value("10:30:00::H")
# time(10, 30, 0)
```

#### `encode_header_value(value: Any) -> str`

Encode a value for use in HTTP header.

```python
from genro_tytx.middleware import encode_header_value

hv = encode_header_value(time(10, 30))
# "10:30:00::H"
```

---

## JavaScript/TypeScript `tytx_fetch`

### Function: `tytx_fetch`

Drop-in replacement for `fetch()` with automatic TYTX encoding/decoding.

```typescript
import { tytx_fetch } from 'genro-tytx';

const result = await tytx_fetch('/api/invoice', {
    method: 'POST',
    query: { date: new Date('2025-01-15') },
    headers: { 'x-tytx-timestamp': createTime(10, 30) },
    body: { price: new Decimal('100.50') },
});
```

#### Signature

```typescript
function tytx_fetch<T = unknown>(
    url: string | URL,
    options?: TYTXFetchOptions
): Promise<T>;
```

#### Options: `TYTXFetchOptions`

Extends standard `RequestInit` with TYTX-specific options:

```typescript
interface TYTXFetchOptions extends Omit<RequestInit, 'body'> {
    /** Query parameters - typed values are encoded */
    query?: Record<string, unknown>;

    /** Request body - encoded as TYTX JSON */
    body?: unknown;

    /** Headers - values with x-tytx- prefix are encoded */
    headers?: Record<string, unknown>;

    /** Skip TYTX encoding for body */
    rawBody?: boolean;

    /** Skip TYTX decoding for response */
    rawResponse?: boolean;

    /** Header prefix for typed values (default: "x-tytx-") */
    headerPrefix?: string;
}
```

#### Behavior

**Request Encoding:**

1. **Query string**: Typed values in `query` are encoded with TYTX suffix
   ```
   { date: new Date('2025-01-15') } → ?date=2025-01-15::D
   ```

2. **Headers**: Values in headers starting with `headerPrefix` are encoded
   ```
   { 'x-tytx-timestamp': createTime(10, 30) } → x-tytx-timestamp: 10:30:00::H
   ```

3. **Body**: Encoded as TYTX JSON with `::JS` suffix
   ```
   { price: new Decimal('100.50') } → {"price":"100.50::N"}::JS
   ```

4. **Content-Type**: Automatically set to `application/vnd.tytx+json`

**Response Decoding:**

1. If response Content-Type contains `tytx` or `json`:
   - Body is decoded with `fromText()`
   - Typed values are hydrated to native types

2. If `rawResponse: true`:
   - Returns raw `Response` object

#### Return Value

Returns the decoded response body directly (not a `Response` object).

For access to response metadata, use `rawResponse: true`:

```typescript
const response = await tytx_fetch('/api', { rawResponse: true });
console.log(response.status);
const data = await response.json();
```

### Helper Functions

#### `createDate(year, month, day)`

Create a Date representing a date-only value (midnight UTC).

```typescript
const d = createDate(2025, 1, 15);
// Date at 2025-01-15T00:00:00.000Z
```

#### `createTime(hours, minutes, seconds?, milliseconds?)`

Create a Date representing a time-only value (epoch date).

```typescript
const t = createTime(10, 30, 0);
// Date at 1970-01-01T10:30:00.000Z
```

#### `createDateTime(year, month, day, hours, minutes, seconds?, milliseconds?)`

Create a full datetime.

```typescript
const dt = createDateTime(2025, 1, 15, 10, 30, 0);
// Date at 2025-01-15T10:30:00.000Z
```

#### `encodeQueryString(params)`

Encode an object to URL query string with TYTX values.

```typescript
const qs = encodeQueryString({ date: createDate(2025, 1, 15), limit: 10 });
// "date=2025-01-15::D&limit=10"
```

#### `decodeQueryString(queryString)`

Decode a URL query string with TYTX values.

```typescript
const params = decodeQueryString("date=2025-01-15::D&limit=10");
// { date: Date, limit: "10" }
```

---

## Wire Format Examples

### Query String

```
# Native values (no encoding)
?name=John&limit=10

# Typed values
?date=2025-01-15::D&price=100.50::N&active=1::B
```

### Headers

```
# Standard headers (no encoding)
Content-Type: application/vnd.tytx+json
Authorization: Bearer token

# Typed headers (with x-tytx- prefix)
x-tytx-timestamp: 10:30:00::H
x-tytx-expires: 2025-12-31::D
```

### Body (JSON)

```json
{"price":"100.50::N","date":"2025-01-15::D","active":true}::JS
```

### Response

```
HTTP/1.1 200 OK
Content-Type: application/vnd.tytx+json

{"total":"122.61::N","created_at":"2025-01-15T10:30:00.000Z::DHZ"}::JS
```

---

## Framework Integration

### FastAPI

```python
from fastapi import FastAPI, Request
from genro_tytx.middleware import TYTXMiddleware

app = FastAPI()
app = TYTXMiddleware(app)

@app.post("/invoice")
async def create_invoice(request: Request):
    tytx = request.scope["tytx"]
    date = tytx["query"]["date"]      # date object
    price = tytx["body"]["price"]     # Decimal object

    return {"total": price * Decimal("1.22")}
```

### Flask

```python
from flask import Flask, g
from genro_tytx.middleware import TYTXWSGIMiddleware

app = Flask(__name__)
app.wsgi_app = TYTXWSGIMiddleware(app.wsgi_app)

@app.route("/invoice", methods=["POST"])
def create_invoice():
    tytx = g.environ["tytx"]
    # ... same as above
```

### Starlette

```python
from starlette.applications import Starlette
from genro_tytx.middleware import TYTXMiddleware

app = Starlette()
app = TYTXMiddleware(app)
```

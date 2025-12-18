# HTTP Integration

Complete guide to transparent type handling across browser and server.

## How It Works

TYTX provides utility functions for encoding/decoding HTTP requests and responses. Your code works with native types.

```text
Browser                          Server
───────                          ──────
Decimal, Date                    Decimal, date, datetime
    │                                │
    ▼                                ▼
fetchTytx() ─── HTTP Request ──▶ asgi_data() / wsgi_data()
                                     │
                                     ▼
                                 Your handler
                                     │
                                     ▼
fromTytx() ◀─── HTTP Response ─── to_tytx()
    │
    ▼
Decimal, Date
```

**Key point**: Your application code works with native types, not wire format strings.

## Browser Side (JavaScript/TypeScript)

### `fetchTytx` API

Wrapper around `fetch()` with automatic type handling:

```javascript
import { fetchTytx } from 'genro-tytx';
import Big from 'big.js';

const result = await fetchTytx('/api/invoice', {
    method: 'POST',

    // Request body (full TYTX encoding)
    body: {
        price: new Big('100.50'),           // → "100.50::N"
        quantity: 5,                        // → 5 (native)
        date: new Date(Date.UTC(2025, 0, 15)),
    }
});

// Response automatically decoded
console.log(result.total);      // Big instance
console.log(result.created_at); // Date instance
```

### Options

```javascript
import Big from 'big.js';

// Standard fetch options are passed through
await fetchTytx('/api/data', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token' },
    body: { price: new Big('100.50') },
});
```

### Transport Header

`fetchTytx` automatically adds an `X-TYTX-Transport` header to every request, indicating the transport format being used:

```javascript
// Default transport (json)
await fetchTytx('/api/data', { body: data });
// Sends: X-TYTX-Transport: json

// Explicit transport
await fetchTytx('/api/data', { body: data, transport: 'msgpack' });
// Sends: X-TYTX-Transport: msgpack

await fetchTytx('/api/data', { body: data, transport: 'xml' });
// Sends: X-TYTX-Transport: xml
```

This header allows the server to know which transport format the client is using, useful for debugging and logging.

### Date Handling

JavaScript uses `Date` for all temporal types. TYTX distinguishes them by format:

```javascript
// Date only (midnight UTC)
const date = new Date(Date.UTC(2025, 0, 15));

// Full datetime (UTC)
const datetime = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));

// Time only (epoch date: 1970-01-01)
const time = new Date(Date.UTC(1970, 0, 1, 10, 30, 0));
```

## Server Side (Python)

### ASGI (FastAPI, Starlette)

```python
from fastapi import FastAPI, Request, Response
from genro_tytx import asgi_data, to_tytx
from decimal import Decimal

app = FastAPI()

@app.post("/api/invoice")
async def create_invoice(request: Request):
    # Decode all TYTX data from request
    data = await asgi_data(request.scope, request.receive)

    # Access decoded values
    body = data["body"]       # Request body (dict)
    query = data["query"]     # Query parameters (dict)
    headers = data["headers"] # Headers (dict)
    cookies = data["cookies"] # Cookies (dict)

    price = body["price"]    # Decimal
    date = query.get("date") # date object (if present)

    result = {"total": price * Decimal("1.22")}

    # Encode response
    return Response(
        content=to_tytx(result),
        media_type="application/vnd.tytx+json"
    )
```

### WSGI (Flask, Django)

```python
from flask import Flask, request
from genro_tytx import wsgi_data, to_tytx

app = Flask(__name__)

@app.route("/api/invoice", methods=["POST"])
def create_invoice():
    # Decode all TYTX data from request
    data = wsgi_data(request.environ)

    body = data["body"]
    price = body["price"]  # Decimal

    result = {"total": price * body["quantity"]}

    # Encode response
    response = app.response_class(
        response=to_tytx(result),
        mimetype="application/vnd.tytx+json"
    )
    return response
```

### Data Structure

Both `asgi_data()` and `wsgi_data()` return a dict with:

```python
{
    "query": {"date": date(2025, 1, 15), ...},   # Query string params
    "headers": {"content-type": "...", ...},     # HTTP headers
    "cookies": {"session": "...", ...},          # Cookies
    "body": {"price": Decimal("100.50"), ...},   # Request body
}
```

## Content Types

| Format | Content-Type |
|--------|-------------|
| TYTX JSON | `application/vnd.tytx+json` |
| TYTX XML | `application/vnd.tytx+xml` |
| TYTX MessagePack | `application/vnd.tytx+msgpack` |

The functions detect transport format from Content-Type header.

## Type Mapping

| JavaScript | Wire Format | Python |
|------------|-------------|--------|
| `Decimal` (big.js) | `"100.50::N"` | `Decimal` |
| `Date` (midnight UTC) | `"2025-01-15::D"` | `date` |
| `Date` (with time) | `"2025-01-15T10:30:00.000Z::DHZ"` | `datetime` |
| `Date` (epoch date) | `"10:30:00.000::H"` | `time` |

## Complete Example

### Server (FastAPI)

```python
from fastapi import FastAPI, Request, Response
from genro_tytx import asgi_data, to_tytx
from decimal import Decimal
from datetime import datetime, timezone

app = FastAPI()

@app.post("/api/order")
async def create_order(request: Request):
    data = await asgi_data(request.scope, request.receive)
    body = data["body"]

    # All types are correct
    price = body["price"]       # Decimal
    quantity = body["quantity"] # int
    date = body["date"]         # date

    total = price * quantity * Decimal("1.22")

    result = {
        "total": total,
        "created_at": datetime.now(timezone.utc),
    }

    return Response(
        content=to_tytx(result),
        media_type="application/vnd.tytx+json"
    )
```

### Client (JavaScript)

```javascript
import { fetchTytx } from 'genro-tytx';
import Big from 'big.js';

async function createOrder() {
    const result = await fetchTytx('/api/order', {
        method: 'POST',
        body: {
            price: new Big('49.99'),
            quantity: 2,
            date: new Date(Date.UTC(2025, 0, 15)),
        }
    });

    // Types are correct
    console.log(result.total.toFixed(2));  // "121.98"
    console.log(result.created_at);        // Date object
}
```

## Other Protocols

TYTX encoding works anywhere you can send text:

### WebSocket

```javascript
// Client
import { toTytx, fromTytx } from 'genro-tytx';
import Big from 'big.js';

ws.send(toTytx({
    event: 'trade',
    price: new Big('100.50'),
    timestamp: new Date()
}));

ws.onmessage = (event) => {
    const data = fromTytx(event.data);
    // data.price → Big
};
```

```python
# Server
from genro_tytx import to_tytx, from_tytx

async for message in websocket:
    data = from_tytx(message)
    response = process(data)
    await websocket.send(to_tytx(response))
```

### Server-Sent Events

```python
from genro_tytx import to_tytx
from datetime import datetime, timezone

async def sse_stream():
    while True:
        event = {
            "price": Decimal("100.50"),
            "updated_at": datetime.now(timezone.utc)
        }
        yield f"data: {to_tytx(event)}\n\n"
```

### Message Queues

```python
from genro_tytx import to_tytx, from_tytx

# Producer
redis.publish('trades', to_tytx({
    'price': Decimal('100.50'),
    'timestamp': datetime.now(timezone.utc)
}))

# Consumer
data = from_tytx(redis.subscribe('trades'))
```

## Best Practices

1. **Use `asgi_data`/`wsgi_data`** - They decode query, headers, cookies, and body in one call
2. **Set Content-Type** - Use `application/vnd.tytx+json` for TYTX responses
3. **Install decimal library** - `big.js` or `decimal.js` in JavaScript
4. **Use UTC for dates** - Always use `Date.UTC()` in JavaScript to avoid timezone issues

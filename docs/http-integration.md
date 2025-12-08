# HTTP Integration

Complete guide to transparent type handling across browser and server.

## How It Works

TYTX middleware handles encoding/decoding automatically. Your code works with native types.

```text
Browser                          Server
───────                          ──────
Decimal, Date                    Decimal, date, datetime
    │                                │
    ▼                                ▼
tytx_fetch() ─── HTTP Request ──▶ Middleware decodes
                                     │
                                     ▼
                                 Your handler
                                     │
                                     ▼
fromText() ◀─── HTTP Response ─── Middleware encodes
    │
    ▼
Decimal, Date
```

**Key point**: Your application code never sees the wire format.

## Browser Side (JavaScript/TypeScript)

### `tytx_fetch` API

Drop-in replacement for `fetch()` with automatic type handling:

```javascript
import { tytx_fetch, createDate } from 'genro-tytx';
import Decimal from 'decimal.js';

const result = await tytx_fetch('/api/invoice', {
    method: 'POST',

    // Query parameters (encoded in URL)
    query: {
        date: createDate(2025, 1, 15),   // → date=2025-01-15::D
        limit: 10                         // → limit=10
    },

    // Request body (full TYTX encoding)
    body: {
        price: new Decimal('100.50'),    // → "100.50::N"
        quantity: 5                       // → 5 (native)
    }
});

// Response automatically decoded
console.log(result.total);      // Decimal instance
console.log(result.created_at); // Date instance
```

### Helper Functions

```javascript
import { createDate, createTime, createDateTime } from 'genro-tytx';

// Date only (midnight UTC)
const date = createDate(2025, 1, 15);

// Time only (epoch date)
const time = createTime(10, 30, 0);

// Full datetime
const dt = createDateTime(2025, 1, 15, 10, 30, 0);
```

### Options

```javascript
// Skip body encoding (e.g., for FormData)
await tytx_fetch('/api/upload', {
    rawBody: true,
    body: formData,
});

// Skip response decoding (get raw Response)
const response = await tytx_fetch('/api/raw', {
    rawResponse: true,
});
```

## Server Side (Python)

### ASGI Middleware (FastAPI, Starlette)

```python
from fastapi import FastAPI, Request
from genro_tytx import TYTXMiddleware
from decimal import Decimal

app = FastAPI()
app = TYTXMiddleware(app)

@app.post("/api/invoice")
async def create_invoice(request: Request):
    # Decoded data available in scope["tytx"]
    body = request.scope["tytx"]["body"]
    query = request.scope["tytx"]["query"]

    price = body["price"]    # Decimal
    date = query["date"]     # date object

    return {
        "total": price * Decimal("1.22"),  # Decimal
        "due_date": date,                   # date
    }
```

### WSGI Middleware (Flask, Django)

```python
from flask import Flask, g
from genro_tytx import TYTXWSGIMiddleware

app = Flask(__name__)
app.wsgi_app = TYTXWSGIMiddleware(app.wsgi_app)

@app.route("/api/invoice", methods=["POST"])
def create_invoice():
    body = g.environ["tytx"]["body"]
    return {"total": body["price"] * body["quantity"]}
```

### Middleware Options

```python
TYTXMiddleware(
    app,
    decode_query=True,      # Decode query parameters
    decode_headers=True,    # Decode typed headers
    decode_body=True,       # Decode request body
    encode_response=True,   # Encode response body
)
```

### Accessing Decoded Data

```python
scope["tytx"] = {
    "query": {"date": date(2025, 1, 15), ...},
    "headers": {"x-timestamp": time(10, 30), ...},
    "body": {"price": Decimal("100.50"), ...},
}
```

## Content Types

| Format | Content-Type |
|--------|-------------|
| TYTX JSON | `application/vnd.tytx+json` |
| TYTX XML | `application/vnd.tytx+xml` |
| TYTX MessagePack | `application/vnd.tytx+msgpack` |

The middleware sets Content-Type automatically.

## Type Mapping

| JavaScript | Wire Format | Python |
|------------|-------------|--------|
| `Decimal` (big.js) | `"100.50::N"` | `Decimal` |
| `Date` (midnight UTC) | `"2025-01-15::D"` | `date` |
| `Date` (with time) | `"2025-01-15T10:30:00.000Z::DHZ"` | `datetime` |
| `Date` (epoch date) | `"10:30:00.000::H"` | `time` |

## Error Handling

```python
from genro_tytx import TYTXDecodeError

try:
    data = from_json(request_body)
except TYTXDecodeError as e:
    return {"error": str(e)}, 400
```

## Other Protocols

TYTX encoding works anywhere you can send text:

### WebSocket

```javascript
// Client
ws.send(toTypedText({
    event: 'trade',
    price: new Decimal('100.50'),
    timestamp: new Date()
}));

ws.onmessage = (event) => {
    const data = fromText(event.data);
    // data.price → Decimal
};
```

```python
# Server
async for message in websocket:
    data = from_text(message)
    response = process(data)
    await websocket.send(to_typed_text(response))
```

### Server-Sent Events

```python
async def sse_stream():
    while True:
        event = {
            "price": Decimal("100.50"),
            "updated_at": datetime.now(timezone.utc)
        }
        yield f"data: {to_typed_text(event)}\n\n"
```

### Message Queues

```python
# Producer
redis.publish('trades', to_typed_text({
    'price': Decimal('100.50'),
    'timestamp': datetime.now(timezone.utc)
}))

# Consumer
data = from_text(redis.subscribe('trades'))
```

## Best Practices

1. **Use middleware** - Don't encode/decode manually in handlers
2. **Set Content-Type** - Use `application/vnd.tytx+json` for TYTX responses
3. **Install decimal library** - `big.js` or `decimal.js` in JavaScript
4. **Use helper functions** - `createDate()`, `createTime()` for correct UTC handling

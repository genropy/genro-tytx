# Quick Start

Get productive with TYTX in 5 minutes.

## Installation

```bash
# Python
pip install genro-tytx

# JavaScript/TypeScript
npm install genro-tytx

# Recommended: decimal library for JS
npm install big.js  # lightweight, good for most cases
# or: npm install decimal.js  # more features
```

## 1. Basic Usage (Python only)

Encode data with special types, decode back:

```python
from datetime import date, datetime, time
from decimal import Decimal
from genro_tytx import to_tytx, from_tytx

data = {
    "price": Decimal("99.99"),
    "due_date": date(2025, 1, 15),
    "name": "Widget",  # Native JSON - unchanged
    "quantity": 5,     # Native JSON - unchanged
}

# Encode
encoded = to_tytx(data)
# '{"price": "99.99::N", "due_date": "2025-01-15::D", ...}::JS'

# Decode
decoded = from_tytx(encoded)
assert decoded["price"] == Decimal("99.99")
assert decoded["due_date"] == date(2025, 1, 15)
```

## 2. Web Application (Full Stack)

The real power: types flow automatically between browser and server.

### Server (FastAPI)

```python
from fastapi import FastAPI, Request, Response
from genro_tytx import asgi_data, to_tytx
from decimal import Decimal
from datetime import date, timedelta

app = FastAPI()

@app.post("/api/order")
async def create_order(request: Request):
    # Decode TYTX data from request
    data = await asgi_data(request.scope, request.receive)
    body = data["body"]

    # Types are already correct!
    price = body["price"]       # Decimal
    quantity = body["quantity"] # int
    ship_date = body["date"]    # date

    total = price * quantity * Decimal("1.22")

    result = {
        "total": total,                              # Decimal
        "ship_date": ship_date + timedelta(days=3),  # date
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

const result = await fetchTytx('/api/order', {
    method: 'POST',
    body: {
        price: new Big('49.99'),
        quantity: 2,
        date: new Date(Date.UTC(2025, 0, 15)),
    }
});

// Types are already correct!
console.log(result.total.toFixed(2));  // "121.98" (Big)
console.log(result.ship_date);         // Date object
```

### Server (Flask)

```python
from flask import Flask, request, Response
from genro_tytx import wsgi_data, to_tytx

app = Flask(__name__)

@app.route("/api/order", methods=["POST"])
def create_order():
    # Decode TYTX data from request
    data = wsgi_data(request.environ)
    body = data["body"]

    result = {"total": body["price"] * body["quantity"]}
    return Response(
        to_tytx(result),
        mimetype="application/vnd.tytx+json"
    )
```

## 3. TypeScript with Types

```typescript
import { fetchTytx } from 'genro-tytx';
import Big from 'big.js';

interface OrderResponse {
    total: Big;
    ship_date: Date;
}

const result = await fetchTytx('/api/order', {
    method: 'POST',
    body: {
        price: new Big('49.99'),
        quantity: 2,
        date: new Date(Date.UTC(2025, 0, 15)),
    }
}) as OrderResponse;
```

## 4. Query Parameters

Types in URL query strings are automatically decoded:

```python
@app.get("/api/search")
async def search(request: Request):
    # URL: /api/search?start_date=2025-01-01::D&min_price=10.00::N
    data = await asgi_data(request.scope, request.receive)
    query = data["query"]

    start = query["start_date"]    # date object
    min_price = query["min_price"] # Decimal object
```

## Date Handling (JavaScript)

JavaScript doesn't have separate Date/Time types, so use standard `Date` with UTC:

```javascript
// Date only (midnight UTC) - use Date.UTC to avoid timezone issues
const date = new Date(Date.UTC(2025, 0, 15));  // January 15, 2025

// Full datetime (UTC)
const datetime = new Date(Date.UTC(2025, 0, 15, 14, 30, 0));

// Time only (use epoch date: 1970-01-01)
const time = new Date(Date.UTC(1970, 0, 1, 14, 30, 0));
```

## Other Formats

### MessagePack (Binary)

More compact, good for large data:

```python
from genro_tytx import to_msgpack, from_msgpack

packed = to_msgpack({"price": Decimal("100.50")})
unpacked = from_msgpack(packed)
```

> Requires `pip install genro-tytx[msgpack]`

### XML

For legacy systems requiring XML. See [XML Format Reference](xml-format.md).

## Next Steps

- [HTTP Integration](http-integration.md) - Complete full-stack guide
- [API Reference](api-reference.md) - API reference
- [FAQ](faq.md) - Common questions
- [How It Works](how-it-works.md) - Wire format details

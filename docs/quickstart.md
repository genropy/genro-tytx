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
from genro_tytx import to_typed_text, from_text

data = {
    "price": Decimal("99.99"),
    "due_date": date(2025, 1, 15),
    "name": "Widget",  # Native JSON - unchanged
    "quantity": 5,     # Native JSON - unchanged
}

# Encode
encoded = to_typed_text(data)
# '{"price": "99.99::N", "due_date": "2025-01-15::D", ...}::JS'

# Decode
decoded = from_text(encoded)
assert decoded["price"] == Decimal("99.99")
assert decoded["due_date"] == date(2025, 1, 15)
```

## 2. Web Application (Full Stack)

The real power: types flow automatically between browser and server.

### Server (FastAPI)

```python
from fastapi import FastAPI, Request
from genro_tytx import TYTXMiddleware
from decimal import Decimal
from datetime import date, timedelta

app = FastAPI()
app = TYTXMiddleware(app)

@app.post("/api/order")
async def create_order(request: Request):
    data = request.scope["tytx"]["body"]

    # Types are already correct!
    price = data["price"]       # Decimal
    quantity = data["quantity"] # int
    ship_date = data["date"]    # date

    total = price * quantity * Decimal("1.22")

    return {
        "total": total,                          # Decimal
        "ship_date": ship_date + timedelta(days=3),  # date
    }
```

### Client (JavaScript)

```javascript
import { tytx_fetch, createDate } from 'genro-tytx';
import Decimal from 'decimal.js';

const result = await tytx_fetch('/api/order', {
    method: 'POST',
    body: {
        price: new Decimal('49.99'),
        quantity: 2,
        date: createDate(2025, 1, 15),
    }
});

// Types are already correct!
console.log(result.total.toFixed(2));  // "121.98" (Decimal)
console.log(result.ship_date);         // Date object
```

### Server (Flask)

```python
from flask import Flask, g
from genro_tytx import TYTXWSGIMiddleware

app = Flask(__name__)
app.wsgi_app = TYTXWSGIMiddleware(app.wsgi_app)

@app.route("/api/order", methods=["POST"])
def create_order():
    data = g.environ["tytx"]["body"]
    return {"total": data["price"] * data["quantity"]}
```

## 3. TypeScript with Types

```typescript
import { tytx_fetch, createDate } from 'genro-tytx';
import Decimal from 'decimal.js';

interface OrderResponse {
    total: Decimal;
    ship_date: Date;
}

const result = await tytx_fetch<OrderResponse>('/api/order', {
    method: 'POST',
    body: {
        price: new Decimal('49.99'),
        quantity: 2,
        date: createDate(2025, 1, 15),
    }
});
```

## 4. Query Parameters

Types in URL query strings:

```javascript
const result = await tytx_fetch('/api/search', {
    query: {
        start_date: createDate(2025, 1, 1),
        end_date: createDate(2025, 12, 31),
        min_price: new Decimal('10.00'),
    }
});
// URL: /api/search?start_date=2025-01-01::D&end_date=2025-12-31::D&min_price=10.00::N
```

```python
@app.get("/api/search")
async def search(request: Request):
    params = request.scope["tytx"]["query"]
    start = params["start_date"]    # date object
    min_price = params["min_price"] # Decimal object
```

## Helper Functions (JavaScript)

```javascript
import { createDate, createTime, createDateTime } from 'genro-tytx';

// Date only (midnight UTC)
const date = createDate(2025, 1, 15);

// Time only (stored as epoch date)
const time = createTime(14, 30, 0);

// Full datetime
const datetime = createDateTime(2025, 1, 15, 14, 30, 0);
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
- [Middleware API](middleware-api.md) - API reference
- [FAQ](faq.md) - Common questions
- [How It Works](how-it-works.md) - Wire format details

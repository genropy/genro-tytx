<p align="center">
  <img src="docs/assets/logo.png" alt="TYTX Logo" width="200">
</p>

<p align="center">
  <a href="https://pypi.org/project/genro-tytx/"><img src="https://img.shields.io/pypi/v/genro-tytx?color=blue" alt="PyPI"></a>
  <a href="https://www.npmjs.com/package/genro-tytx"><img src="https://img.shields.io/npm/v/genro-tytx?color=red" alt="npm"></a>
  <img src="https://img.shields.io/badge/python-3.10%2B-blue" alt="Python 3.10+">
  <a href="https://github.com/genropy/genro-tytx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="License"></a>
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Status">
  <br>
  <a href="https://github.com/genropy/genro-tytx/actions/workflows/tests.yml"><img src="https://github.com/genropy/genro-tytx/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://codecov.io/gh/genropy/genro-tytx"><img src="https://codecov.io/gh/genropy/genro-tytx/branch/main/graph/badge.svg" alt="Coverage"></a>
  <a href="https://genro-tytx.readthedocs.io/"><img src="https://readthedocs.org/projects/genro-tytx/badge/?version=latest" alt="Documentation"></a>
</p>

# genro-tytx

**A lightweight multi-transport typed data interchange system.**

TYTX eliminates manual type conversions between Python and JavaScript, and makes switching to MessagePack for better performance as simple as changing a parameter.

You send a `Decimal` from Python, JavaScript receives a string. You convert it back. Every. Single. Time. TYTX fixes this—types flow automatically between Python and JavaScript, over JSON, XML, or MessagePack.

## The Pain You Know

```python
# Your Python API
return {"price": Decimal("99.99"), "due_date": date(2025, 1, 15)}
```

```javascript
// Your JavaScript client
const data = await response.json();
// data.price is "99.99" (string) - need to convert
// data.due_date is "2025-01-15" (string) - need to convert

const price = new Decimal(data.price);      // Manual conversion
const dueDate = new Date(data.due_date);    // Manual conversion
```

**This leads to:**

- Conversion code scattered everywhere
- Bugs when someone forgets to convert
- Financial calculations with floating-point errors
- Different date formats causing off-by-one-day bugs

## The TYTX Solution

```python
# Server - just return native types
return {"price": Decimal("99.99"), "due_date": date(2025, 1, 15)}
```

```javascript
// Client - types arrive ready to use
const data = await fetchTytx('/api/order');
data.price      // → Decimal (not string)
data.due_date   // → Date (not string)
```

**Zero conversion code. Types just work.**

## 30-Second Demo

**Python:**

```bash
pip install genro-tytx
```

```python
from decimal import Decimal
from datetime import date
from genro_tytx import to_tytx, from_tytx

# Encode
data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
encoded = to_tytx(data)
# '{"price": "99.99::N", "date": "2025-01-15::D"}::JS'

# Decode
decoded = from_tytx(encoded)
# {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
```

**JavaScript:**

```bash
npm install genro-tytx big.js
```

```javascript
import { fetchTytx } from 'genro-tytx';
import Big from 'big.js';

const result = await fetchTytx('/api/invoice', {
    body: { price: new Big('99.99'), date: new Date() }
});
// result.total → Big (ready to use)
```

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

## Real-World Example: Order Processing

A typical business scenario: process an order with 8 typed fields, return 6 typed results.

### 1. The Data

**JavaScript Client** has order data with proper types:

```javascript
import Big from 'big.js';

const orderData = {
    unit_price: new Big('149.99'),      // Decimal
    quantity: 3,
    discount: new Big('10.00'),         // Decimal
    order_date: new Date(2025, 0, 15),  // Date
    delivery_date: new Date(2025, 0, 20),
    express: true,
    customer_id: 12345,
    notes: 'Handle with care'
};

// Expects response: { subtotal, tax, shipping, total, ship_date, arrival_date }
```

**Python Server** has business logic expecting proper types:

```python
async def process_order(unit_price, quantity, discount, order_date,
                        delivery_date, express, customer_id, notes):
    """Business logic - expects Decimal and date types."""
    subtotal = unit_price * quantity
    tax = subtotal * Decimal('0.22')
    shipping = Decimal('15.00') if express else Decimal('5.00')
    total = subtotal - discount + tax + shipping
    ship_date = order_date + timedelta(days=1 if express else 3)
    return {
        'subtotal': subtotal, 'tax': tax, 'shipping': shipping,
        'total': total, 'ship_date': ship_date, 'arrival_date': delivery_date
    }
```

---

### 2. ❌ WITHOUT TYTX: 20 Manual Conversions

**JavaScript** - must convert to/from strings:

```javascript
// Send: convert types → strings
const response = await fetch('/api/process_order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        unit_price: orderData.unit_price.toString(),           // Decimal → string
        discount: orderData.discount.toString(),               // Decimal → string
        order_date: orderData.order_date.toISOString().slice(0, 10),  // Date → string
        delivery_date: orderData.delivery_date.toISOString().slice(0, 10),
        quantity: orderData.quantity, express: orderData.express,
        customer_id: orderData.customer_id, notes: orderData.notes
    })
});

// Receive: convert strings → types
const json = await response.json();
const result = {
    subtotal: new Big(json.subtotal),     tax: new Big(json.tax),
    shipping: new Big(json.shipping),     total: new Big(json.total),
    ship_date: new Date(json.ship_date),  arrival_date: new Date(json.arrival_date)
};
```

**Python** - must convert to/from strings:

```python
@app.post("/api/process_order")
async def handle_order(request: Request):
    json_data = await request.json()

    # Receive: convert strings → types
    unit_price = Decimal(json_data['unit_price'])
    discount = Decimal(json_data['discount'])
    order_date = date.fromisoformat(json_data['order_date'])
    delivery_date = date.fromisoformat(json_data['delivery_date'])

    result = await process_order(unit_price, json_data['quantity'], discount,
        order_date, delivery_date, json_data['express'],
        json_data['customer_id'], json_data['notes'])

    # Send: convert types → strings
    return JSONResponse({
        'subtotal': str(result['subtotal']), 'tax': str(result['tax']),
        'shipping': str(result['shipping']), 'total': str(result['total']),
        'ship_date': result['ship_date'].isoformat(),
        'arrival_date': result['arrival_date'].isoformat()
    })
```

**Total: 20 manual conversions** (4 JS→string + 4 string→Python + 6 Python→string + 6 string→JS).

---

### 3. ✅ WITH TYTX: Zero Conversions

**JavaScript:**

```javascript
import { fetchTytx } from 'genro-tytx';

const result = await fetchTytx('/api/process_order', { body: orderData });
console.log(result.total.toFixed(2));  // Big, ready to use
```

**Python:**

```python
from genro_tytx import asgi_data, to_tytx

@app.post("/api/process_order")
async def handle_order(request: Request):
    data = await asgi_data(request.scope, request.receive)
    result = await process_order(**data['body'])
    return Response(content=to_tytx(result), media_type='application/vnd.tytx+json')
```

**Total: 0 conversions. Types flow naturally.**

### Bonus: Switch to MessagePack in One Line

Need binary format for better performance? Just add `transport: 'msgpack'`:

```javascript
// JSON (default)
const result = await fetchTytx('/api/process_order', { body: orderData });

// MessagePack - same API, binary format
const result = await fetchTytx('/api/process_order', { body: orderData, transport: 'msgpack' });
```

```python
# Server auto-detects transport from Content-Type header
# No code changes needed!
```

## Supported Types

| Python | JavaScript | Wire Format |
|--------|------------|-------------|
| `Decimal` | `Decimal` (big.js) | `"99.99::N"` |
| `date` | `Date` (midnight UTC) | `"2025-01-15::D"` |
| `datetime` | `Date` | `"2025-01-15T10:30:00.000Z::DHZ"` |
| `time` | `Date` (epoch date) | `"10:30:00.000::H"` |

Native JSON types (string, number, boolean, null) pass through unchanged.

## When to Use TYTX

**Good fit:**

- Web apps with forms containing dates/decimals
- Financial applications requiring decimal precision
- APIs that send/receive typed data frequently
- Excel-like grids with mixed types

**Not needed:**

- APIs that only use strings and integers
- Simple CRUD with no special types
- Already using GraphQL/Protobuf with full type support

## Documentation

| I want to... | Go to... |
|--------------|----------|
| Try it in 5 minutes | [Quick Start](docs/quickstart.md) |
| Use with FastAPI/Flask | [HTTP Integration](docs/http-integration.md) |
| Understand the wire format | [How It Works](docs/how-it-works.md) |
| See API reference | [API Reference](docs/api-reference.md) |
| Compare with alternatives | [Alternatives](docs/alternatives.md) |

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

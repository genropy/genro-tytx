<p align="center">
  <img src="docs/assets/logo.png" alt="TYTX Logo" width="200">
</p>

<p align="center">
  <a href="https://pypi.org/project/genro-tytx/"><img src="https://img.shields.io/pypi/v/genro-tytx?color=blue" alt="PyPI"></a>
  <a href="https://www.npmjs.com/package/genro-tytx"><img src="https://img.shields.io/npm/v/genro-tytx?color=red" alt="npm"></a>
  <a href="https://pypi.org/project/genro-tytx/"><img src="https://img.shields.io/pypi/pyversions/genro-tytx" alt="Python"></a>
  <a href="https://github.com/genropy/genro-tytx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="License"></a>
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Status">
  <br>
  <a href="https://github.com/genropy/genro-tytx/actions/workflows/tests.yml"><img src="https://github.com/genropy/genro-tytx/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://codecov.io/gh/genropy/genro-tytx"><img src="https://codecov.io/gh/genropy/genro-tytx/branch/main/graph/badge.svg" alt="Coverage"></a>
  <a href="https://genro-tytx.readthedocs.io/"><img src="https://readthedocs.org/projects/genro-tytx/badge/?version=latest" alt="Documentation"></a>
</p>

# genro-tytx

**Stop Converting Types Manually.**

You send a `Decimal` from Python, JavaScript receives a string. You convert it back. Every. Single. Time.

TYTX fixes this. Types flow automatically between Python and JavaScript.

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
const data = await tytx_fetch('/api/order');
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
from genro_tytx import to_typed_text, from_text

# Encode
data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
encoded = to_typed_text(data)
# '{"price": "99.99::N", "date": "2025-01-15::D"}::JS'

# Decode
decoded = from_text(encoded)
# {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
```

**JavaScript:**

```bash
npm install genro-tytx big.js
```

```javascript
import { tytx_fetch } from 'genro-tytx';

const result = await tytx_fetch('/api/invoice', {
    body: { price: new Decimal('99.99'), date: new Date() }
});
// result.total → Decimal (ready to use)
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

## Full Stack Setup

### Python Server (FastAPI)

```python
from fastapi import FastAPI, Request
from genro_tytx import TYTXMiddleware
from decimal import Decimal

app = FastAPI()
app = TYTXMiddleware(app)

@app.post("/api/order")
async def create_order(request: Request):
    data = request.scope["tytx"]["body"]

    # Types are already correct!
    price = data["price"]       # Decimal
    quantity = data["quantity"] # int

    return {"total": price * quantity * Decimal("1.22")}
```

### JavaScript Client

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
| See API reference | [Middleware API](docs/middleware-api.md) |
| Compare with alternatives | [Alternatives](docs/alternatives.md) |

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

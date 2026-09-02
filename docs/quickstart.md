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

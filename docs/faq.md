# FAQ

Common questions about using TYTX.

## Getting Started

### Do I need to understand the wire format to use TYTX?

No. The middleware handles encoding/decoding automatically. Your application code works with native types (`Decimal`, `date`, `datetime`, `time`) on both ends. See [How It Works](how-it-works.md) if you're curious about the internals.

### Which decimal library should I use in JavaScript?

We recommend `big.js` for most use cases - it's lightweight and sufficient for financial calculations. Use `decimal.js` if you need advanced features like trigonometric functions.

Without a decimal library, TYTX falls back to native `Number`, which can cause precision loss for large or precise values.

```bash
npm install big.js  # Recommended
# or
npm install decimal.js
```

### Does TYTX work with my framework?

TYTX provides HTTP utilities for:

- **ASGI** (FastAPI, Starlette, Quart) - use `asgi_data()`
- **WSGI** (Flask, Django, Bottle) - use `wsgi_data()`

Example:

```python
from genro_tytx import asgi_data, to_tytx

# In your request handler (FastAPI/Starlette)
data = await asgi_data(request.scope, request.receive)
response = to_tytx(result)
```

## Types and Conversion

### How does TYTX handle timezones?

All datetime values are converted to UTC during encoding. The wire format always uses ISO 8601 with `Z` suffix:

```python
# Input: aware datetime
datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
# Wire: "2025-01-15T10:30:00.000Z::DHZ"
# Output: datetime with UTC timezone

# Input: naive datetime (treated as UTC)
datetime(2025, 1, 15, 10, 30)
# Wire: "2025-01-15T10:30:00.000Z::DHZ"
# Output: datetime with UTC timezone
```

### Why does `time` become a `Date` in JavaScript?

JavaScript doesn't have a native time-only type. TYTX represents time values as `Date` objects with the epoch date (1970-01-01):

```javascript
// time(10, 30) in Python becomes
new Date('1970-01-01T10:30:00.000Z')

// To display just the time:
const timeStr = date.toISOString().slice(11, 19);  // "10:30:00"
```

### What happens to microseconds?

Microseconds are truncated to milliseconds for JavaScript compatibility. JavaScript's `Date` only supports millisecond precision:

```python
time(10, 30, 45, 123456)  # 123456 microseconds
# Wire: "10:30:45.123::H"  # 123 milliseconds
```

### Can I send native JSON types through TYTX?

Yes. Native JSON types (string, number, boolean, null) pass through unchanged:

```python
{
    "price": Decimal("99.99"),  # Encoded as "99.99::N"
    "name": "Widget",           # Unchanged
    "quantity": 5,              # Unchanged
    "in_stock": True,           # Unchanged
}
```

## HTTP Integration

### Do I need to set Content-Type headers manually?

When using `fetchTytx` on the client, headers are set automatically. For manual requests:

```python
headers = {"Content-Type": "application/vnd.tytx+json"}
```

### Can I use TYTX with regular `fetch()`?

Yes, but you need to encode/decode manually:

```javascript
import { toTytx, fromTytx } from 'genro-tytx';
import Big from 'big.js';

const response = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd.tytx+json' },
    body: toTytx({ price: new Big('100.50') }),
});

const data = fromTytx(await response.text());
```

`fetchTytx` does this automatically.

### How do I pass typed values in query strings?

Query strings with TYTX suffixes are automatically decoded on the server:

```python
# URL: /api/search?start_date=2025-01-01::D&min_price=10.00::N

@app.get("/api/search")
async def search(request: Request):
    data = await asgi_data(request.scope, request.receive)
    start_date = data["query"]["start_date"]  # date object
    min_price = data["query"]["min_price"]    # Decimal object
```

## Troubleshooting

### My Decimal values are becoming floats

Make sure you have a decimal library installed in JavaScript:

```bash
npm install big.js
```

Without a decimal library, TYTX falls back to `Number`.

### Dates are off by one day

This usually happens with date-only values when local timezone conversion is applied. TYTX uses UTC for all date/time values. When creating dates in JavaScript:

```javascript
// Wrong - may shift due to timezone
new Date('2025-01-15')

// Correct - explicit UTC
new Date(Date.UTC(2025, 0, 15))
```

### The request data isn't being decoded

Check that:

1. The Content-Type header is set correctly (`application/json` or `application/vnd.tytx+json`)
2. The request body is valid JSON
3. You're using `asgi_data()` or `wsgi_data()` to decode the request

### I'm getting "unknown type code" warnings

Unknown suffixes are passed through as strings. This can happen when:

1. Using a newer TYTX version with new type codes
2. Data contains `::` in regular strings (escape if needed)

## Performance

### Is TYTX slower than plain JSON?

The overhead is minimal - just string suffix parsing. For high-performance scenarios, install `orjson`:

```bash
pip install genro-tytx[fast]
```

### Should I use MessagePack for better performance?

MessagePack is more compact than JSON but requires an additional library. Use it when:

- Bandwidth is a concern
- You're sending large amounts of data
- Both client and server support it

To enable MessagePack support:

**Python:**

```bash
pip install genro-tytx[msgpack]
```

```python
from genro_tytx import to_msgpack, from_msgpack

# Encode
binary_data = to_msgpack({"price": Decimal("100.50")})

# Decode
data = from_msgpack(binary_data)
```

**JavaScript / TypeScript:**

```bash
npm install @msgpack/msgpack
```

```javascript
import { toMsgpack, fromMsgpack } from 'genro-tytx';
import Big from 'big.js';

// Encode
const binary = toMsgpack({ price: new Big('100.50') });

// Decode
const data = fromMsgpack(binary);
```

For most web applications, JSON is fine.

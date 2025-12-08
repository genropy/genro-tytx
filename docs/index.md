```{image} assets/logo.png
:alt: TYTX Logo
:align: center
:width: 200px
```

# TYTX - Stop Converting Types Manually

**You send a Decimal from Python, JavaScript receives a string. You convert it back. Every. Single. Time.**

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

```python
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

## Real-World Impact: Before and After

A typical form with dates, decimals, and timestamps:

### ❌ Without TYTX: 60+ lines of conversion code

**Server** must convert every field in and out:

```python
# Request: string → native type (8 conversions)
amount = Decimal(data["amount"])
start_date = date.fromisoformat(data["start_date"])
# ... 6 more fields

# Response: native type → string (8 conversions)
return {
    "amount": str(saved.amount),
    "start_date": saved.start_date.isoformat(),
    # ... 6 more fields
}
```

**Client** must convert every field in and out:

```javascript
// Request: native → string (8 conversions)
const payload = {
    amount: formData.amount.toString(),
    start_date: formData.startDate.toISOString().slice(0, 10),
    // ... 6 more fields
};

// Response: string → native (8 conversions)
return {
    amount: new Decimal(result.amount),
    startDate: new Date(result.start_date),
    // ... 6 more fields
};
```

**Total: 32 manual conversions for ONE form.**

### ✅ With TYTX: Zero conversion code

**Server:**

```python
data = request.scope["tytx"]["body"]  # All types correct
contract = Contract(**data)           # Use directly
return asdict(saved)                  # Return directly
```

**Client:**

```javascript
const result = await tytx_fetch('/api/save', { body: formData });
return result;  // All types correct
```

**Total: 0 conversions. Types flow naturally.**

[See more real-world examples →](alternatives.md#real-world-comparison-before-and-after)

## Supported Types

| Python | JavaScript | Wire Format |
|--------|------------|-------------|
| `Decimal` | `Decimal` (big.js) | `"99.99::N"` |
| `date` | `Date` (midnight UTC) | `"2025-01-15::D"` |
| `datetime` | `Date` | `"2025-01-15T10:30:00.000Z::DHZ"` |
| `time` | `Date` (epoch date) | `"10:30:00.000::H"` |

Native JSON types (string, number, boolean, null) pass through unchanged.

## Choose Your Path

| I want to... | Go to... |
|--------------|----------|
| Try it in 5 minutes | [Quickstart](quickstart.md) |
| Use with FastAPI/Flask | [HTTP Integration](http-integration.md) |
| Understand the wire format | [How It Works](how-it-works.md) |
| See API reference | [Middleware API](middleware-api.md) |
| Compare with alternatives | [Alternatives](alternatives.md) |

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

```{toctree}
:maxdepth: 2
:caption: Getting Started

Overview <self>
installation
quickstart
```

```{toctree}
:maxdepth: 2
:caption: Integration

http-integration
middleware-api
```

```{toctree}
:maxdepth: 2
:caption: Reference

faq
how-it-works
alternatives
xml-format
```

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

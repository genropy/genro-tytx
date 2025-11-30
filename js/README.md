# genro-tytx (JavaScript)

JavaScript implementation of TYTX (Typed Text) protocol.

## Installation

```bash
npm install genro-tytx
```

### Optional Dependencies

For precise decimal arithmetic (recommended for financial applications):

```bash
npm install big.js       # Lightweight (8KB) - recommended
# or
npm install decimal.js   # Full-featured (32KB)
```

For MessagePack binary serialization:

```bash
npm install @msgpack/msgpack
```

TYTX automatically detects and uses whichever libraries are installed.

## Quick Start

```javascript
const { from_text, as_typed_text, from_json, as_typed_json } = require('genro-tytx');

// Parse typed strings
from_text("123::L");           // → 123
from_text("99.99::N");         // → 99.99 (or Big if big.js installed)
from_text("2025-01-15::D");    // → Date object
from_text("true::B");          // → true

// Serialize with types
as_typed_text(123);            // → "123::L"
as_typed_text(new Date());     // → "2025-01-15::D"
as_typed_text(true);           // → "true::B"

// JSON
as_typed_json({ price: 99.99, date: new Date(2025, 0, 15) });
// → '{"price":"99.99::R","date":"2025-01-15::D"}'

from_json('{"price":"99.99::N","date":"2025-01-15::D"}');
// → { price: 99.99, date: Date }
```

## Type Codes

| Code | Name | JS Type | Example |
|------|------|---------|---------|
| `L` | Long integer | `number` | `"123::L"` |
| `R` | Real number | `number` | `"1.5::R"` |
| `N` | Numeric | `number`/`Big` | `"100.50::N"` |
| `B` | Boolean | `boolean` | `"true::B"` |
| `T` | Text | `string` | `"hello::T"` |
| `D` | Date | `Date` | `"2025-01-15::D"` |
| `DHZ` | DateTime | `Date` | `"2025-01-15T10:00:00Z::DHZ"` |
| `DH` | Naive DateTime (deprecated) | `Date` | `"2025-01-15T10:00::DH"` |
| `H` | Hour | `string` | `"10:30:00::H"` |
| `JS` | JavaScript object | `object` | `'{"a":1}::JS'` |

## Type Prefixes

| Prefix | Category | Example |
|--------|----------|---------|
| (none) | Built-in | `::L`, `::D`, `::N` |
| `~` | Custom class | `::~UUID`, `::~INV` |
| `@` | Struct schema | `::@CUSTOMER`, `::@ROW` |
| `#` | Typed array | `::#L`, `::#N`, `::#@ROW` |

## Struct Schemas

```javascript
const { registry, from_text } = require('genro-tytx');

// Dict schema
registry.register_struct('CUSTOMER', { name: 'T', balance: 'N' });

from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER');
// → { name: "Acme", balance: 100 }

// String schema for CSV-like data
registry.register_struct('POINT', 'x:R,y:R');

from_text('["3.7", "7.3"]::@POINT');
// → { x: 3.7, y: 7.3 }

// Array of structs
from_text('[["1", "2"], ["3", "4"]]::#@POINT');
// → [{ x: 1, y: 2 }, { x: 3, y: 4 }]
```

## API Reference

### Text Functions

- `from_text(value, type_code?)` - Parse typed string to JS value
- `as_text(value, format?, locale?)` - Convert to string
- `as_typed_text(value)` - Convert to typed string with `::code` suffix

### JSON Functions

- `as_typed_json(data)` - Serialize to JSON with type suffixes
- `as_json(data)` - Serialize to standard JSON
- `from_json(json_str)` - Parse JSON with type hydration

### XML Functions

- `as_typed_xml(data)` - Serialize to XML with type suffixes
- `as_xml(data)` - Serialize to standard XML
- `from_xml(xml_str)` - Parse XML with type hydration

### MessagePack Functions

Requires `@msgpack/msgpack`:

```javascript
const { packb, unpackb } = require('genro-tytx/src/msgpack_utils');

const data = { price: 99.99, date: new Date('2025-01-15') };

// Pack to MessagePack bytes
const packed = packb(data);

// Unpack with types restored
const restored = unpackb(packed);
// restored.date is a Date object
```

- `packb(data)` - Pack to MessagePack bytes with TYTX types
- `unpackb(packed)` - Unpack MessagePack bytes with type hydration
- `TYTX_EXT_TYPE` - ExtType code 42 (TYTX marker)

### Registry

- `registry.register(type)` - Register custom type
- `registry.get(code)` - Get type by code
- `registry.is_typed(value)` - Check if string has type suffix

### TytxModel

Base class for creating TYTX-aware models:

```javascript
const { TytxModel } = require('genro-tytx');

class Order extends TytxModel {}

// Create from TYTX JSON
const order = Order.fromTytx('{"price": "99.99::N", "date": "2025-01-15::D"}');
console.log(order.price);  // 99.99 (number or Big)
console.log(order.date);   // Date object

// Serialize to TYTX JSON
const newOrder = new Order();
newOrder.price = 149.99;
newOrder.date = new Date();
newOrder.toTytx();  // '{"price":"149.99::R","date":"2025-01-15::D"}'

// Fetch from API (single object or array)
const orders = await Order.fetchTytx('/api/orders');
orders.forEach(o => console.log(o.price, o.date));

// MessagePack support (requires @msgpack/msgpack)
const packed = order.toTytxMsgpack();
const restored = Order.fromTytxMsgpack(packed);
```

**TytxModel Methods:**

| Method | Description |
|--------|-------------|
| `toTytx()` | Serialize instance to TYTX JSON string |
| `toTytxMsgpack()` | Serialize instance to MessagePack bytes |
| `static fromTytx(json)` | Create instance from TYTX JSON string or object |
| `static fromTytxMsgpack(packed)` | Create instance from MessagePack bytes |
| `static fetchTytx(url, init?)` | Fetch and deserialize from URL |
| `static fetchTytxMsgpack(url, init?)` | Fetch MessagePack and deserialize |

## Decimal Library Detection

```javascript
const { decimalLibName, isDecimalInstance } = require('genro-tytx');

console.log(decimalLibName);  // "big.js", "decimal.js", or "number"

const value = from_text("99.99::N");
console.log(isDecimalInstance(value));  // true if library installed
```

## Development

```bash
# Run tests
npm test

# Generate docs
npm run docs
```

## Documentation

Full documentation: <https://genro-tytx.readthedocs.io/>

## License

Apache License 2.0

Copyright 2025 Softwell S.r.l.

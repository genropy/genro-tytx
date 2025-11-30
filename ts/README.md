# genro-tytx-ts

TypeScript implementation of TYTX (Typed Text) protocol with full type safety.

## Installation

```bash
npm install genro-tytx-ts
```

### Optional Dependencies

For MessagePack binary serialization:

```bash
npm install @msgpack/msgpack
```

## Quick Start

```typescript
import {
  registry,
  fromJson,
  asTypedJson,
  asJson,
  TytxModel,
} from 'genro-tytx-ts';

// Parse typed strings
registry.fromText('123::L');           // → 123
registry.fromText('99.99::N');         // → number (Decimal)
registry.fromText('2025-01-15::D');    // → Date object
registry.fromText('true::B');          // → true

// Serialize with types
registry.asTypedText(123);             // → "123::L"
registry.asTypedText(new Date());      // → "2025-01-15T10:30:00::DH"
registry.asTypedText(true);            // → "true::B"

// JSON with types
asTypedJson({ price: 99.99, count: 5 });
// → '{"price":"99.99::R","count":"5::L"}'

fromJson<{ price: number; active: boolean }>(
  '{"price":"99.99::N","active":"true::B"}'
);
// → { price: 99.99, active: true }
```

## Type Codes

| Code | Aliases | TS Type | Example |
|------|---------|---------|---------|
| `L` | `I`, `INT`, `INTEGER`, `LONG` | `number` | `"123::L"` |
| `R` | `F`, `REAL`, `FLOAT` | `number` | `"1.5::R"` |
| `N` | `NUMERIC`, `DECIMAL` | `number` | `"100.50::N"` |
| `B` | `BOOL`, `BOOLEAN` | `boolean` | `"true::B"` |
| `T` | `S`, `TEXT`, `STRING` | `string` | `"hello::T"` |
| `D` | `DATE` | `Date` | `"2025-01-15::D"` |
| `DH` | `DT`, `DHZ`, `DATETIME` | `Date` | `"2025-01-15T10:00::DH"` |
| `H` | `TIME`, `HZ` | `string` | `"10:30:00::H"` |
| `JS` | `JSON` | `object` | `'{"a":1}::JS'` |

## TytxModel

Type-safe model base class:

```typescript
import { TytxModel } from 'genro-tytx-ts';

class Order extends TytxModel {
  price!: number;
  quantity!: number;
  name!: string;
}

// Create from TYTX JSON
const order = Order.fromTytx<Order>(
  '{"price":"99.99::N","quantity":"5::L","name":"Widget"}'
);
console.log(order.price);    // 99.99
console.log(order.quantity); // 5

// Serialize to TYTX JSON
const newOrder = new Order();
newOrder.price = 149.99;
newOrder.quantity = 10;
newOrder.name = 'Gadget';
newOrder.toTytx();
// → '{"price":"149.99::R","quantity":"10::L","name":"Gadget"}'

// Fetch from API
const orders = await Order.fetchTytxArray<Order>('/api/orders');
orders.forEach(o => console.log(o.price, o.name));

// Single object
const single = await Order.fetchTytx<Order>('/api/orders/1');
```

## API Reference

### Registry

```typescript
import { registry } from 'genro-tytx-ts';

// Parse typed string to value
registry.fromText('42::L');        // → 42

// Convert value to typed string
registry.asTypedText(42);          // → "42::L"

// Convert value to plain string
registry.asText(42);               // → "42"

// Check if string has type suffix
registry.isTyped('42::L');         // → true
```

### JSON Functions

```typescript
import { asTypedJson, asJson, fromJson } from 'genro-tytx-ts';

// Serialize with type suffixes
asTypedJson({ price: 99.99 });     // → '{"price":"99.99::R"}'

// Serialize as standard JSON
asJson({ price: 99.99 });          // → '{"price":99.99}'

// Parse with type hydration
fromJson<{ price: number }>('{"price":"99.99::N"}');
```

### Type Utilities

```typescript
import {
  isTypedString,
  extractTypeCode,
  extractValue,
} from 'genro-tytx-ts';

isTypedString('42::L');            // → true
extractTypeCode('42::L');          // → 'L'
extractValue('42::L');             // → '42'
```

### MessagePack (Optional)

Requires `@msgpack/msgpack`:

```typescript
import { packb, unpackb, TYTX_EXT_TYPE } from 'genro-tytx-ts';

const data = { price: 99.99, date: new Date() };

// Pack to MessagePack bytes
const packed = packb(data);

// Unpack with types restored
const restored = unpackb<typeof data>(packed);
// restored.date is a Date object
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## License

Apache License 2.0

Copyright 2025 Softwell S.r.l.

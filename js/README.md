# genro-tytx (JavaScript)

JavaScript/TypeScript implementation of TYTX (Typed Text) protocol.

## Installation

```bash
npm install genro-tytx
```

### Optional Dependencies

```bash
# MessagePack support
npm install @msgpack/msgpack
```

## Usage

```typescript
import { hydrate, serialize } from 'genro-tytx';
import Decimal from 'decimal.js';

// Hydrate TYTX values
const data = hydrate({ price: "100.50::D", date: "2025-01-15::d" });
// { price: Decimal("100.50"), date: Date("2025-01-15") }

// Serialize JavaScript objects
const tytx = serialize({
  price: new Decimal("100.50"),
  date: new Date("2025-01-15")
});
// { price: "100.50::D", date: "2025-01-15::d" }
```

## Browser Usage

```html
<script src="https://unpkg.com/genro-tytx"></script>
<script>
  const { hydrate, serialize } = GenroTYTX;
  // ...
</script>
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Type check
npm run typecheck
```

## License

Apache License 2.0

Copyright 2025 Softwell S.r.l.

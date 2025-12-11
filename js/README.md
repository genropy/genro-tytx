# genro-tytx

**A lightweight multi-transport typed data interchange system.**

TYTX eliminates manual type conversions between Python and JavaScript, and makes switching to MessagePack for better performance as simple as changing a parameter.

## Installation

```bash
npm install genro-tytx big.js
```

## Quick Start

```javascript
import { toTytx, fromTytx, setDecimalLibrary } from 'genro-tytx';
import Big from 'big.js';

// Configure decimal library
setDecimalLibrary({
  name: 'big.js',
  constructor: Big,
  isDecimal: (v) => v instanceof Big
});

// Encode
const data = {
  price: new Big('99.99'),
  date: new Date('2025-01-15')
};
const encoded = toTytx(data, 'json');

// Decode
const decoded = fromTytx(encoded, 'json');
// decoded.price is Big('99.99')
// decoded.date is Date
```

## Supported Transports

- **JSON** - Default, human-readable
- **MessagePack** - Binary, better performance
- **XML** - For XML-based systems

```javascript
// Switch transport with a single parameter
const jsonEncoded = toTytx(data, 'json');
const msgpackEncoded = toTytx(data, 'msgpack');
const xmlEncoded = toTytx(data, 'xml');
```

## HTTP Client

```javascript
import { fetchTytx } from 'genro-tytx';

// Fetch with automatic TYTX encoding/decoding
const result = await fetchTytx('/api/data', {
  method: 'POST',
  body: { price: new Big('99.99') }
});
```

## Supported Types

| Type | JavaScript | Python |
|------|------------|--------|
| Decimal | `Big` / `Decimal` | `decimal.Decimal` |
| Date | `Date` (date only) | `datetime.date` |
| DateTime | `Date` (with time) | `datetime.datetime` |
| Time | `Date` (time only) | `datetime.time` |

## Documentation

Full documentation: https://genro-tytx.readthedocs.io/

## License

Apache-2.0

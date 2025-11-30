# JavaScript API

TYTX includes a full JavaScript implementation for use in Node.js and browsers.

## Installation

```bash
npm install genro-tytx
```

### Optional: Decimal Support

For precise decimal arithmetic (recommended for financial applications):

```bash
npm install big.js       # Lightweight (8KB) - recommended
# or
npm install decimal.js   # Full-featured (32KB)
```

TYTX automatically detects and uses whichever library is installed.

## Quick Start

```javascript
const { from_text, as_typed_text, from_json, as_typed_json } = require('genro-tytx');

// Parse typed strings
from_text("123::L");           // → 123 (number)
from_text("99.99::N");         // → 99.99 (number, or Big if big.js installed)
from_text("2025-01-15::D");    // → Date object
from_text("true::B");          // → true (boolean)

// Serialize with types
as_typed_text(123);            // → "123::L"
as_typed_text(new Date());     // → "2025-01-15::D"
as_typed_text(true);           // → "true::B"
```

## Core Functions

### from_text(value, type_code?)

Parse a typed string into a JavaScript value.

```javascript
from_text("123::L")              // → 123
from_text("100.50::N")           // → 100.50 (or Big instance)
from_text("2025-01-15::D")       // → Date(2025, 0, 15)
from_text("hello")               // → "hello" (no type)
from_text("123", "L")            // → 123 (explicit type)
```

### as_text(value, format?, locale?)

Convert a value to string, optionally formatted.

```javascript
as_text(123)                     // → "123"
as_text(new Date(2025, 0, 15))   // → "2025-01-15"
as_text(99.99, true, "it-IT")    // → "99,99" (formatted)
```

### as_typed_text(value)

Convert a value to typed string with `::type_code` suffix.

```javascript
as_typed_text(123)               // → "123::L"
as_typed_text(99.99)             // → "99.99::R"
as_typed_text(true)              // → "true::B"
as_typed_text("hello")           // → "hello" (strings have no suffix)
```

## JSON Functions

### as_typed_json(data)

Serialize to JSON with type suffixes (TYTX format).

```javascript
as_typed_json({
    price: 99.99,
    date: new Date(2025, 0, 15),
    active: true
});
// → '{"price":"99.99::R","date":"2025-01-15::D","active":"true::B"}'
```

### as_json(data)

Serialize to standard JSON (no type suffixes).

```javascript
as_json({
    price: 99.99,
    date: new Date(2025, 0, 15)
});
// → '{"price":99.99,"date":"2025-01-15"}'
```

### from_json(json_str)

Parse JSON and hydrate typed values.

```javascript
from_json('{"price": "99.99::N", "date": "2025-01-15::D"}');
// → { price: 99.99, date: Date(2025, 0, 15) }
```

## XML Functions

### as_typed_xml(data)

Serialize to XML with type suffixes.

```javascript
as_typed_xml({
    order: {
        attrs: { id: 123 },
        value: { price: { attrs: {}, value: 99.99 } }
    }
});
// → '<order id="123::L"><price>99.99::R</price></order>'
```

### from_xml(xml_str)

Parse XML and hydrate typed values.

```javascript
from_xml('<root><price>99.99::N</price></root>');
// → { root: { attrs: {}, value: { price: { attrs: {}, value: 99.99 } } } }
```

## Type Codes

| Code | Aliases | JS Type | Example |
|------|---------|---------|---------|
| `L` | `I`, `INT`, `INTEGER`, `LONG` | `number` | `"123::L"` |
| `R` | `F`, `REAL`, `FLOAT` | `number` | `"1.5::R"` |
| `N` | `NUMERIC`, `DECIMAL` | `number`/`Big` | `"100.50::N"` |
| `B` | `BOOL`, `BOOLEAN` | `boolean` | `"true::B"` |
| `T` | `S`, `TEXT`, `STRING` | `string` | `"hello::T"` |
| `D` | `DATE` | `Date` | `"2025-01-15::D"` |
| `DH` | `DT`, `DHZ`, `DATETIME` | `Date` | `"2025-01-15T10:00::DH"` |
| `H` | `TIME`, `HZ` | `string` | `"10:30:00::H"` |
| `JS` | `JSON` | `object` | `'{"a":1}::JS'` |

## Decimal Library Support

TYTX automatically detects installed decimal libraries:

```javascript
const { decimalLibName, DecimalLib, isDecimalInstance } = require('genro-tytx');

console.log(decimalLibName);  // "big.js", "decimal.js", or "number"

// Check if a value is a Decimal instance
const value = from_text("99.99::N");
console.log(isDecimalInstance(value));  // true if big.js/decimal.js installed
```

**Priority order:**
1. `big.js` (lightweight, recommended)
2. `decimal.js` (full-featured)
3. Native `Number` (fallback)

## Registry API

### registry.register(type)

Register a custom type.

```javascript
const { registry } = require('genro-tytx');

const UUIDType = {
    name: 'uuid',
    code: 'U',
    aliases: ['UUID'],
    js_type: 'string',

    parse(value) {
        // Validate and return UUID string
        if (!/^[0-9a-f-]{36}$/i.test(value)) {
            throw new Error('Invalid UUID');
        }
        return value;
    },

    serialize(value) {
        return value.toLowerCase();
    }
};

registry.register(UUIDType);

// Now works
from_text("550e8400-e29b-41d4-a716-446655440000::U");
```

### registry.get(code)

Get a type by code or alias.

```javascript
registry.get("L");     // → IntType
registry.get("INT");   // → IntType (alias)
registry.get("X");     // → null (unknown)
```

### registry.is_typed(value)

Check if a string contains a type suffix.

```javascript
registry.is_typed("123::L");   // → true
registry.is_typed("123");      // → false
```

## Browser Usage

For browser environments, use a bundler like webpack or esbuild:

```javascript
// ES modules (with bundler)
import { from_text, as_typed_text } from 'genro-tytx';
```

Or include directly (UMD build coming soon):

```html
<script src="path/to/genro-tytx.min.js"></script>
<script>
    const { from_text } = window.genroTytx;
    console.log(from_text("123::L"));  // 123
</script>
```

## TypeScript Support

Type definitions are included:

```typescript
import { from_text, as_typed_text, registry } from 'genro-tytx';

const value: number = from_text("123::L");
const typed: string = as_typed_text(123);
```

## Examples

### Express API Response

```javascript
const express = require('express');
const { as_typed_json } = require('genro-tytx');

app.get('/order/:id', async (req, res) => {
    const order = await getOrder(req.params.id);
    // Response preserves types for TYTX-aware clients
    res.type('application/json').send(as_typed_json(order));
});
```

### Configuration File

```javascript
const fs = require('fs');
const { from_json } = require('genro-tytx');

const config = from_json(fs.readFileSync('config.json', 'utf-8'));
// config.port is number, config.startDate is Date, etc.
```

### WebSocket Messages

```javascript
const { as_typed_json, from_json } = require('genro-tytx');

// Send
ws.send(as_typed_json({ timestamp: new Date(), value: 123.45 }));

// Receive
ws.on('message', (data) => {
    const msg = from_json(data);
    // msg.timestamp is Date, msg.value is number
});
```

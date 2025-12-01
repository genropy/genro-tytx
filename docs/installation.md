# Installation

## Requirements

- Python 3.10 or higher
- No external dependencies (stdlib only)

## Install from PyPI

```bash
pip install genro-tytx
```

## Optional Dependencies

For faster JSON encoding with orjson:

```bash
pip install genro-tytx[json]
```

For MessagePack support:

```bash
pip install genro-tytx[msgpack]
```

For all extras:

```bash
pip install genro-tytx[all]
```

## Development Installation

Clone the repository:

```bash
git clone https://github.com/genropy/genro-tytx.git
cd genro-tytx
pip install -e ".[dev]"
```

## Verify Installation

```python
>>> from genro_tytx import from_text, as_typed_text
>>> from_text("100.50::N")
Decimal('100.50')
>>> as_typed_text(42)
'42::L'
```

## JavaScript Installation

For JavaScript/TypeScript projects:

```bash
npm install genro-tytx
```

### Decimal Precision in JavaScript

JavaScript's native `Number` type has limited precision for decimal values. For financial or scientific applications requiring exact decimal arithmetic, install one of these optional libraries:

```bash
# Recommended - lightweight (~8KB)
npm install big.js

# Alternative - more features (~32KB)
npm install decimal.js
```

TYTX auto-detects these libraries and uses them for `::N` (Decimal) values:

| Library installed | `from_text("99.99::N")` returns |
|-------------------|--------------------------------|
| `big.js` | `Big("99.99")` |
| `decimal.js` | `Decimal("99.99")` |
| None | `99.99` (native Number) |

```javascript
const { from_text, decimalLibName } = require('genro-tytx');

console.log(decimalLibName);  // "big.js", "decimal.js", or "number"

// With big.js installed:
const price = from_text("99.99::N");  // Big instance
console.log(price.plus("0.01").toString());  // "100.00" (exact)
```

### MessagePack Support (JavaScript)

For binary serialization:

```bash
npm install @msgpack/msgpack
```

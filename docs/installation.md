# Installation

## Requirements

- Python 3.10 or higher
- No external dependencies (stdlib only)

## Install from PyPI

```bash
pip install genro-tytx
```

## Optional Dependencies

For Pydantic integration:

```bash
pip install genro-tytx[pydantic]
```

For MessagePack support:

```bash
pip install genro-tytx[msgpack]
```

For XSD schema conversion:

```bash
pip install genro-tytx[xsd]
```

For all extras:

```bash
pip install genro-tytx[pydantic,msgpack,xsd]
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

## JavaScript / TypeScript Installation

For JavaScript and TypeScript projects:

```bash
npm install genro-tytx
```

TypeScript type definitions are included.

### Decimal Precision in JavaScript

JavaScript's native `Number` type has limited precision for decimal values. For financial or scientific applications requiring exact decimal arithmetic, install one of these optional libraries:

```bash
# Recommended - lightweight (~8KB)
npm install big.js

# Alternative - more features (~32KB)
npm install decimal.js
```

TYTX auto-detects these libraries and uses them for `::N` (Decimal) values:

| Library installed | `fromText("99.99::N")` returns |
|-------------------|--------------------------------|
| `big.js` | `Big("99.99")` |
| `decimal.js` | `Decimal("99.99")` |
| None | `99.99` (native Number) |

```javascript
import { fromText, decimalLibName } from 'genro-tytx';

console.log(decimalLibName);  // "big.js", "decimal.js", or "number"

// With big.js installed:
const price = fromText("99.99::N");  // Big instance
console.log(price.plus("0.01").toString());  // "100.00" (exact)
```

### MessagePack Support (JavaScript)

For binary serialization:

```bash
npm install @msgpack/msgpack
```

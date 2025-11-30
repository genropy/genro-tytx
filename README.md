# genro-tytx

**TYTX (Typed Text)** - A protocol for exchanging typed data over text-based formats.

[![PyPI version](https://img.shields.io/pypi/v/genro-tytx)](https://pypi.org/project/genro-tytx/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tests](https://github.com/genropy/genro-tytx/actions/workflows/tests.yml/badge.svg)](https://github.com/genropy/genro-tytx/actions/workflows/tests.yml)
[![Documentation](https://readthedocs.org/projects/genro-tytx/badge/?version=latest)](https://genro-tytx.readthedocs.io/)
[![codecov](https://codecov.io/gh/genropy/genro-tytx/graph/badge.svg)](https://codecov.io/gh/genropy/genro-tytx)
[![LLM Docs](https://img.shields.io/badge/LLM%20Docs-available-brightgreen)](llm-docs/)

Part of [Genro Kyō](https://github.com/genropy) ecosystem.

## Overview

TYTX solves the "stringly typed" problem of JSON and other text formats by encoding type information directly into value strings using a concise `value::type_code` syntax.

### The Problem

JSON only supports: string, number, boolean, null. What about `Decimal`, `Date`, `DateTime`?

```json
{
  "price": 100.50,
  "date": "2025-01-15"
}
```

Is `price` a float or a precise Decimal? Is `date` a string or a Date object?

### The TYTX Solution

```json
{
  "price": "100.50::N",
  "date": "2025-01-15::D"
}
```

The `::` suffix encodes type information. After parsing:

- `price` → `Decimal("100.50")` (N = Numeric)
- `date` → `date(2025, 1, 15)` (D = Date)

## Quick Start

### Python

```python
from genro_tytx import from_text, as_typed_text
from decimal import Decimal
from datetime import date

# Parse typed strings
from_text("100.50::N")        # → Decimal("100.50")  (N = Numeric)
from_text("2025-01-15::D")    # → date(2025, 1, 15)  (D = Date)
from_text("123::L")           # → 123                (L = Long/int)

# Serialize with types
as_typed_text(Decimal("99.99"))  # → "99.99::N"
as_typed_text(date(2025, 1, 15)) # → "2025-01-15::D"
as_typed_text(123)               # → "123::L"
```

### JSON

```python
from genro_tytx import as_typed_json, from_json

# Serialize to typed JSON
data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}
as_typed_json(data)
# '{"price": "99.99::N", "date": "2025-01-15::D"}'

# Parse typed JSON
from_json('{"price": "99.99::N", "count": "42::L"}')
# {"price": Decimal("99.99"), "count": 42}
```

### XML

```python
from genro_tytx import as_typed_xml, from_xml

# Create typed XML
data = {"order": {"attrs": {"id": 123}, "value": {"price": {"attrs": {}, "value": Decimal("99.99")}}}}
as_typed_xml(data)
# '<order id="123::L"><price>99.99::N</price></order>'

# Parse typed XML
from_xml('<root>100.50::N</root>')
# {"root": {"attrs": {}, "value": Decimal("100.50")}}
```

### Pydantic Integration

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal
from datetime import date

class Order(TytxModel):
    price: Decimal
    order_date: date
    quantity: int

order = Order(price=Decimal("99.99"), order_date=date(2025, 1, 15), quantity=5)

# Serialize to TYTX JSON (preserves Decimal precision)
json_str = order.model_dump_json()
# '{"price": "99.99::N", "order_date": "2025-01-15::D", "quantity": "5::L"}'

# Deserialize from TYTX JSON
restored = Order.model_validate_tytx(json_str)
assert restored.price == Decimal("99.99")  # Exact precision!

# MessagePack support (requires msgpack)
packed = order.model_dump_msgpack()
restored = Order.model_validate_tytx_msgpack(packed)
```

### MessagePack

```python
from genro_tytx.msgpack_utils import packb, unpackb
from decimal import Decimal
from datetime import date

data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}

# Pack to MessagePack bytes with TYTX types
packed = packb(data)

# Unpack with types restored
restored = unpackb(packed)
assert restored["price"] == Decimal("99.99")
assert restored["date"] == date(2025, 1, 15)
```

## Type Codes

| Code | Name | Python Type | Example |
|------|------|-------------|---------|
| `L` | Long integer | `int` | `"123::L"` |
| `R` | Real number | `float` | `"1.5::R"` |
| `N` | Numeric | `Decimal` | `"100.50::N"` |
| `B` | Boolean | `bool` | `"true::B"` |
| `T` | Text | `str` | `"hello::T"` |
| `D` | Date | `date` | `"2025-01-15::D"` |
| `DHZ` | DateTime | `datetime` | `"2025-01-15T10:00:00Z::DHZ"` |
| `DH` | Naive DateTime (deprecated) | `datetime` | `"2025-01-15T10:00::DH"` |
| `H` | Hour | `time` | `"10:30:00::H"` |
| `JS` | JavaScript object | `dict`/`list` | `'{"a":1}::JS'` |

### Typed Arrays

Compact format for homogeneous arrays:

```python
# Parse typed arrays
from_text("[1,2,3]::L")           # → [1, 2, 3]
from_text("[[1,2],[3,4]]::L")     # → [[1, 2], [3, 4]]  (nested)

# Serialize with compact_array
as_typed_text([1, 2, 3], compact_array=True)  # → '["1","2","3"]::L'
```

## Features

- **Zero dependencies**: Python stdlib only (optional extras for performance)
- **Bidirectional**: Parse and serialize typed values
- **Multiple formats**: JSON, XML, MessagePack support
- **Pydantic integration**: `TytxModel` base class for type-preserving serialization
- **Locale formatting**: Format dates/numbers for display
- **Extensible**: Register custom types via `registry.register()`
- **JavaScript**: Matching JS implementation included (`js/`)
- **100% test coverage**: Comprehensive test suite

## Installation

```bash
pip install genro-tytx

# Optional: Pydantic integration
pip install genro-tytx[pydantic]

# Optional: MessagePack support
pip install genro-tytx[msgpack]

# Optional: All extras
pip install genro-tytx[pydantic,msgpack]
```

### JavaScript

```bash
npm install genro-tytx
```

Or use directly:

```javascript
import { from_text, as_typed_text, from_json, as_typed_json } from 'genro-tytx';

from_text("123::L");           // → 123
as_typed_text(123);            // → "123::L"
from_json('{"x": "10::N"}');   // → {x: 10} (Decimal as number in JS)
```

## Custom Types

```python
from genro_tytx import registry
from genro_tytx.base import DataType
import uuid

class UUIDType(DataType):
    name = "uuid"
    code = "U"
    python_type = uuid.UUID

    def parse(self, value: str) -> uuid.UUID:
        return uuid.UUID(value)

    def serialize(self, value: uuid.UUID) -> str:
        return str(value)

registry.register(UUIDType)

# Now works
from_text("550e8400-e29b-41d4-a716-446655440000::U")
# → UUID("550e8400-e29b-41d4-a716-446655440000")
```

## Documentation

📚 **[Full Documentation](https://genro-tytx.readthedocs.io/)** (coming soon)

- [Quick Start](docs/quickstart.md)
- [Type Guide](docs/guide/types.md)
- [JSON Utilities](docs/guide/json.md)
- [XML Utilities](docs/guide/xml.md)
- [MessagePack](docs/guide/msgpack.md)
- [Pydantic Integration](docs/guide/pydantic.md)
- [Custom Types](docs/guide/custom-types.md)
- [API Reference](docs/api/reference.md)

## Development Status

**Beta** - Core implementation complete. API is stabilizing.

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

Copyright 2025 Softwell S.r.l.

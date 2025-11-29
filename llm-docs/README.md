# genro-tytx - 30 Second Guide

## Install

```bash
pip install genro-tytx
```

## Core Concept

TYTX encodes type information in strings using `value::type_code` syntax.
Solves JSON's "stringly typed" problem for Decimal, Date, DateTime.

## Basic Usage

```python
from genro_tytx import from_text, as_typed_text, as_json, from_json

# Parse typed string → Python object
from_text("100.50::D")        # → Decimal("100.50")
from_text("2025-01-15::d")    # → date(2025, 1, 15)
from_text("123::I")           # → 123

# Python object → typed string
as_typed_text(Decimal("99.99"))  # → "99.99::D"
as_typed_text(date(2025, 1, 15)) # → "2025-01-15::d"

# JSON with types
as_typed_json({"price": Decimal("100")})  # → '{"price": "100::D"}'
from_json('{"price": "100::D"}')          # → {"price": Decimal("100")}
```

## Type Codes

| Code | Aliases | Python Type | Example |
|------|---------|-------------|---------|
| `I` | `INT`, `INTEGER`, `LONG` | `int` | `"123::I"` |
| `F` | `R`, `REAL` | `float` | `"1.5::F"` |
| `D` | `N`, `NUMERIC` | `Decimal` | `"100.50::D"` |
| `B` | `BOOL`, `BOOLEAN` | `bool` | `"true::B"` |
| `S` | `T`, `TEXT` | `str` | `"hello::S"` |
| `d` | - | `date` | `"2025-01-15::d"` |
| `dt` | `DH`, `DHZ` | `datetime` | `"2025-01-15T10:00::dt"` |
| `J` | - | `dict`/`list` | `'{"a":1}::J'` |
| `L` | - | `list` | `"a,b,c::L"` |

## Key Features

- **Zero dependencies**: Python stdlib only
- **Bidirectional**: Parse and serialize
- **JSON/XML support**: Full utilities included
- **Locale formatting**: `as_text(value, format="%d/%m/%Y", locale="it_IT")`
- **Extensible**: Register custom types via `registry.register()`

## Next

See [API-DETAILS.md](API-DETAILS.md) for complete reference.

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
from_text("100.50::N")        # → Decimal("100.50")
from_text("2025-01-15::D")    # → date(2025, 1, 15)
from_text("123::L")           # → 123

# Python object → typed string
as_typed_text(Decimal("99.99"))  # → "99.99::N"
as_typed_text(date(2025, 1, 15)) # → "2025-01-15::D"

# JSON with types
as_typed_json({"price": Decimal("100")})  # → '{"price": "100::N"}'
from_json('{"price": "100::N"}')          # → {"price": Decimal("100")}
```

## Type Codes (Genropy-compatible)

| Code | Aliases | Python Type | Example |
|------|---------|-------------|---------|
| `L` | `I`, `INT`, `INTEGER`, `LONG` | `int` | `"123::L"` |
| `R` | `F`, `REAL`, `FLOAT` | `float` | `"1.5::R"` |
| `N` | `NUMERIC`, `DECIMAL` | `Decimal` | `"100.50::N"` |
| `B` | `BOOL`, `BOOLEAN` | `bool` | `"true::B"` |
| `T` | `S`, `TEXT`, `P`, `A` | `str` | `"hello::T"` |
| `D` | `DATE` | `date` | `"2025-01-15::D"` |
| `DH` | `DT`, `DHZ`, `DATETIME` | `datetime` | `"2025-01-15T10:00::DH"` |
| `H` | `TIME`, `HZ` | `time` | `"10:30:00::H"` |
| `JS` | `JSON` | `dict`/`list` | `'{"a":1}::JS'` |

## Key Features

- **Zero dependencies**: Python stdlib only
- **Bidirectional**: Parse and serialize
- **JSON/XML support**: Full utilities included
- **Locale formatting**: `as_text(value, format="%d/%m/%Y", locale="it_IT")`
- **Extensible**: Register custom types via `registry.register()`

## Next

See [API-DETAILS.md](API-DETAILS.md) for complete reference.

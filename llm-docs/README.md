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

## Type Codes

| Code | Name | Python Type | Example |
|------|------|-------------|---------|
| `L` | integer | `int` | `"123::L"` |
| `R` | float | `float` | `"1.5::R"` |
| `N` | decimal | `Decimal` | `"100.50::N"` |
| `B` | bool | `bool` | `"true::B"` |
| `T` | str | `str` | `"hello::T"` |
| `D` | date | `date` | `"2025-01-15::D"` |
| `DHZ` | datetime | `datetime` | `"2025-01-15T10:00:00Z::DHZ"` |
| `H` | time | `time` | `"10:30:00::H"` |
| `TYTX` | tytx | `dict`/`list` | `'{"a":"1::L"}::TYTX'` |

## Typed Arrays

```python
# Parse compact arrays
from_text("[1,2,3]::L")       # → [1, 2, 3]
from_text("[[1,2],[3,4]]::L") # → [[1, 2], [3, 4]]

# Serialize with compact_array
as_typed_text([1, 2, 3], compact_array=True)  # → '["1","2","3"]::L'
```

## Key Features

- **Zero dependencies**: Python stdlib only
- **Bidirectional**: Parse and serialize
- **JSON/XML support**: Full utilities included
- **Locale formatting**: `as_text(value, format="%d/%m/%Y", locale="it_IT")`
- **Extensible**: Register custom types via `registry.register()`

## Next

See [API-DETAILS.md](API-DETAILS.md) for complete reference.

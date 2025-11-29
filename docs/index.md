# genro-tytx

**TYTX (Typed Text)** - A protocol for exchanging typed data over text-based formats.

TYTX solves the "stringly typed" problem of JSON by encoding type information directly into value strings using a concise `value::type_code` syntax.

## The Problem

JSON only supports: string, number, boolean, null. What about `Decimal`, `Date`, `DateTime`?

```json
{
  "price": 100.50,
  "date": "2025-01-15"
}
```

Is `price` a float or a precise Decimal? Is `date` a string or a Date object?

## The TYTX Solution

```json
{
  "price": "100.50::D",
  "date": "2025-01-15::d"
}
```

The `::` suffix encodes type information. After hydration:
- `price` → `Decimal("100.50")`
- `date` → `date(2025, 1, 15)`

## Quick Example

<!-- test: test_core.py::TestFromText::test_from_text_typed_decimal -->

```python
from genro_tytx import from_text, as_typed_text
from decimal import Decimal
from datetime import date

# Parse typed strings
price = from_text("100.50::D")      # → Decimal("100.50")
order_date = from_text("2025-01-15::d")  # → date(2025, 1, 15)

# Serialize with type
as_typed_text(Decimal("99.99"))     # → "99.99::D"
as_typed_text(date(2025, 1, 15))    # → "2025-01-15::d"
```

## Documentation

```{toctree}
:maxdepth: 2

installation
quickstart
guide/index
examples/index
api/reference
faq
```

## Features

- **Zero dependencies**: Python stdlib only (optional orjson/msgpack)
- **Bidirectional**: Parse and serialize typed values
- **Multiple formats**: JSON, XML support built-in
- **Locale formatting**: Format dates/numbers for display
- **Extensible**: Register custom types
- **JavaScript**: Matching JS implementation included

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

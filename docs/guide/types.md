# Built-in Types

TYTX includes 10 built-in types.

## Type Summary

| Code | Name | Python Type | SQL Type | JS Type | Example |
|------|------|-------------|----------|---------|---------|
| `L` | int | `int` | `INTEGER` | `number` | `"123::L"` |
| `R` | float | `float` | `REAL` | `number` | `"3.14::R"` |
| `N` | decimal | `Decimal` | `DECIMAL` | `number` | `"99.99::N"` |
| `B` | bool | `bool` | `BOOLEAN` | `boolean` | `"true::B"` |
| `T` | str | `str` | `VARCHAR` | `string` | `"hello::T"` |
| `D` | date | `date` | `DATE` | `Date` | `"2025-01-15::D"` |
| `DHZ` | datetime | `datetime` | `TIMESTAMP` | `Date` | `"2025-01-15T10:00:00Z::DHZ"` |
| `DH` | naive_datetime | `datetime` | `TIMESTAMP` | `Date` | `"2025-01-15T10:00::DH"` (deprecated) |
| `H` | time | `time` | `TIME` | `Date` | `"10:30:00::H"` |
| `JS` | json | `dict`/`list` | `JSON` | `object`/`array` | `'{"a":1}::JS'` |

## Integer (L)

**Code**: `L` (Long integer)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("123::L")        # → 123

# Serialize
as_typed_text(123)         # → "123::L"
```

## Float (R)

**Code**: `R` (Real number)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("3.14::R")       # → 3.14

# Serialize
as_typed_text(3.14)        # → "3.14::R"
```

## Decimal (N)

**Code**: `N` (Numeric)

Use Decimal for exact numeric values like money.

```python
from decimal import Decimal
from genro_tytx import from_text, as_typed_text

# Parse
from_text("100.50::N")        # → Decimal("100.50")

# Serialize
as_typed_text(Decimal("99.99"))  # → "99.99::N"
```

```{warning}
Use `N` (Decimal) instead of `R` (float) for financial calculations to avoid floating-point precision issues.
```

## Boolean (B)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("true::B")       # → True
from_text("false::B")      # → False

# Serialize
as_typed_text(True)        # → "true::B"
as_typed_text(False)       # → "false::B"
```

## Text (T)

**Code**: `T` (Text)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("hello::T")      # → "hello"

# Serialize - strings have NO type suffix
as_typed_text("hello")     # → "hello" (no ::T)
```

```{note}
Strings are returned as-is by `as_typed_text()` without a type suffix, since the default interpretation of untyped values is string.
```

## Date (D)

**Code**: `D` (Date)

ISO 8601 date format (YYYY-MM-DD).

```python
from datetime import date
from genro_tytx import from_text, as_typed_text

# Parse
from_text("2025-01-15::D")     # → date(2025, 1, 15)

# Serialize
as_typed_text(date(2025, 1, 15))  # → "2025-01-15::D"
```

## DateTime (DHZ)

**Code**: `DHZ` (DateTime with Zone - canonical)

ISO 8601 datetime format with timezone. Always serialized with Z suffix (UTC).

```python
from datetime import datetime
from genro_tytx import from_text, as_typed_text

# Parse
from_text("2025-01-15T10:00:00Z::DHZ")  # → datetime(2025, 1, 15, 10, 0, 0)

# Serialize
as_typed_text(datetime(2025, 1, 15, 10, 30))  # → "2025-01-15T10:30:00Z::DHZ"
```

## Naive DateTime (DH) - Deprecated

**Code**: `DH` (DateTime without timezone)

```{warning}
`DH` is deprecated. Use `DHZ` for new code.
```

```python
from datetime import datetime
from genro_tytx import from_text

# Parse
from_text("2025-01-15T10:00:00::DH")  # → datetime(2025, 1, 15, 10, 0, 0)
```

## Time (H)

**Code**: `H` (Hour)

ISO 8601 time format.

```python
from datetime import time
from genro_tytx import from_text, as_typed_text

# Parse
from_text("10:30:00::H")     # → time(10, 30, 0)

# Serialize
as_typed_text(time(10, 30))  # → "10:30:00::H"
```

## JSON (JS)

**Code**: `JS` (JavaScript object)

Embedded JSON for complex structures.

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text('{"a":1}::JS')    # → {"a": 1}
from_text('[1,2,3]::JS')    # → [1, 2, 3]

# Serialize
as_typed_text({"a": 1})    # → '{"a": 1}::JS'
as_typed_text([1, 2, 3])   # → '[1, 2, 3]::JS'
```

## Type Attributes

Each type class has these attributes:

| Attribute | Description |
|-----------|-------------|
| `name` | Human-readable name |
| `code` | TYTX type code (e.g., `"L"`, `"N"`) |
| `python_type` | Python type class |
| `sql_type` | SQL column type |
| `align` | Display alignment (`"L"`, `"R"`, `"C"`) |
| `empty` | Default empty value |
| `js_type` | JavaScript equivalent type |
| `default_format` | Default locale format string |

Example:

```python
from genro_tytx import IntType, DecimalType

IntType.code           # → "L"
IntType.python_type    # → int
IntType.sql_type       # → "INTEGER"
IntType.align          # → "R"
IntType.empty          # → 0

DecimalType.code       # → "N"
DecimalType.python_type  # → Decimal
DecimalType.sql_type   # → "DECIMAL"
```

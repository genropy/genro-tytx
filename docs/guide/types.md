# Built-in Types

TYTX includes 9 built-in types aligned with the Genropy framework.

## Type Summary

| Code | Name | Python Type | SQL Type | JS Type | Example |
|------|------|-------------|----------|---------|---------|
| `L` | integer | `int` | `INTEGER` | `number` | `"123::L"` |
| `R` | float | `float` | `REAL` | `number` | `"3.14::R"` |
| `N` | decimal | `Decimal` | `DECIMAL` | `number` | `"99.99::N"` |
| `B` | boolean | `bool` | `BOOLEAN` | `boolean` | `"true::B"` |
| `T` | text | `str` | `VARCHAR` | `string` | `"hello::T"` |
| `D` | date | `date` | `DATE` | `Date` | `"2025-01-15::D"` |
| `DH` | datetime | `datetime` | `TIMESTAMP` | `Date` | `"2025-01-15T10:00::DH"` |
| `H` | time | `time` | `TIME` | `string` | `"10:30:00::H"` |
| `JS` | json | `dict`/`list` | `JSON` | `object`/`array` | `'{"a":1}::JS'` |

## Integer (L)

**Genropy code**: `L` (Long)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("123::L")        # → 123
from_text("123::I")        # → 123 (alias)
from_text("123::INT")      # → 123 (alias)
from_text("123::INTEGER")  # → 123 (alias)

# Serialize
as_typed_text(123)         # → "123::L"
```

**Aliases**: `I`, `INT`, `INTEGER`, `LONG`, `LONGINT`

## Float (R)

**Genropy code**: `R` (Real)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("3.14::R")       # → 3.14
from_text("3.14::F")       # → 3.14 (alias)
from_text("3.14::FLOAT")   # → 3.14 (alias)

# Serialize
as_typed_text(3.14)        # → "3.14::R"
```

**Aliases**: `F`, `FLOAT`, `REAL`

## Decimal (N)

**Genropy code**: `N` (Numeric)

Use Decimal for exact numeric values like money.

```python
from decimal import Decimal
from genro_tytx import from_text, as_typed_text

# Parse
from_text("100.50::N")        # → Decimal("100.50")
from_text("100.50::NUMERIC")  # → Decimal("100.50") (alias)
from_text("100.50::DECIMAL")  # → Decimal("100.50") (alias)

# Serialize
as_typed_text(Decimal("99.99"))  # → "99.99::N"
```

**Aliases**: `NUMERIC`, `DECIMAL`

```{warning}
Use `N` (Decimal) instead of `R` (float) for financial calculations to avoid floating-point precision issues.
```

## Boolean (B)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("true::B")       # → True
from_text("false::B")      # → False
from_text("true::BOOL")    # → True (alias)
from_text("true::BOOLEAN") # → True (alias)

# Serialize
as_typed_text(True)        # → "true::B"
as_typed_text(False)       # → "false::B"
```

**Aliases**: `BOOL`, `BOOLEAN`

## Text (T)

**Genropy code**: `T` (Text)

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("hello::T")      # → "hello"
from_text("hello::S")      # → "hello" (alias)
from_text("hello::TEXT")   # → "hello" (alias)

# Serialize - strings have NO type suffix
as_typed_text("hello")     # → "hello" (no ::T)
```

**Aliases**: `S`, `STRING`, `TEXT`, `P`, `A`

```{note}
Strings are returned as-is by `as_typed_text()` without a type suffix, since the default interpretation of untyped values is string.
```

## Date (D)

**Genropy code**: `D` (Date)

ISO 8601 date format (YYYY-MM-DD).

```python
from datetime import date
from genro_tytx import from_text, as_typed_text

# Parse
from_text("2025-01-15::D")     # → date(2025, 1, 15)
from_text("2025-01-15::DATE")  # → date(2025, 1, 15) (alias)

# Serialize
as_typed_text(date(2025, 1, 15))  # → "2025-01-15::D"
```

**Aliases**: `DATE`

## DateTime (DH)

**Genropy code**: `DH` (Date with Hour)

ISO 8601 datetime format.

```python
from datetime import datetime
from genro_tytx import from_text, as_typed_text

# Parse
from_text("2025-01-15T10:00:00::DH")    # → datetime(2025, 1, 15, 10, 0, 0)
from_text("2025-01-15T10:00:00::DT")    # → datetime (alias)
from_text("2025-01-15T10:00:00::DHZ")   # → datetime (alias)
from_text("2025-01-15T10:00:00::DATETIME")  # → datetime (alias)

# Serialize
as_typed_text(datetime(2025, 1, 15, 10, 30))  # → "2025-01-15T10:30:00::DH"
```

**Aliases**: `DT`, `DHZ`, `DATETIME`, `timestamp`

## Time (H)

**Genropy code**: `H` (Hour)

ISO 8601 time format.

```python
from datetime import time
from genro_tytx import from_text, as_typed_text

# Parse
from_text("10:30:00::H")     # → time(10, 30, 0)
from_text("10:30:00::TIME")  # → time(10, 30, 0) (alias)

# Serialize
as_typed_text(time(10, 30))  # → "10:30:00::H"
```

**Aliases**: `TIME`, `HZ`

## JSON (JS)

**Genropy code**: `JS` (JavaScript object)

Embedded JSON for complex structures.

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text('{"a":1}::JS')    # → {"a": 1}
from_text('[1,2,3]::JS')    # → [1, 2, 3]
from_text('{"a":1}::JSON')  # → {"a": 1} (alias)

# Serialize
as_typed_text({"a": 1})    # → '{"a": 1}::JS'
as_typed_text([1, 2, 3])   # → '[1, 2, 3]::JS'
```

**Aliases**: `JSON`

## Type Attributes

Each type class has these attributes:

| Attribute | Description |
|-----------|-------------|
| `name` | Human-readable name |
| `code` | TYTX type code (e.g., `"L"`, `"N"`) |
| `aliases` | Alternative codes |
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

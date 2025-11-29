# Built-in Types

TYTX includes 9 built-in types that cover common data types.

## Type Summary

| Code | Name | Python Type | SQL Type | Align | Empty |
|------|------|-------------|----------|-------|-------|
| `I` | integer | `int` | `INTEGER` | R | `0` |
| `F` | float | `float` | `FLOAT` | R | `0.0` |
| `D` | decimal | `Decimal` | `DECIMAL` | R | `Decimal("0")` |
| `B` | boolean | `bool` | `BOOLEAN` | L | `False` |
| `S` | string | `str` | `VARCHAR` | L | `""` |
| `d` | date | `date` | `DATE` | L | `None` |
| `dt` | datetime | `datetime` | `TIMESTAMP` | L | `None` |
| `J` | json | `dict` | `JSON` | L | `None` |
| `L` | list | `list` | `TEXT` | L | `[]` |

## Integer (I)

<!-- test: test_core.py::TestTypeAttributes::test_int_attributes -->

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("123::I")        # → 123
from_text("123::int")      # → 123
from_text("123::INTEGER")  # → 123
from_text("123::LONG")     # → 123

# Serialize
as_typed_text(123)         # → "123::I"
```

**Aliases**: `int`, `INT`, `INTEGER`, `LONG`

## Float (F)

<!-- test: test_core.py::TestFromText::test_from_text_typed_float -->

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("123.45::F")     # → 123.45
from_text("1.5::R")        # → 1.5 (REAL alias)
from_text("1.5::REAL")     # → 1.5

# Serialize
as_typed_text(123.45)      # → "123.45::F"
```

**Aliases**: `float`, `R`, `REAL`

## Decimal (D)

<!-- test: test_core.py::TestTypeAttributes::test_decimal_attributes -->

Use Decimal for exact numeric values like money.

```python
from decimal import Decimal
from genro_tytx import from_text, as_typed_text

# Parse
from_text("100.50::D")     # → Decimal("100.50")
from_text("100.50::N")     # → Decimal("100.50") (NUMERIC alias)
from_text("100.50::NUMERIC")  # → Decimal("100.50")

# Serialize
as_typed_text(Decimal("99.99"))  # → "99.99::D"
```

**Aliases**: `decimal`, `N`, `NUMERIC`

```{warning}
Use `D` (Decimal) instead of `F` (float) for financial calculations to avoid floating-point precision issues.
```

## Boolean (B)

<!-- test: test_core.py::TestFromText::test_from_text_typed_bool -->

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("true::B")       # → True
from_text("false::B")      # → False
from_text("true::BOOL")    # → True
from_text("true::BOOLEAN") # → True

# Serialize
as_typed_text(True)        # → "true::B"
as_typed_text(False)       # → "false::B"
```

**Aliases**: `bool`, `BOOL`, `BOOLEAN`

## String (S)

<!-- test: test_core.py::TestTypeAttributes::test_str_attributes -->

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("hello::S")      # → "hello"
from_text("hello::T")      # → "hello" (TEXT alias)
from_text("hello::TEXT")   # → "hello"

# Serialize - strings have NO type suffix
as_typed_text("hello")     # → "hello" (no ::S)
```

**Aliases**: `str`, `T`, `TEXT`

```{note}
Strings are returned as-is by `as_typed_text()` without a type suffix, since the default interpretation of untyped values is string.
```

## Date (d)

<!-- test: test_core.py::TestTypeAttributes::test_date_attributes -->

ISO 8601 date format (YYYY-MM-DD).

```python
from datetime import date
from genro_tytx import from_text, as_typed_text

# Parse
from_text("2025-01-15::d")  # → date(2025, 1, 15)

# Serialize
as_typed_text(date(2025, 1, 15))  # → "2025-01-15::d"
```

**Default format**: `%x` (locale date)

## DateTime (dt)

<!-- test: test_core.py::TestTypeAttributes::test_datetime_attributes -->

ISO 8601 datetime format.

```python
from datetime import datetime
from genro_tytx import from_text, as_typed_text

# Parse
from_text("2025-01-15T10:00:00::dt")  # → datetime(2025, 1, 15, 10, 0, 0)
from_text("2025-01-15T10:00:00::DH")  # → datetime (Genropy alias)
from_text("2025-01-15T10:00:00::DHZ") # → datetime (Genropy alias)

# Serialize
as_typed_text(datetime(2025, 1, 15, 10, 30))  # → "2025-01-15T10:30:00::dt"
```

**Aliases**: `datetime`, `DH`, `DHZ`
**Default format**: `%x %X` (locale date + time)

## JSON (J)

<!-- test: test_core.py::TestFromText::test_from_text_typed_json -->

Embedded JSON for complex structures.

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text('{"a":1}::J')    # → {"a": 1}
from_text('[1,2,3]::J')    # → [1, 2, 3]

# Serialize
as_typed_text({"a": 1})    # → '{"a": 1}::J'
as_typed_text([1, 2, 3])   # → '[1, 2, 3]::J'
```

## List (L)

<!-- test: test_core.py::TestFromText::test_from_text_typed_list -->

Comma-separated list of strings.

```python
from genro_tytx import from_text, as_typed_text

# Parse
from_text("a,b,c::L")      # → ["a", "b", "c"]
from_text("::L")           # → [] (empty list)

# Serialize
from genro_tytx import ListType
lt = ListType()
lt.serialize(["a", "b", "c"])  # → "a,b,c"
```

```{note}
For complex lists with non-string elements, use JSON type (`J`) instead.
```

## Type Attributes

Each type class has these attributes:

| Attribute | Description |
|-----------|-------------|
| `name` | Human-readable name |
| `code` | TYTX type code (e.g., `"I"`, `"D"`) |
| `aliases` | Alternative codes (e.g., `["int", "INTEGER"]`) |
| `python_type` | Python type class |
| `sql_type` | SQL column type |
| `align` | Display alignment (`"L"`, `"R"`, `"C"`) |
| `empty` | Default empty value |
| `js_type` | JavaScript equivalent type |
| `default_format` | Default locale format string |

Example:

```python
from genro_tytx import IntType, DecimalType

IntType.code           # → "I"
IntType.python_type    # → int
IntType.sql_type       # → "INTEGER"
IntType.align          # → "R"
IntType.empty          # → 0

DecimalType.code       # → "D"
DecimalType.python_type  # → Decimal
DecimalType.sql_type   # → "DECIMAL"
```

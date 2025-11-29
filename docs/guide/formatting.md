# Type Formatting

TYTX supports locale-aware formatting for displaying values.

## Format Parameter

<!-- test: test_core.py::TestAsTextFormatting -->

The `as_text()` function accepts a `format` parameter:

| Value | Behavior |
|-------|----------|
| `None` (default) | ISO/technical output |
| `True` | Use type's default format |
| `str` | Use specific format string |

## ISO Output (format=None)

<!-- test: test_core.py::TestAsTextFormatting::test_as_text_format_none_returns_iso -->

Without format parameter, values serialize to ISO/technical format:

```python
from genro_tytx import as_text
from datetime import date, datetime
from decimal import Decimal

as_text(date(2025, 1, 15))              # → "2025-01-15"
as_text(datetime(2025, 1, 15, 10, 30))  # → "2025-01-15T10:30:00"
as_text(123)                             # → "123"
as_text(Decimal("1234.56"))             # → "1234.56"
```

Use ISO output for:
- API responses
- Database storage
- File exports
- Data interchange

## Default Format (format=True)

<!-- test: test_core.py::TestAsTextFormatting::test_as_text_format_true_uses_default -->

With `format=True`, types use their `default_format`:

```python
from genro_tytx import as_text
from datetime import date, datetime

# Dates use %x (locale date)
result = as_text(date(2025, 1, 15), format=True)
# Result depends on system locale, e.g., "01/15/2025" or "15/01/2025"

# DateTimes use %x %X (locale date + time)
result = as_text(datetime(2025, 1, 15, 10, 30), format=True)
# Result depends on system locale
```

## Custom Format Strings

<!-- test: test_core.py::TestAsTextFormatting::test_as_text_format_string -->

Pass a format string for specific formatting:

### Date Formatting

```python
from genro_tytx import as_text
from datetime import date

d = date(2025, 1, 15)

as_text(d, format="%d/%m/%Y")      # → "15/01/2025"
as_text(d, format="%Y-%m-%d")      # → "2025-01-15"
as_text(d, format="%B %d, %Y")     # → "January 15, 2025"
as_text(d, format="%A")            # → "Wednesday"
```

### DateTime Formatting

```python
from genro_tytx import as_text
from datetime import datetime

dt = datetime(2025, 1, 15, 10, 30, 45)

as_text(dt, format="%Y-%m-%d %H:%M")     # → "2025-01-15 10:30"
as_text(dt, format="%d/%m/%Y %H:%M:%S")  # → "15/01/2025 10:30:45"
as_text(dt, format="%I:%M %p")           # → "10:30 AM"
```

### Numeric Formatting

```python
from genro_tytx import as_text
from decimal import Decimal

as_text(1234567, format="%d")       # → "1234567" (locale-aware)
as_text(Decimal("1234.56"), format="%.2f")  # → "1234.56"
```

## Locale Parameter

<!-- test: test_core.py::TestEdgeCases::test_as_text_with_format_and_locale -->

Specify locale for formatting:

```python
from genro_tytx import as_text
from datetime import date

d = date(2025, 1, 15)

# US format
as_text(d, format="%d/%m/%Y", locale="en_US")  # → "15/01/2025"

# Italian format
as_text(d, format="%d/%m/%Y", locale="it_IT")  # → "15/01/2025"

# C locale (neutral)
as_text(d, format="%d-%m-%Y", locale="C")      # → "15-01-2025"
```

## Format Strings Reference

### Date/Time Format Codes

| Code | Meaning | Example |
|------|---------|---------|
| `%Y` | 4-digit year | 2025 |
| `%y` | 2-digit year | 25 |
| `%m` | Month (01-12) | 01 |
| `%d` | Day (01-31) | 15 |
| `%H` | Hour 24h (00-23) | 10 |
| `%I` | Hour 12h (01-12) | 10 |
| `%M` | Minute (00-59) | 30 |
| `%S` | Second (00-59) | 45 |
| `%p` | AM/PM | AM |
| `%A` | Weekday name | Wednesday |
| `%B` | Month name | January |
| `%x` | Locale date | varies |
| `%X` | Locale time | varies |

### Numeric Format Codes

| Code | Meaning | Example |
|------|---------|---------|
| `%d` | Integer | 1234567 |
| `%f` | Float | 1234.560000 |
| `%.2f` | Float (2 decimals) | 1234.56 |
| `%e` | Scientific | 1.234560e+06 |

## Strings Ignore Format

<!-- test: test_core.py::TestAsTextFormatting::test_as_text_string_ignores_format -->

String values return as-is regardless of format:

```python
from genro_tytx import as_text

as_text("hello", format=True)   # → "hello"
as_text("hello", format="%s")   # → "hello"
```

## Best Practices

1. **Use ISO for storage/interchange**: `as_text(value)` without format
2. **Use format for display**: `as_text(value, format=True)` or custom format
3. **Specify locale explicitly** when formatting for specific audiences
4. **Test locale availability** - not all locales are installed on all systems

# Type Registry

The registry manages type registration and lookup.

## Global Registry

TYTX provides a global registry with built-in types:

```python
from genro_tytx import registry

# Use registry methods
registry.from_text("123::L")         # → 123
registry.as_typed_text(123)          # → "123::L"
registry.get("L")                    # → IntType
registry.is_typed("123::L")          # → True
```

## Registry Methods

### get(name_or_code)

<!-- test: test_core.py::TestEdgeCases::test_registry_get_none -->

Get type class by name or code:

```python
from genro_tytx import registry

registry.get("L")         # → IntType (L = Long)
registry.get("int")       # → IntType
registry.get("N")         # → DecimalType (N = Numeric)
registry.get("UNKNOWN")   # → None
```

### get_for_value(value)

<!-- test: test_core.py::TestEdgeCases::test_registry_get_for_value -->

Get type class for a Python value:

```python
from genro_tytx import registry
from decimal import Decimal
from datetime import date

registry.get_for_value(42)              # → IntType (code L)
registry.get_for_value(1.5)             # → FloatType (code R)
registry.get_for_value(Decimal("10"))   # → DecimalType (code N)
registry.get_for_value(date.today())    # → DateType (code D)
registry.get_for_value("hello")         # → StrType (code T)
registry.get_for_value({"a": 1})        # → JsonType (code JS)

# Unknown types
registry.get_for_value(object())        # → None
```

### is_typed(value)

<!-- test: test_core.py::TestRegistryHelpers::test_is_typed -->

Check if string has valid TYTX type suffix:

```python
from genro_tytx import registry

registry.is_typed("123::L")        # → True
registry.is_typed("hello::T")      # → True
registry.is_typed("100.50::N")     # → True

registry.is_typed("123")           # → False (no type)
registry.is_typed("hello::BOGUS")  # → False (unknown type)
```

### register_class(code, cls, serialize, parse)

Register a custom class with the `~` prefix:

```python
from genro_tytx import registry
import uuid

registry.register_class(
    code="UUID",  # becomes "~UUID" in wire format
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)

# Now available
registry.get("~UUID")                                    # → type info
registry.from_text("550e8400-e29b-41d4-a716-446655440000::~UUID")  # → UUID
```

See [type-codes.md](../../spec/type-codes.md#custom-types--prefix) for complete documentation.

### unregister_class(code)

Remove a previously registered custom type:

```python
from genro_tytx import registry

registry.unregister_class("UUID")  # removes ~UUID
```

### register_struct(code, schema)

Register a struct schema with the `@` prefix:

```python
from genro_tytx import registry

# Dict schema - keys map to types
registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N', 'created': 'D'})

# List positional schema - types by position
registry.register_struct('ROW', ['T', 'L', 'N'])

# List homogeneous schema - one type for all elements
registry.register_struct('PRICES', ['N'])

# String schema (named) - CSV-like data → dict output
registry.register_struct('POINT', 'x:R,y:R')

# String schema (anonymous) - CSV-like data → list output
registry.register_struct('COORDS', 'R,R')
```

Usage:

```python
# Dict schema
registry.from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100"), ...}

# String schema (named fields)
registry.from_text('["3.7", "7.3"]::@POINT')
# → {"x": 3.7, "y": 7.3}

# Array of structs with #@
registry.from_text('[["A", "1"], ["B", "2"]]::#@POINT')
# → [{"x": "A", "y": 1}, {"x": "B", "y": 2}]
```

See [structs.md](../../spec/structs.md) for complete documentation.

### unregister_struct(code)

Remove a previously registered struct:

```python
from genro_tytx import registry

registry.unregister_struct("CUSTOMER")  # removes @CUSTOMER
```

### get_struct(code)

Get struct schema by code:

```python
from genro_tytx import registry

registry.get_struct("CUSTOMER")  # → {'name': 'T', 'balance': 'N', ...}
registry.get_struct("UNKNOWN")   # → None
```

### from_text(value, type_code=None)

Parse typed string:

```python
from genro_tytx import registry

# With embedded type
registry.from_text("123::L")           # → 123
registry.from_text("100.50::N")        # → Decimal("100.50")

# With explicit type
registry.from_text("123", "L")         # → 123

# No type → string
registry.from_text("hello")            # → "hello"
```

### as_text(value, format=None, locale=None)

Serialize without type suffix:

```python
from genro_tytx import registry
from datetime import date

registry.as_text(123)                  # → "123"
registry.as_text(date(2025, 1, 15))    # → "2025-01-15"

# With format
registry.as_text(date(2025, 1, 15), format="%d/%m/%Y")  # → "15/01/2025"
```

### as_typed_text(value)

Serialize with type suffix:

```python
from genro_tytx import registry

registry.as_typed_text(123)            # → "123::L"
registry.as_typed_text(Decimal("100")) # → "100::N"
registry.as_typed_text("hello")        # → "hello" (no suffix)
```

## Custom Registry

Create isolated registries for specific use cases:

```python
from genro_tytx import TypeRegistry
from genro_tytx.builtin import IntType, DecimalType

# Empty registry
my_registry = TypeRegistry()

# Register only needed built-in types
my_registry.register(IntType)
my_registry.register(DecimalType)

# Register custom extension types
my_registry.register_class(
    code="INV",
    cls=Invoice,
    serialize=lambda inv: f"{inv.id}|{inv.total}",
    parse=lambda s: Invoice(*s.split("|"))
)

# Register struct schemas
my_registry.register_struct('POINT', 'x:R,y:R')

# Use custom registry
my_registry.from_text("123::L")              # → 123
my_registry.from_text("hello::T")            # → "hello::T" (StrType not registered)
my_registry.from_text("1|100::~INV")         # → Invoice(1, 100)
my_registry.from_text('["1", "2"]::@POINT')  # → {"x": 1.0, "y": 2.0}
```

## Fallback Behavior

<!-- test: test_core.py::TestEdgeCases::test_as_text_with_unregistered_type_code -->

When type is not found:

```python
from genro_tytx import TypeRegistry

empty_registry = TypeRegistry()

# from_text returns original string
empty_registry.from_text("123::L")     # → "123::L"

# as_text uses str()
empty_registry.as_text(123)            # → "123"

# as_typed_text uses str() without suffix
empty_registry.as_typed_text(123)      # → "123"
```

## Type Priority

When multiple types could match a value:

1. `python_type` exact match takes priority
2. First registered type wins for conflicts
3. `None` python_type types only match explicit codes

```python
from genro_tytx import registry

# int matches IntType (exact python_type match)
registry.get_for_value(123)            # → IntType (code L)

# bool is subclass of int, but matches BoolType
registry.get_for_value(True)           # → BoolType (code B)

# dict matches JsonType
registry.get_for_value({"a": 1})       # → JsonType (code JS)
```

## Built-in Types in Global Registry

The global registry includes:

| Type | Code | Name |
|------|------|------|
| IntType | `L` | int |
| FloatType | `R` | float |
| DecimalType | `N` | decimal |
| BoolType | `B` | bool |
| StrType | `T` | str |
| DateType | `D` | date |
| DateTimeType | `DHZ` | datetime |
| NaiveDateTimeType | `DH` | naive_datetime (deprecated) |
| TimeType | `H` | time |
| JsonType | `JS` | json |

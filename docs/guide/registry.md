# Type Registry

The registry manages type registration and lookup.

## Global Registry

TYTX provides a global registry with built-in types:

```python
from genro_tytx import registry

# Use registry methods
registry.from_text("123::I")         # → 123
registry.as_typed_text(123)          # → "123::I"
registry.get("I")                    # → IntType
registry.is_typed("123::I")          # → True
```

## Registry Methods

### get(name_or_code)

<!-- test: test_core.py::TestEdgeCases::test_registry_get_none -->

Get type class by name, code, or alias:

```python
from genro_tytx import registry

registry.get("I")         # → IntType
registry.get("int")       # → IntType
registry.get("INTEGER")   # → IntType
registry.get("D")         # → DecimalType
registry.get("UNKNOWN")   # → None
```

### get_for_value(value)

<!-- test: test_core.py::TestEdgeCases::test_registry_get_for_value -->

Get type class for a Python value:

```python
from genro_tytx import registry
from decimal import Decimal
from datetime import date

registry.get_for_value(42)              # → IntType
registry.get_for_value(1.5)             # → FloatType
registry.get_for_value(Decimal("10"))   # → DecimalType
registry.get_for_value(date.today())    # → DateType
registry.get_for_value("hello")         # → StrType
registry.get_for_value([1, 2, 3])       # → ListType
registry.get_for_value({"a": 1})        # → JsonType

# Unknown types
registry.get_for_value(object())        # → None
```

### is_typed(value)

<!-- test: test_core.py::TestRegistryHelpers::test_is_typed -->

Check if string has valid TYTX type suffix:

```python
from genro_tytx import registry

registry.is_typed("123::I")        # → True
registry.is_typed("hello::S")      # → True
registry.is_typed("100.50::D")     # → True

registry.is_typed("123")           # → False (no type)
registry.is_typed("hello::BOGUS")  # → False (unknown type)
```

### register(type_class)

<!-- test: test_core.py::TestEdgeCases::test_register_type_without_python_type -->

Register a custom type:

```python
from genro_tytx import registry
from genro_tytx.base import DataType

class MyType(DataType):
    name = "mytype"
    code = "MY"
    python_type = MyClass

    def parse(self, value: str) -> MyClass:
        return MyClass(value)

    def serialize(self, value: MyClass) -> str:
        return str(value)

registry.register(MyType)

# Now available
registry.get("MY")                 # → MyType
registry.from_text("value::MY")    # → MyClass instance
```

### from_text(value, type_code=None)

Parse typed string:

```python
from genro_tytx import registry

# With embedded type
registry.from_text("123::I")           # → 123
registry.from_text("100.50::D")        # → Decimal("100.50")

# With explicit type
registry.from_text("123", "I")         # → 123

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

registry.as_typed_text(123)            # → "123::I"
registry.as_typed_text(Decimal("100")) # → "100::D"
registry.as_typed_text("hello")        # → "hello" (no suffix)
```

## Custom Registry

Create isolated type sets:

```python
from genro_tytx import TypeRegistry

# Empty registry
my_registry = TypeRegistry()

# Register only needed types
from genro_tytx import IntType, DecimalType
my_registry.register(IntType)
my_registry.register(DecimalType)

# Use custom registry
my_registry.from_text("123::I")        # → 123
my_registry.from_text("hello::S")      # → "hello::S" (StrType not registered)
```

## Fallback Behavior

<!-- test: test_core.py::TestEdgeCases::test_as_text_with_unregistered_type_code -->

When type is not found:

```python
from genro_tytx import TypeRegistry

empty_registry = TypeRegistry()

# from_text returns original string
empty_registry.from_text("123::I")     # → "123::I"

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
registry.get_for_value(123)            # → IntType

# bool is subclass of int, but matches BoolType
registry.get_for_value(True)           # → BoolType

# list matches ListType
registry.get_for_value([1, 2, 3])      # → ListType

# dict matches JsonType
registry.get_for_value({"a": 1})       # → JsonType
```

## Built-in Types in Global Registry

The global registry includes:

| Type | Code | Aliases |
|------|------|---------|
| IntType | `I` | `int`, `INT`, `INTEGER`, `LONG` |
| FloatType | `F` | `float`, `R`, `REAL` |
| DecimalType | `D` | `decimal`, `N`, `NUMERIC` |
| BoolType | `B` | `bool`, `BOOL`, `BOOLEAN` |
| StrType | `S` | `str`, `T`, `TEXT` |
| DateType | `d` | `date` |
| DateTimeType | `dt` | `datetime`, `DH`, `DHZ` |
| JsonType | `J` | `json` |
| ListType | `L` | `list` |

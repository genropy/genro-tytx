# Custom Types

Register your own types with TYTX.

## Creating a Custom Type

<!-- test: test_core.py::TestEdgeCases::test_register_type_without_python_type -->

Extend `DataType` base class:

```python
import uuid
from genro_tytx import TypeRegistry
from genro_tytx.base import DataType

class UUIDType(DataType):
    """UUID type for TYTX."""

    # Required attributes
    name = "uuid"
    code = "U"

    # Optional attributes
    python_type = uuid.UUID
    sql_type = "UUID"
    align = "L"
    empty = None
    js_type = "string"

    def parse(self, value: str) -> uuid.UUID:
        """Parse string to UUID."""
        return uuid.UUID(value)

    def serialize(self, value: uuid.UUID) -> str:
        """Serialize UUID to string."""
        return str(value)
```

## Required Methods

### parse(value: str) -> Any

Convert string representation to Python object.

```python
def parse(self, value: str) -> uuid.UUID:
    return uuid.UUID(value)
```

### serialize(value: Any) -> str

Convert Python object to string representation.

```python
def serialize(self, value: uuid.UUID) -> str:
    return str(value)
```

## Optional Method: format

For locale-aware formatting:

```python
def format(
    self,
    value: Any,
    fmt: str | bool | None = None,
    locale: str | None = None
) -> str:
    """Format value for display."""
    if fmt is None:
        return self.serialize(value)
    # Custom formatting logic
    return formatted_value
```

## Class Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | Yes | - | Human-readable name |
| `code` | Yes | - | Type code (e.g., `"U"`) |
| `python_type` | No | `None` | Python type class |
| `sql_type` | No | `"VARCHAR"` | SQL column type |
| `align` | No | `"L"` | Display alignment |
| `empty` | No | `None` | Default empty value |
| `js_type` | No | `"string"` | JavaScript type |
| `default_format` | No | `None` | Default format string |

## Registering Types

### Global Registry

```python
from genro_tytx import registry

# Register type
registry.register(UUIDType)

# Now works globally
from genro_tytx import from_text, as_typed_text

from_text("550e8400-e29b-41d4-a716-446655440000::U")
# → UUID("550e8400-e29b-41d4-a716-446655440000")

as_typed_text(uuid.uuid4())
# → "550e8400-e29b-41d4-a716-446655440000::U"
```

### Custom Registry

For isolated type sets:

```python
from genro_tytx import TypeRegistry

my_registry = TypeRegistry()
my_registry.register(UUIDType)

# Use custom registry methods
my_registry.from_text("550e8400-e29b-41d4-a716-446655440000::U")
my_registry.as_typed_text(some_uuid)
```

## Complete Example: Money Type

```python
from decimal import Decimal
from genro_tytx import TypeRegistry
from genro_tytx.base import DataType

class MoneyType(DataType):
    """Money type with currency."""

    name = "money"
    code = "M"
    python_type = tuple  # (amount, currency)
    sql_type = "DECIMAL"
    align = "R"
    empty = (Decimal("0"), "USD")

    def parse(self, value: str) -> tuple[Decimal, str]:
        """Parse '100.00 USD' to (Decimal, str)."""
        parts = value.rsplit(" ", 1)
        if len(parts) == 2:
            return (Decimal(parts[0]), parts[1])
        return (Decimal(value), "USD")

    def serialize(self, value: tuple[Decimal, str]) -> str:
        """Serialize (Decimal, str) to '100.00 USD'."""
        amount, currency = value
        return f"{amount} {currency}"

    def format(
        self,
        value: tuple[Decimal, str],
        fmt: str | bool | None = None,
        locale: str | None = None
    ) -> str:
        """Format for display."""
        amount, currency = value
        if fmt is None:
            return self.serialize(value)
        # Could use locale for currency symbol
        return f"{currency} {amount:,.2f}"

# Register and use
from genro_tytx import registry
registry.register(MoneyType)

from genro_tytx import from_text, as_typed_text

from_text("100.00 EUR::M")
# → (Decimal("100.00"), "EUR")

as_typed_text((Decimal("99.99"), "USD"))
# → "99.99 USD::M"
```

## Type Without python_type

For types that don't map to a specific Python class:

```python
class TagType(DataType):
    name = "tag"
    code = "TAG"
    python_type = None  # No auto-detection

    def parse(self, value: str) -> str:
        return value.lower().strip()

    def serialize(self, value: str) -> str:
        return value

# Works with explicit type code
from_text("HELLO::TAG")  # → "hello"

# But auto-detection won't work
registry.get_for_value("hello")  # → StrType, not TagType
```

## Testing Custom Types

```python
import pytest
from genro_tytx import TypeRegistry
from your_module import CustomType

def test_custom_type_parse():
    registry = TypeRegistry()
    registry.register(CustomType)

    result = registry.from_text("value::CODE")
    assert isinstance(result, ExpectedType)

def test_custom_type_serialize():
    registry = TypeRegistry()
    registry.register(CustomType)

    result = registry.as_typed_text(value)
    assert result == "expected::CODE"

def test_custom_type_roundtrip():
    registry = TypeRegistry()
    registry.register(CustomType)

    original = some_value
    serialized = registry.as_typed_text(original)
    restored = registry.from_text(serialized)
    assert restored == original
```

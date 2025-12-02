# Common Patterns

## Pattern: XTYTX Self-Describing Payload

**Problem**: Send data with schema, so receiver doesn't need pre-registered structs
**Solution**: Use XTYTX envelope with `gstruct`/`lstruct` for hydration and `gschema`/`lschema` for validation
**Use Case**: API responses, cross-system data exchange

```python
from genro_tytx import from_json, schema_registry

# Self-contained payload with embedded schema
payload = '''XTYTX://{
    "gstruct": {"ORDER": {"id": "L", "total": "N"}},
    "lstruct": {},
    "gschema": {
        "ORDER": {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "total": {"type": "number", "minimum": 0}
            },
            "required": ["id", "total"]
        }
    },
    "lschema": {},
    "data": "TYTX://{\\"order\\": \\"{\\\\\\"id\\\\\\": \\\\\\"123\\\\\\", \\\\\\"total\\\\\\": \\\\\\"99.99\\\\\\"}::@ORDER\\"}"
}'''

result = from_json(payload)
# result.data → {"order": {"id": 123, "total": Decimal("99.99")}}

# Schema is now globally registered for validation
schema = schema_registry.get("ORDER")
# Use with jsonschema, Ajv, Zod, etc.
```

**Note**: TYTX is transport-only, not a validator. Use `gschema`/`lschema` with external JSON Schema validators.

**Test:** `tests/test_xtytx.py::TestXtytxGschema`, `tests/test_xtytx.py::TestXtytxSchemaWithData`

---

## Pattern: JSON API with Typed Values

**Problem**: Send Decimal/Date over JSON without losing precision/type
**Solution**: Use `as_typed_json()` and `from_json()`
**Use Case**: REST APIs, WebSocket messages

```python
from decimal import Decimal
from datetime import date
from genro_tytx import as_typed_json, from_json

# Serialize for API response
order = {
    "id": 123,
    "price": Decimal("99.99"),
    "date": date(2025, 1, 15),
    "customer": "Acme"
}
json_response = as_typed_json(order)
# '{"id": 123, "price": "99.99::N", "date": "2025-01-15::D", "customer": "Acme"}'

# Parse API request
json_request = '{"price": "150.00::N", "quantity": "5::L"}'
data = from_json(json_request)
# {"price": Decimal("150.00"), "quantity": 5}
```

**Test:** `tests/test_core.py::TestJSONUtils::test_json_roundtrip`

---

## Pattern: XML Config with Types

**Problem**: Parse XML config preserving numeric/date types
**Solution**: Use `from_xml()` with TYTX suffixes
**Use Case**: Configuration files, data import

```python
from genro_tytx import from_xml, as_typed_xml

# Parse config
config_xml = '''
<config>
    <timeout>30::L</timeout>
    <price>99.99::N</price>
    <enabled>true::B</enabled>
</config>
'''
config = from_xml(config_xml)
# config["config"]["value"]["timeout"]["value"] → 30 (int)
# config["config"]["value"]["price"]["value"] → Decimal("99.99")
# config["config"]["value"]["enabled"]["value"] → True

# Generate config
config_data = {
    "settings": {
        "attrs": {"version": 1},
        "value": {
            "max_retries": {"attrs": {}, "value": 3},
            "rate_limit": {"attrs": {}, "value": Decimal("100.50")}
        }
    }
}
xml = as_typed_xml(config_data)
# <settings version="1::L"><max_retries>3::L</max_retries>...
```

**Test:** `tests/test_core.py::TestXMLNewStructure::test_xml_roundtrip`

---

## Pattern: Locale-Aware Formatting

**Problem**: Display dates/numbers in user's locale
**Solution**: Use `as_text(value, format=True, locale="xx_XX")`
**Use Case**: UI display, reports

```python
from datetime import date
from decimal import Decimal
from genro_tytx import as_text

d = date(2025, 1, 15)

# ISO output (for storage/API)
as_text(d)  # → "2025-01-15"

# Locale format (for display)
as_text(d, format="%d/%m/%Y")           # → "15/01/2025"
as_text(d, format="%d/%m/%Y", locale="it_IT")  # → "15/01/2025"

# Custom format
as_text(d, format="%A, %B %d")          # → "Wednesday, January 15"
```

**Test:** `tests/test_core.py::TestAsTextFormatting`

---

## Pattern: Type Detection

**Problem**: Check if string contains typed value
**Solution**: Use `registry.is_typed()`
**Use Case**: Conditional parsing, validation

```python
from genro_tytx import registry, from_text

def process_value(value: str):
    if registry.is_typed(value):
        return from_text(value)  # Parse typed value
    return value  # Keep as string

process_value("123::L")      # → 123
process_value("hello")       # → "hello"
process_value("123::BOGUS")  # → "123::BOGUS" (unknown type)
```

**Test:** `tests/test_core.py::TestRegistryHelpers::test_is_typed`

---

## Pattern: Mnemonic Type Codes

**Problem**: Use intuitive, memorable type codes
**Solution**: Mnemonic codes based on type names
**Use Case**: Easy to remember and read

```python
from genro_tytx import from_text

# Integer (L = Long)
from_text("123::L")      # L → 123

# Float (R = Real)
from_text("1.5::R")      # R → 1.5

# Decimal (N = Numeric)
from_text("100::N")      # N → Decimal("100")

# Date (D = Date)
from_text("2025-01-15::D")  # D → date

# DateTime (DHZ = Date Hour Zulu)
from_text("2025-01-15T10:00:00Z::DHZ")  # DHZ → datetime (canonical)
from_text("2025-01-15T10:00::DH")       # DH → datetime (deprecated, naive)

# String (T = Text)
from_text("hello::T")    # T → "hello"

# Time (H = Hour)
from_text("10:30:00::H")  # H → time

# JSON (JS = JavaScript object)
from_text('{"a":1}::JS')  # JS → dict
```

**Test:** `tests/test_core.py::TestTypeAttributes::test_type_codes`

---

## Pattern: Custom Type Registration

**Problem**: Support application-specific types
**Solution**: Create DataType subclass and register
**Use Case**: UUID, Money, custom enums

```python
import uuid
from genro_tytx import TypeRegistry
from genro_tytx.base import DataType

class UUIDType(DataType):
    name = "uuid"
    code = "U"
    python_type = uuid.UUID
    sql_type = "UUID"

    def parse(self, value: str) -> uuid.UUID:
        return uuid.UUID(value)

    def serialize(self, value: uuid.UUID) -> str:
        return str(value)

# Register
my_registry = TypeRegistry()
my_registry.register(UUIDType)

# Use
my_registry.from_text("550e8400-e29b-41d4-a716-446655440000::U")
# → UUID("550e8400-e29b-41d4-a716-446655440000")
```

**Test:** `tests/test_core.py::TestEdgeCases::test_register_type_without_python_type`

---

## Pattern: Standard JSON Output

**Problem**: Output JSON for systems that don't understand TYTX
**Solution**: Use `as_json()` instead of `as_typed_json()`
**Use Case**: Third-party API integration

```python
from decimal import Decimal
from datetime import date
from genro_tytx import as_json, as_typed_json

data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}

# For TYTX-aware systems
as_typed_json(data)
# '{"price": "99.99::N", "date": "2025-01-15::D"}'

# For standard JSON consumers
as_json(data)
# '{"price": 99.99, "date": "2025-01-15"}'
# Decimal → float, date → ISO string
```

**Test:** `tests/test_core.py::TestJSONUtils::test_as_json_standard`

---

## Pattern: XML Attributes with Types

**Problem**: XML attributes need typed values
**Solution**: Attributes are typed in `as_typed_xml()`
**Use Case**: Typed XML schemas

```python
from decimal import Decimal
from genro_tytx import as_typed_xml, from_xml

# Create XML with typed attributes
data = {
    "product": {
        "attrs": {
            "id": 123,
            "price": Decimal("99.50"),
            "active": True
        },
        "value": "Widget"
    }
}
xml = as_typed_xml(data)
# <product id="123::L" price="99.50::N" active="true::B">Widget</product>

# Parse back
result = from_xml(xml)
# result["product"]["attrs"]["id"] → 123
# result["product"]["attrs"]["price"] → Decimal("99.50")
# result["product"]["attrs"]["active"] → True
```

**Test:** `tests/test_core.py::TestXMLNewStructure::test_as_typed_xml_with_attrs`

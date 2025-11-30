# TYTX API Reference

## Core Functions

### from_text

```python
from_text(value: str, type_code: str | None = None) -> Any
```

Parse typed string to Python object.

**Parameters:**
- `value`: String with optional `::type_code` suffix
- `type_code`: Explicit type (overrides embedded type)

**Returns:** Parsed Python value, or original string if no type

**Examples:**
```python
# Embedded type code
from_text("123::L")           # → 123
from_text("100.50::N")        # → Decimal("100.50")
from_text("2025-01-15::D")    # → date(2025, 1, 15)
from_text("true::B")          # → True
from_text('{"a":1}::JS')      # → {"a": 1}
from_text("10:30:00::H")      # → time(10, 30)

# Explicit type
from_text("123", "L")         # → 123
from_text("2025-01-15", "D")  # → date(2025, 1, 15)

# No type → string
from_text("hello")            # → "hello"

# Unknown type → original string
from_text("hello::UNKNOWN")   # → "hello::UNKNOWN"
```

**Test:** `tests/test_core.py::TestFromText`

---

### as_text

```python
as_text(
    value: Any,
    format: str | bool | None = None,
    locale: str | None = None
) -> str
```

Serialize Python value to string (no type suffix).

**Parameters:**
- `value`: Python value to serialize
- `format`: `None` (ISO), `True` (default format), or format string
- `locale`: Locale for formatting (e.g., `"it_IT"`)

**Returns:** String representation

**Examples:**
```python
# ISO output (format=None)
as_text(123)                    # → "123"
as_text(Decimal("100.50"))      # → "100.50"
as_text(date(2025, 1, 15))      # → "2025-01-15"
as_text(datetime(2025, 1, 15, 10, 30))  # → "2025-01-15T10:30:00"
as_text(True)                   # → "true"
as_text({"a": 1})               # → '{"a": 1}'

# Custom format
as_text(date(2025, 1, 15), format="%d/%m/%Y")  # → "15/01/2025"

# With locale
as_text(date(2025, 1, 15), format="%d/%m/%Y", locale="en_US")  # → "15/01/2025"
```

**Test:** `tests/test_core.py::TestAsText`, `tests/test_core.py::TestAsTextFormatting`

---

### as_typed_text

```python
as_typed_text(value: Any, compact_array: bool = False) -> str
```

Serialize Python value with type suffix.

**Parameters:**
- `value`: Python value to serialize
- `compact_array`: If True, produce compact array format `[1,2,3]::L` for homogeneous arrays

**Returns:** String with `::type_code` suffix (strings return as-is)

**Examples:**
```python
as_typed_text(123)                    # → "123::L"
as_typed_text(1.5)                    # → "1.5::R"
as_typed_text(Decimal("100.50"))      # → "100.50::N"
as_typed_text(date(2025, 1, 15))      # → "2025-01-15::D"
as_typed_text(datetime(2025, 1, 15, 10))  # → "2025-01-15T10:00:00Z::DHZ"
as_typed_text(True)                   # → "true::B"
as_typed_text({"a": 1})               # → '{"a": 1}::JS'
as_typed_text("hello")                # → "hello" (no suffix for strings)

# Typed arrays (compact format)
as_typed_text([1, 2, 3], compact_array=True)  # → '["1","2","3"]::L'
as_typed_text([[1,2],[3,4]], compact_array=True)  # → '[["1","2"],["3","4"]]::L'
```

**Test:** `tests/test_core.py::TestAsTypedText`

---

## JSON Utilities

### as_typed_json

```python
as_typed_json(data: Any) -> str
```

Serialize to JSON with TYTX type suffixes.

**Examples:**
```python
as_typed_json({"price": Decimal("99.99")})
# → '{"price": "99.99::N"}'

as_typed_json({"date": date(2025, 1, 15)})
# → '{"date": "2025-01-15::D"}'

as_typed_json({
    "price": Decimal("100"),
    "date": date(2025, 1, 15),
    "name": "Test"
})
# → '{"price": "100::N", "date": "2025-01-15::D", "name": "Test"}'
```

**Test:** `tests/test_core.py::TestJSONUtils`

---

### as_json

```python
as_json(data: Any) -> str
```

Serialize to standard JSON (no type suffixes).

**Examples:**
```python
as_json({"price": Decimal("99.99"), "date": date(2025, 1, 15)})
# → '{"price": 99.99, "date": "2025-01-15"}'
# Decimal → float, date → ISO string
```

**Test:** `tests/test_core.py::TestJSONUtils::test_as_json_standard`

---

### from_json

```python
from_json(json_str: str) -> Any
```

Parse JSON with TYTX type hydration.

**Examples:**
```python
from_json('{"price": "99.99::N", "count": "42::L"}')
# → {"price": Decimal("99.99"), "count": 42}

from_json('{"order": {"price": "100::N", "date": "2025-01-15::D"}}')
# → {"order": {"price": Decimal("100"), "date": date(2025, 1, 15)}}

from_json('{"prices": ["10::N", "20::N", "30::N"]}')
# → {"prices": [Decimal("10"), Decimal("20"), Decimal("30")]}
```

**Test:** `tests/test_core.py::TestJSONUtils`

---

## XML Utilities

### XML Structure

TYTX uses `{tag: {attrs: {}, value: ...}}` structure:

```python
# Simple element
{"root": {"attrs": {}, "value": "content"}}
# → <root>content</root>

# With attributes
{"root": {"attrs": {"id": 123}, "value": "content"}}
# → <root id="123">content</root>

# Nested
{"order": {
    "attrs": {"id": 1},
    "value": {
        "item": {"attrs": {}, "value": "Widget"},
        "price": {"attrs": {}, "value": Decimal("25.00")}
    }
}}
# → <order id="1"><item>Widget</item><price>25.00</price></order>
```

---

### as_typed_xml

```python
as_typed_xml(data: dict, root_tag: str | None = None) -> str
```

Serialize to XML with TYTX type suffixes.

**Examples:**
```python
data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
as_typed_xml(data)
# → '<root>10.50::N</root>'

data = {"root": {"attrs": {"id": 123, "price": Decimal("99.50")}, "value": "content"}}
as_typed_xml(data)
# → '<root id="123::L" price="99.50::N">content</root>'
```

**Test:** `tests/test_core.py::TestXMLNewStructure`

---

### as_xml

```python
as_xml(data: dict, root_tag: str | None = None) -> str
```

Serialize to standard XML (no type suffixes).

**Examples:**
```python
data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
as_xml(data)
# → '<root>10.50</root>'
```

**Test:** `tests/test_core.py::TestXMLNewStructure::test_as_xml_simple`

---

### from_xml

```python
from_xml(xml_str: str) -> dict
```

Parse XML to `{tag: {attrs: {}, value: ...}}` structure with type hydration.

**Examples:**
```python
from_xml("<root>hello</root>")
# → {"root": {"attrs": {}, "value": "hello"}}

from_xml("<root>10.50::N</root>")
# → {"root": {"attrs": {}, "value": Decimal("10.50")}}

from_xml('<root id="123::L" name="test">content</root>')
# → {"root": {"attrs": {"id": 123, "name": "test"}, "value": "content"}}

from_xml("<order><item>Widget</item><price>25.00::N</price></order>")
# → {"order": {"attrs": {}, "value": {
#       "item": {"attrs": {}, "value": "Widget"},
#       "price": {"attrs": {}, "value": Decimal("25.00")}
#    }}}
```

**Test:** `tests/test_core.py::TestXMLNewStructure`

---

## Registry

### registry.get

```python
registry.get(name_or_code: str) -> type[DataType] | None
```

Get type class by name or code.

**Examples:**
```python
registry.get("L")         # → IntType
registry.get("int")       # → IntType
registry.get("N")         # → DecimalType
registry.get("UNKNOWN")   # → None
```

---

### registry.get_for_value

```python
registry.get_for_value(value: Any) -> type[DataType] | None
```

Get type class for Python value.

**Examples:**
```python
registry.get_for_value(42)              # → IntType
registry.get_for_value(Decimal("10"))   # → DecimalType
registry.get_for_value("hello")         # → StrType
```

**Test:** `tests/test_core.py::TestEdgeCases::test_registry_get_for_value`

---

### registry.is_typed

```python
registry.is_typed(value: str) -> bool
```

Check if string has valid TYTX type suffix.

**Examples:**
```python
registry.is_typed("123::L")        # → True
registry.is_typed("hello::T")      # → True
registry.is_typed("123")           # → False
registry.is_typed("hello::UNKNOWN")  # → False
```

**Test:** `tests/test_core.py::TestRegistryHelpers`

---

### registry.register

```python
registry.register(type_class: type[DataType]) -> None
```

Register custom type.

**Example:**
```python
from genro_tytx import TypeRegistry
from genro_tytx.base import DataType

class UUIDType(DataType):
    name = "uuid"
    code = "U"
    python_type = uuid.UUID

    def parse(self, value: str) -> uuid.UUID:
        return uuid.UUID(value)

    def serialize(self, value: uuid.UUID) -> str:
        return str(value)

registry.register(UUIDType)
```

**Test:** `tests/test_core.py::TestEdgeCases::test_register_type_without_python_type`

---

## Built-in Types

### Type Attributes

Each type has these class attributes:

| Attribute | Description |
|-----------|-------------|
| `name` | Human-readable name |
| `code` | TYTX type code |
| `python_type` | Python type class |
| `sql_type` | SQL type for schema |
| `align` | Display alignment (`L`/`R`/`C`) |
| `empty` | Default empty value |
| `js_type` | JavaScript type |

### IntType

```python
IntType.code = "L"  # L = Long integer
IntType.python_type = int
IntType.sql_type = "INTEGER"
IntType.align = "R"
IntType.empty = 0
```

### FloatType

```python
FloatType.code = "R"  # R = Real number
FloatType.python_type = float
FloatType.sql_type = "REAL"
FloatType.align = "R"
FloatType.empty = 0.0
```

### DecimalType

```python
DecimalType.code = "N"  # N = Numeric
DecimalType.python_type = Decimal
DecimalType.sql_type = "DECIMAL"
DecimalType.align = "R"
DecimalType.empty = Decimal("0")
```

### BoolType

```python
BoolType.code = "B"
BoolType.python_type = bool
BoolType.empty = False
```

### StrType

```python
StrType.code = "T"  # T = Text
StrType.python_type = str
StrType.sql_type = "VARCHAR"
StrType.align = "L"
StrType.empty = ""
```

### DateType

```python
DateType.code = "D"  # D = Date
DateType.python_type = date
DateType.sql_type = "DATE"
DateType.empty = None
DateType.default_format = "%x"  # Locale date
```

### DateTimeType

```python
DateTimeType.code = "DHZ"  # DHZ = Date Hour Zulu (timezone-aware, canonical)
DateTimeType.python_type = datetime
DateTimeType.sql_type = "TIMESTAMP"
DateTimeType.empty = None
DateTimeType.default_format = "%c"  # Locale date + time
```

### NaiveDateTimeType (deprecated)

```python
NaiveDateTimeType.code = "DH"  # Deprecated: use DHZ for new code
NaiveDateTimeType.python_type = None  # Not auto-detected
```

### TimeType

```python
TimeType.code = "H"  # H = Hour
TimeType.python_type = time
TimeType.sql_type = "TIME"
TimeType.empty = None
TimeType.default_format = "%X"  # Locale time
```

### JsonType

```python
JsonType.code = "JS"  # JS = JavaScript object
JsonType.python_type = dict
JsonType.js_type = "object"
```

**Test:** `tests/test_core.py::TestTypeAttributes`

---

## JavaScript API

The JavaScript implementation mirrors Python API:

```javascript
import { from_text, as_typed_text, as_json, from_json } from 'genro-tytx';

// Parse typed strings
from_text("123::L")           // → 123
from_text("100.50::N")        // → "100.50" (string, JS has no Decimal)
from_text("2025-01-15::D")    // → Date object

// Serialize
as_typed_text(123)            // → "123::L"
as_typed_text(new Date())     // → "2025-01-15::D"

// JSON
as_typed_json({price: "100.50"})  // → '{"price": "100.50::N"}'
from_json('{"count": "42::L"}')   // → {count: 42}
```

**Test:** `js/test/test_core.js`

# TYTX Protocol - Feature Roadmap

**Version**: 0.4.0
**Updated**: 2025-12-01
**Status**: Active Development

This document provides a comprehensive overview of all TYTX features, their implementation status, and planned development.

## Feature Status Legend

| Symbol | Status | Description |
|--------|--------|-------------|
| :white_check_mark: | **DONE** | Fully implemented and tested |
| :large_orange_diamond: | **PARTIAL** | Partially implemented |
| :red_circle: | **TODO** | Planned but not implemented |
| :black_circle: | **NOT SPECIFIED** | Not in specs, not planned |

---

## Feature Overview

| # | Feature | Status | Python | JS | TS |
|---|---------|--------|--------|----|----|
| 1 | Base serialization/deserialization | :white_check_mark: DONE | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 2 | Array handling | :white_check_mark: DONE | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 3 | Custom type registration | :white_check_mark: DONE | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 4 | Struct registration (hierarchical + arrays) | :white_check_mark: DONE | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 5 | XTYTX extended envelope | :white_check_mark: DONE | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| 6 | Metadata for structures | :white_check_mark: DONE | :white_check_mark: | :large_orange_diamond: | :large_orange_diamond: |
| 7 | Generate structures from Pydantic | :white_check_mark: DONE | :white_check_mark: | N/A | N/A |
| 8 | Generate Pydantic models from structures | :red_circle: TODO | :red_circle: | N/A | N/A |
| 9 | Generate structures from XSD | :white_check_mark: DONE | :white_check_mark: | N/A | N/A |
| 10 | Visual structure editor | :white_check_mark: DONE | N/A | :white_check_mark: | N/A |
| 11 | Visual data editor using structures | :red_circle: TODO | N/A | :red_circle: | N/A |
| 12 | JSON Schema / OpenAPI integration | :red_circle: TODO | :red_circle: | :red_circle: | :red_circle: |

---

## Detailed Feature Descriptions

### 1. Base Serialization/Deserialization :white_check_mark: DONE

Core functionality for converting between typed text and native types.

**Built-in Types**:

| Code | Mnemonic | Python | JavaScript | Example |
|------|----------|--------|------------|---------|
| `L` | Long | `int` | `number` | `"123::L"` |
| `R` | Real | `float` | `number` | `"3.14::R"` |
| `N` | Numeric | `Decimal` | `string` | `"100.50::N"` |
| `B` | Boolean | `bool` | `boolean` | `"true::B"` |
| `T` | Text | `str` | `string` | `"hello::T"` |
| `D` | Date | `date` | `Date` | `"2025-01-15::D"` |
| `DH` | Date+Hour | `datetime` | `Date` | `"2025-01-15T10:30:00::DH"` |
| `DHZ` | Date+Hour+Zone | `datetime` | `Date` | `"2025-01-15T10:30:00Z::DHZ"` |
| `H` | Hour | `time` | `Date` | `"10:30:00::H"` |
| `JS` | JSON | `dict/list` | `object/array` | `'{"a":1}::JS'` |

**API**:
```python
from genro_tytx import from_text, as_typed_text, from_json, to_json

from_text("100.50::N")  # → Decimal("100.50")
as_typed_text(Decimal("100.50"))  # → "100.50::N"
```

**Files**: `registry.py`, `builtin.py`, `json_utils.py`

---

### 2. Array Handling :white_check_mark: DONE

Homogeneous arrays with single type annotation using `#` prefix.

**Syntax**: `[values]::#TypeCode`

**Examples**:
```
[1,2,3]::#L           → [1, 2, 3]  (all integers)
["a","b"]::#T         → ["a", "b"]  (all strings)
[[1,2],[3,4]]::#N     → nested decimals
[...]::#@STRUCT       → array of structs
```

**API**:
```python
from_text("[1,2,3]::#L")  # → [1, 2, 3]
as_typed_text([1, 2, 3], compact_array=True)  # → '["1","2","3"]::#L'
```

---

### 3. Custom Type Registration :white_check_mark: DONE

Extend TYTX with arbitrary classes using `~` prefix.

**API**:
```python
import uuid
from genro_tytx import registry

registry.register_class(
    code="UUID",
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)

from_text("550e8400-...::~UUID")  # → UUID object
```

**Wire format**: `value::~CODE`

---

### 4. Struct Registration :white_check_mark: DONE

Schema-based data hydration using `@` prefix.

**Schema Types**:

| Type | Definition | Input | Output |
|------|------------|-------|--------|
| Dict | `{'name': 'T', 'price': 'N'}` | object | object |
| List Positional | `['T', 'L', 'N']` | array | array |
| List Homogeneous | `['N']` | array | array |
| String Named | `'x:R,y:R'` | array | object |
| String Anonymous | `'R,R'` | array | array |

**Hierarchical Structs**:
```python
registry.register_struct('ADDRESS', {'street': 'T', 'city': 'T'})
registry.register_struct('CUSTOMER', {
    'name': 'T',
    'address': '@ADDRESS'  # nested struct
})
```

**Array of Structs**:
```python
registry.register_struct('ROW', 'name:T,qty:L,price:N')
from_text('[["A",1,"10"],["B",2,"20"]]::#@ROW')
# → [{"name":"A","qty":1,"price":Decimal("10")}, ...]
```

---

### 5. XTYTX Extended Envelope :white_check_mark: DONE

Self-contained payloads with embedded struct definitions.

**Format**:
```
XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}
```

**Fields**:
| Field | Description |
|-------|-------------|
| `gstruct` | Global structs - registered permanently |
| `lstruct` | Local structs - valid only for this payload |
| `data` | TYTX payload (can be empty for struct-only registration) |

**Use Cases**:
```python
# Register structs without data
from_json('XTYTX://{"gstruct":{"X":{...}},"lstruct":{},"data":""}')

# Self-contained payload
from_json('XTYTX://{"gstruct":{},"lstruct":{"TEMP":...},"data":"TYTX://..."}')
```

**Lookup Precedence**: `lstruct` > `registry`

---

### 6. Metadata for Structures :white_check_mark: DONE

Validation constraints and UI hints in type definitions.

**Syntax**: `TypeCode[key:value, key:value]`

**Validation Facets** (XSD-mapped):

| Facet | Applies To | Description | Example |
|-------|-----------|-------------|---------|
| `min` | T, L, N, R | Min length/value | `T[min:1]` |
| `max` | T, L, N, R | Max length/value | `T[max:100]` |
| `len` | T | Exact length | `T[len:16]` |
| `reg` | T | Regex pattern | `T[reg:"[A-Z]+"]` |
| `enum` | T | Allowed values | `T[enum:A\|B\|C]` |
| `dec` | N | Decimal places | `N[dec:2]` |
| `dig` | N | Total digits | `N[dig:10]` |

**UI Facets**:

| Facet | Description | Example |
|-------|-------------|---------|
| `lbl` | Label | `T[lbl:"Customer Name"]` |
| `hint` | Tooltip | `T[hint:"Enter full name"]` |
| `ph` | Placeholder | `T[ph:"John Doe"]` |
| `def` | Default value | `T[def:""]` |
| `ro` | Read-only | `T[ro:true]` |
| `hidden` | Hidden field | `T[hidden:true]` |

**Dynamic Facets** (conditional):
```
T[hidden:type=private]   # Hidden if type='private'
T[ro:status=closed]      # Read-only if status='closed'
```

**Files**: `metadata_parser.py`, `spec/validation.md`

---

### 7. Generate Structures from Pydantic :white_check_mark: DONE

Auto-generate TYTX struct from Pydantic model.

**API**:

```python
from pydantic import BaseModel
from decimal import Decimal
from datetime import date

class Order(BaseModel):
    id: int
    total: Decimal
    date: date

registry.register_struct_from_model('ORDER', Order)
# Equivalent to:
# registry.register_struct('ORDER', {'id': 'L', 'total': 'N', 'date': 'D'})
```

**Type Mapping**:

| Python | TYTX |
|--------|------|
| `str` | `T` |
| `int` | `L` |
| `float` | `R` |
| `Decimal` | `N` |
| `bool` | `B` |
| `date` | `D` |
| `datetime` | `DHZ` |
| `time` | `H` |
| `list[X]` | `#X` |
| `dict` | `JS` |
| `BaseModel` | `@MODEL_NAME` |

**Features**:

- Automatic type mapping from Python types to TYTX codes
- Support for `Optional[X]` and `X | None` (extracts inner type)
- Support for `list[X]` → `#X` (typed arrays)
- Support for nested Pydantic models → `@MODEL_NAME`
- Recursive registration of nested models with `include_nested=True` (default)
- Handles circular references safely

**Nested Models Example**:

```python
class Address(BaseModel):
    street: str
    city: str

class Customer(BaseModel):
    name: str
    address: Address
    orders: list[Order]

registry.register_struct_from_model('CUSTOMER', Customer)
# Registers:
# - @CUSTOMER: {'name': 'T', 'address': '@ADDRESS', 'orders': '#@ORDER'}
# - @ADDRESS: {'street': 'T', 'city': 'T'}
# - @ORDER: (if not already registered)
```

**Files**: `registry.py` (`register_struct_from_model()`), `tests/test_pydantic_struct.py`

---

### 8. Generate Pydantic Models from Structures :red_circle: TODO

Dynamic Pydantic model generation from TYTX struct.

**Planned API**:
```python
OrderModel = registry.create_pydantic_model('ORDER')
# Creates:
# class ORDER(BaseModel):
#     id: int
#     total: Decimal
#     date: date
```

**Status**: Not specified, not implemented.

---

### 9. Generate Structures from XSD :white_check_mark: DONE

Convert XSD schemas to TYTX struct definitions.

**Script**: `scripts/xsd_to_tytx.py`

**Usage**:
```bash
# Generate Python code
python scripts/xsd_to_tytx.py schema.xsd

# Generate JSON
python scripts/xsd_to_tytx.py schema.xsd --json
```

**XSD Mapping**:
| XSD | TYTX |
|-----|------|
| `xs:string` | `T` |
| `xs:integer`, `xs:int`, `xs:long` | `L` |
| `xs:decimal` | `N` |
| `xs:float`, `xs:double` | `R` |
| `xs:date` | `D` |
| `xs:boolean` | `B` |
| `xs:complexType` | `@STRUCT` |
| `maxOccurs="unbounded"` | `#` prefix |
| Restrictions | Metadata facets |

**Example** (FatturaPA):
```bash
python scripts/xsd_to_tytx.py Schema_VFPR12.xsd --json > fatturapa.json
```

**Files**: `scripts/xsd_to_tytx.py`, `examples/schemas/fatturapa.json`

---

### 10. Visual Structure Editor :white_check_mark: DONE

Interactive HTML editor for TYTX struct definitions.

**Location**: `examples/visualizer/index.html`

**Features**:
- Create/edit struct definitions
- Nested struct support
- Import/Export JSON
- Metadata editing
- Array field support

**Metadata UI Support**:
- Labels (`lbl`)
- Placeholders (`ph`)
- Hints (`hint`)
- Default values (`def`)
- Read-only (`ro`)
- Enums (`enum`)

**Usage**:
1. Open `examples/visualizer/index.html` in browser
2. Create structs or import JSON
3. Export to JSON for use in code

---

### 11. Visual Data Editor :red_circle: TODO

Edit data instances using struct schemas.

**Planned Features**:
- Form generation from struct schema
- Pre-filled with existing data
- Validation feedback
- Export to TYTX format

**Current State**: `js/src/ui.js` has `FormGenerator` for empty forms, but no data binding.

---

### 12. JSON Schema / OpenAPI Integration :red_circle: TODO

Bidirectional conversion between TYTX structs and JSON Schema / OpenAPI schemas.

**Planned API**:

```python
from genro_tytx import struct_from_jsonschema, struct_to_jsonschema

# JSON Schema → TYTX struct
schema = {
    "type": "object",
    "properties": {
        "id": {"type": "integer"},
        "name": {"type": "string"},
        "price": {"type": "number", "format": "decimal"},
        "created_at": {"type": "string", "format": "date-time"},
        "is_active": {"type": "boolean"}
    }
}
struct = struct_from_jsonschema(schema)
# → {"id": "L", "name": "T", "price": "N", "created_at": "DH", "is_active": "B"}

# TYTX struct → JSON Schema
struct = {"id": "L", "name": "T", "price": "N", "created_at": "DH"}
schema = struct_to_jsonschema(struct)
# → {"type": "object", "properties": {...}}
```

**Type Mapping (JSON Schema → TYTX)**:

| JSON Schema type/format | TYTX code |
|------------------------|-----------|
| `integer` | `L` |
| `number` | `R` |
| `number` + `format: decimal` | `N` |
| `boolean` | `B` |
| `string` | `T` |
| `string` + `format: date` | `D` |
| `string` + `format: date-time` | `DH` / `DHZ` |
| `string` + `format: time` | `H` |
| `array` + `items` | `#X` or `#@STRUCT` |
| `object` + `properties` | `@STRUCT` (nested) |
| `$ref` | resolved and mapped |

**Type Mapping (TYTX → JSON Schema)**:

| TYTX code | JSON Schema |
|-----------|-------------|
| `L` | `{"type": "integer"}` |
| `R` | `{"type": "number"}` |
| `N` | `{"type": "number", "format": "decimal"}` |
| `B` | `{"type": "boolean"}` |
| `T` | `{"type": "string"}` |
| `D` | `{"type": "string", "format": "date"}` |
| `DH` | `{"type": "string", "format": "date-time"}` |
| `DHZ` | `{"type": "string", "format": "date-time"}` |
| `H` | `{"type": "string", "format": "time"}` |
| `#X` | `{"type": "array", "items": {...}}` |
| `@STRUCT` | `{"$ref": "#/definitions/STRUCT"}` |

**Metadata Mapping**:

| TYTX facet | JSON Schema |
|------------|-------------|
| `min` | `minLength` (string) / `minimum` (number) |
| `max` | `maxLength` (string) / `maximum` (number) |
| `len` | `minLength` + `maxLength` |
| `reg` | `pattern` |
| `enum` | `enum` |
| `dec` | custom extension |
| `dig` | custom extension |

**Use Cases**:

- Auto-generate TYTX structs from existing OpenAPI/Swagger specs
- Export TYTX structs for documentation or validation tools
- Integration with JSON Schema validation libraries
- Bridge between TYTX and REST API definitions

**Planned Files**: `schema_utils.py`

---

## Protocol Versions

| Version | Features |
|---------|----------|
| 0.1.0 | Base types, JSON encoding |
| 0.2.0 | Structs (`@`), Custom types (`~`), Arrays (`#`) |
| 0.3.0 | Type prefixes standardized |
| 0.4.0 | XTYTX envelope, protocol prefix `TYTX://` |

---

## File Structure

```
genro-tytx/
├── src/genro_tytx/        # Python implementation
│   ├── registry.py        # Core registry
│   ├── builtin.py         # Built-in types
│   ├── json_utils.py      # JSON encoding
│   ├── metadata_parser.py # Metadata grammar
│   └── pydantic.py        # Pydantic integration
├── js/src/                # JavaScript implementation
│   ├── registry.js        # Core registry
│   ├── types.js           # Built-in types
│   ├── json_utils.js      # JSON encoding
│   └── ui.js              # Form generator
├── ts/src/                # TypeScript implementation
│   ├── registry.ts        # Core registry
│   ├── types.ts           # Built-in types
│   └── json.ts            # JSON encoding
├── spec/                  # Protocol specifications
│   ├── tytx-protocol.md   # Main protocol spec
│   ├── type-codes.md      # Type code registry
│   ├── structs.md         # Struct specification
│   ├── xtytx.md           # XTYTX envelope spec
│   ├── validation.md      # Validation facets
│   └── roadmap.md         # This file
├── scripts/               # Utility scripts
│   └── xsd_to_tytx.py     # XSD converter
├── examples/              # Examples
│   ├── visualizer/        # Visual editor
│   └── schemas/           # Sample schemas
└── tests/                 # Test suites
```

---

## Next Steps (Priority Order)

1. **Version bump to 0.4.0** - Update pyproject.toml, CHANGELOG
2. **NPM publish** - Release JavaScript package
3. **Pydantic integration** (Feature 7) - `register_struct_from_model()`
4. **Reverse Pydantic** (Feature 8) - `create_pydantic_model()`
5. **Data editor** (Feature 11) - Form with data binding

---

## Contributing

See `CONTRIBUTING.md` for guidelines.

**Repository**: https://github.com/genropy/genro-tytx
**License**: Apache License 2.0
**Copyright**: Softwell S.r.l. (2025)

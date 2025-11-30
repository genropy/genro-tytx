# TYTX Struct Types

**Version**: 0.2.0
**Updated**: 2025-11-30
**Status**: Draft

This document defines the struct type system for TYTX, enabling schema-based hydration of JSON data.

## Overview

Structs provide a way to define type schemas for JSON data structures. Unlike inline typing (`value::TYPE`), structs apply types based on a pre-registered schema.

## Type Code Prefix

Struct types use the `@` prefix (at-sign) to distinguish them from:
- Built-in types (no prefix): `::L`, `::D`, `::N`
- Custom class types (`~` prefix): `::~UUID`, `::~INV`
- Typed arrays (`#` prefix): `::#L`, `::#N`

| Prefix | Type | Managed by |
|--------|------|------------|
| (none) | Built-in | TYTX core |
| `~` | Custom class | `register_class` |
| `@` | Struct schema | `register_struct` |
| `#` | Typed array | inline |

## Wire Format

```
<json_data>::@<CODE>
```

The JSON data is standard JSON (no inline types). The `::@CODE` suffix indicates which schema to use for hydration.

## Schema Types

### List Schema (Positional)

#### Heterogeneous (Fixed Length)

Schema with multiple types applies types by position:

```python
register_struct('ROW', ['T', 'L', 'N'])
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `["Product", 2, "100.50"]::@ROW` | `["Product", 2, Decimal("100.50")]` |

Rules:
- Schema length must match data length
- Type at index N applies to value at index N

#### Homogeneous (Variable Length)

Schema with single type applies to all elements:

```python
register_struct('PRICES', ['N'])
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `[100, 200, 50]::@PRICES` | `[Decimal("100"), Decimal("200"), Decimal("50")]` |
| `[10]::@PRICES` | `[Decimal("10")]` |
| `[]::@PRICES` | `[]` |

Rules:
- Schema has exactly one element
- Type applies to all data elements
- Data length is variable

#### Multidimensional Homogeneous

Nested single-element schemas apply to all leaf values:

```python
register_struct('MATRIX', [['N']])
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `[[1, 2], [3, 4]]::@MATRIX` | `[[Decimal("1"), Decimal("2")], [Decimal("3"), Decimal("4")]]` |

```python
register_struct('CUBE', [[['L']]])
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]::@CUBE` | `[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]` (all int) |

Rules:
- Nesting depth in schema determines expected data structure
- Single type at deepest level applies to all leaf values

### Dict Schema (Keyed)

Schema maps keys to types:

```python
register_struct('CUSTOMER', {'name': 'T', 'balance': 'N', 'created': 'D'})
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `{"name": "Acme", "balance": "100.50", "created": "2025-01-15"}::@CUSTOMER` | `{"name": "Acme", "balance": Decimal("100.50"), "created": date(2025, 1, 15)}` |

Rules:
- Only keys present in schema are typed
- Extra keys in data are passed through unchanged
- Missing keys in data are not added

### String Schema (Ordered Fields)

String schema provides **explicit field ordering** with guaranteed order. This is ideal for CSV-like data where field position matters.

#### Named Fields (Output: dict)

Schema with `name:type` pairs produces dict output:

```python
register_struct('POINT', 'x:R,y:R')
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `["3.7", "7.3"]::@POINT` | `{"x": 3.7, "y": 7.3}` |

The string format guarantees field order (unlike dict which has no order guarantee in JavaScript).

#### Anonymous Fields (Output: list)

Schema with types only (no names) produces list output:

```python
register_struct('COORDS', 'R,R')
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `["3.7", "7.3"]::@COORDS` | `[3.7, 7.3]` |

#### CSV-like Batch Processing

String schema excels at converting arrays of arrays (CSV data) to arrays of dicts:

```python
register_struct('ROW', 'name:T,qty:L,price:N')
```

| Wire Format | Parsed Result |
|-------------|---------------|
| `[["A", "1", "10"], ["B", "2", "20"]]::@ROW` | `[{"name": "A", "qty": 1, "price": Decimal("10")}, {"name": "B", "qty": 2, "price": Decimal("20")}]` |

Rules:

- String is parsed as comma-separated fields
- `name:type` format → named field, output dict
- `type` format (no colon) → anonymous field, output list
- Spaces around `:` and `,` are trimmed
- Field position in string determines mapping to array position

## Schema Definition

### Python

```python
from genro_tytx import registry

# List schemas
registry.register_struct('ROW', ['T', 'L', 'N'])      # heterogeneous
registry.register_struct('PRICES', ['N'])             # homogeneous
registry.register_struct('MATRIX', [['N']])           # 2D homogeneous

# Dict schema
registry.register_struct('CUSTOMER', {
    'name': 'T',
    'balance': 'N',
    'created': 'D'
})

# String schema (ordered fields)
registry.register_struct('POINT', 'x:R,y:R')          # named → dict output
registry.register_struct('COORDS', 'R,R')             # anonymous → list output
registry.register_struct('CSV_ROW', 'name:T,qty:L,price:N')  # CSV-like
```

### JavaScript

```javascript
const { registry } = require('genro-tytx');

// List schemas
registry.register_struct('ROW', ['T', 'L', 'N']);
registry.register_struct('PRICES', ['N']);
registry.register_struct('MATRIX', [['N']]);

// Dict schema
registry.register_struct('CUSTOMER', {
    name: 'T',
    balance: 'N',
    created: 'D'
});

// String schema (ordered fields)
registry.register_struct('POINT', 'x:R,y:R');         // named → dict output
registry.register_struct('COORDS', 'R,R');            // anonymous → list output
registry.register_struct('CSV_ROW', 'name:T,qty:L,price:N');  // CSV-like
```

## Parsing

```python
from genro_tytx import registry

# Parse with struct type
result = registry.from_text('["Product", 2, "100.50"]::@ROW')
# → ["Product", 2, Decimal("100.50")]

result = registry.from_text('[100, 200]::@PRICES')
# → [Decimal("100"), Decimal("200")]

result = registry.from_text('{"name": "Acme", "balance": "100"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100")}

# String schema: list → dict
result = registry.from_text('["3.7", "7.3"]::@POINT')
# → {"x": 3.7, "y": 7.3}

# String schema: batch CSV
result = registry.from_text('[["A", "1", "10"], ["B", "2", "20"]]::@CSV_ROW')
# → [{"name": "A", "qty": 1, "price": Decimal("10")}, {"name": "B", "qty": 2, "price": Decimal("20")}]
```

## Serialization

```python
from genro_tytx import registry

# Serialize with struct type
result = registry.as_typed_text(["Product", 2, Decimal("100.50")], struct='ROW')
# → '["Product", 2, "100.50"]::@ROW'

result = registry.as_typed_text([Decimal("100"), Decimal("200")], struct='PRICES')
# → '[100, 200]::@PRICES'
```

## Schema Detection Rules

When parsing `data::@CODE`:

1. Look up schema for `CODE`
2. If schema is a `str` (string schema):
   - Parse comma-separated fields
   - If fields have names (`name:type`): output dict
   - If fields are anonymous (`type`): output list
3. If schema is a `list`:
   - If `len(schema) == 1`: homogeneous mode, apply schema[0] to all leaves
   - If `len(schema) > 1`: positional mode, apply schema[i] to data[i]
4. If schema is a `dict`:
   - Apply schema[key] to data[key] for each key in schema

## Unregistering Structs

```python
registry.unregister_struct('ROW')  # removes @ROW
```

## Fallback Behavior

If `@CODE` is not registered:
- The value is returned as a plain string (unchanged)
- No error is raised
- This allows graceful degradation

## Pydantic Integration (Python Only)

Schemas can be auto-generated from Pydantic models:

```python
from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from genro_tytx import registry

class Customer(BaseModel):
    name: str
    balance: Decimal
    created: date

# Auto-generate schema from model
registry.register_struct_from_model('CUSTOMER', Customer)

# Equivalent to:
# registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N', 'created': 'D'})
```

### Type Mapping

| Python Type | TYTX Code |
|-------------|-----------|
| `str` | `T` |
| `int` | `L` |
| `float` | `R` |
| `bool` | `B` |
| `Decimal` | `N` |
| `date` | `D` |
| `datetime` | `DHZ` |
| `time` | `H` |

### Parsing to Model Instance

With `as_model=True`, parse directly to a Pydantic model instance:

```python
# Parse to dict (default)
data = registry.from_text('{"name": "Acme", "balance": "100", "created": "2025-01-15"}::@CUSTOMER')
# → {"name": "Acme", "balance": Decimal("100"), "created": date(2025, 1, 15)}

# Parse to model instance
customer = registry.from_text(
    '{"name": "Acme", "balance": "100", "created": "2025-01-15"}::@CUSTOMER',
    as_model=True
)
# → Customer(name="Acme", balance=Decimal("100"), created=date(2025, 1, 15))
```

### Serialization from Model

```python
customer = Customer(name="Acme", balance=Decimal("100"), created=date(2025, 1, 15))

# Serialize with struct type
result = registry.as_typed_text(customer, struct='CUSTOMER')
# → '{"name": "Acme", "balance": "100", "created": "2025-01-15"}::@CUSTOMER'
```

### Nested Models (Future)

Nested Pydantic models will be supported in a future version, generating nested struct schemas automatically.

## Future Extensions

The following features are planned for future versions:

- **Nested structs**: Reference other structs in schema (`@CUSTOMER` inside `@ORDER`)
- **Array of structs**: `[]::@ROW` notation in schema definition
- **Optional fields**: Schema notation for nullable/optional fields
- **Default values**: Schema-defined defaults for missing fields
- **Nested Pydantic models**: Auto-generate nested struct schemas

These features will be specified in a separate document once the base struct functionality is stable.

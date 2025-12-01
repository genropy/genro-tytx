# TYTX - Architectural Decisions

**Version**: 0.3.0
**Date**: 2025-12-01
**Status**: Partially Approved

---

## 1. Three Parallel Implementations

### Decision

TYTX has **three official implementations** that follow the same specification:

| Implementation | Package | Runtime |
|----------------|---------|---------|
| **Python** | `genro-tytx` (PyPI) | Python 3.10+ |
| **JavaScript** | `genro-tytx` (npm) | Node.js, Browser |
| **TypeScript** | `genro-tytx` (npm) | Node.js, Browser |

There is no automatic code generation between implementations.

### Rationale

1. **Platform optimization**: each language uses native idioms
2. **Zero build dependencies**: no codegen required
3. **Simplicity**: the specification is the source of truth, not the code
4. **Type safety**: TypeScript provides static types for TS developers

---

## 2. Mnemonic Type Codes

### Decision

Type codes are **mnemonic** to facilitate memorization.

### Built-in Type Codes

| Code | Python Type | Note |
|------|-------------|------|
| `T` | str | **T**ext |
| `L` | int | **L**ong integer |
| `R` | float | **R**eal number |
| `B` | bool | **B**oolean |
| `D` | date | **D**ate |
| `DHZ` | datetime | **D**ate **H**our **Z**ulu (UTC) |
| `DH` | datetime | **D**ate **H**our (naive, deprecated) |
| `H` | time | **H**our |
| `N` | Decimal | **N**umeric |
| `JS` | list/dict | **J**ava**S**cript object |

### Rationale

1. **Easy memorization**: each code is an acronym of the type
2. **Compactness**: short codes for compact payloads
3. **Readability**: easy to understand the type by looking at the code

---

## 3. Type Code Prefixes

### Decision

TYTX uses **three symbolic prefixes** to distinguish type categories:

| Prefix | Category | Registration | Example |
|--------|----------|--------------|---------|
| (none) | Built-in | TYTX core | `::L`, `::D`, `::DHZ` |
| `~` | Custom class | `register_class` | `::~UUID`, `::~INV` |
| `@` | Struct schema | `register_struct` | `::@CUSTOMER`, `::@ROW` |
| `#` | Typed array | (inline) | `::#L`, `::#N`, `::#@ROW` |

### Rationale

1. **No collision**: reserved symbols, impossible conflict with alphanumeric codes
2. **Clear in wire format**: category is immediately visible
3. **Composition**: `#@ROW` combines array + struct
4. **Future-proof**: TYTX can add new built-ins without conflicts

---

## 4. Custom Types with `~` Prefix

### Decision

User-defined custom types use the `~` (tilde) prefix to avoid collisions with built-in types.

### `register_class` Pattern

```python
# Python
registry.register_class(
    code="UUID",  # becomes "~UUID"
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)

as_typed_text(my_uuid)  # -> "550e8400-...::~UUID"
```

```javascript
// JavaScript
registry.register_class({
    code: "UUID",  // becomes "~UUID"
    cls: null,
    serialize: (u) => String(u),
    parse: (s) => s
});

from_text("550e8400-...::~UUID");  // -> "550e8400-..."
```

### Rationale

1. **Compact symbol**: `~` is more readable than `X_`
2. **Unix convention**: `~` evokes "custom/home"
3. **Safe fallback**: if JS doesn't know `~XXX`, it remains a string

---

## 5. Struct Schemas with `@` Prefix

### Decision

Struct schemas use the `@` prefix and support three definition formats:

| Format | Example | Input | Output |
|--------|---------|-------|--------|
| Dict | `{name: 'T', balance: 'N'}` | `{...}` | `{...}` |
| List | `['T', 'L', 'N']` | `[...]` | `[...]` |
| String | `'x:R,y:R'` | `[...]` | `{...}` or `[...]` |

### `register_struct` Pattern

```python
# Dict schema - for objects
registry.register_struct('CUSTOMER', {'name': 'T', 'balance': 'N'})

# List schema - for positional tuples
registry.register_struct('ROW', ['T', 'L', 'N'])

# String schema - for CSV-like data
registry.register_struct('POINT', 'x:R,y:R')
```

### Array of Structs with `#@`

The `#` prefix combines with `@` for arrays of structs:

```python
from_text('[["A", 1], ["B", 2]]::#@ROW')
# -> [["A", 1], ["B", 2]] (with types applied)
```

### Rationale

1. **Schema-based**: define once, use everywhere
2. **CSV-ready**: string schema perfect for tabular data
3. **Composition**: `#@` combines array + struct elegantly

---

## 6. Protocol Prefix Syntax (`://`)

### Decision

Global payloads use the `://` separator (URL-style) instead of `::`:

| Protocol | Syntax | Description |
|----------|--------|-------------|
| TYTX | `TYTX://{"price": "100::N"}` | Standard typed payload |
| XTYTX | `XTYTX://{"gstruct": {...}, ...}` | Extended envelope with structs |

### Rationale

1. **Universal familiarity**: everyone knows `http://`, `ftp://`, `file://`
2. **Clear semantics**: indicates "this is the protocol, what follows is data"
3. **Clear distinction**: from `::` used for inline type codes
4. **Easy to parse**: just search for `://` to find the boundary

---

## 7. XML Structure with attrs/value

### Decision

The XML structure uses `{"tag": {"attrs": {...}, "value": ...}}` in both Python and JS.

### Rationale

1. **Clear separation**: attributes and content are distinct
2. **Python/JS parity**: same structure on both platforms
3. **Complex case handling**: elements with both attributes and children

---

## 8. MessagePack with ExtType 42

### Decision

TYTX uses MessagePack ExtType code **42** for typed payloads.

### Format

```python
ExtType(42, b'{"price": "100::N"}')
```

The content is JSON with TYTX encoded values.

### Rationale

1. **Unique identification**: ExtType 42 is reserved for TYTX
2. **Interoperability**: internal JSON is readable everywhere
3. **Efficiency**: msgpack for transport, JSON for structure

---

## 9. Public API snake_case

### Decision

All public APIs use **snake_case** in both Python and JavaScript.

### Core API

| Function | Description |
|----------|-------------|
| `from_text(text, type_code=None)` | Parse typed string |
| `as_text(value, format=None, locale=None)` | Serialize without type |
| `as_typed_text(value, compact_array=False)` | Serialize with type |
| `from_json(json_str)` | Parse JSON with hydration |
| `as_json(data)` | Standard JSON |
| `as_typed_json(data)` | JSON with TYTX types |
| `from_xml(xml_str)` | Parse XML |
| `as_xml(data, root_tag=None)` | Standard XML |
| `as_typed_xml(data, root_tag=None)` | XML with TYTX types |
| `from_msgpack(data)` | Parse MessagePack |
| `as_msgpack(data)` | Standard MessagePack |
| `as_typed_msgpack(data)` | MessagePack with ExtType 42 |

### Rationale

1. **Consistency**: same style across all platforms
2. **Python-friendly**: snake_case is the Python standard (PEP 8)
3. **Predictability**: users always know what to expect

---

## 10. Zero Core Dependencies

### Decision

The TYTX core has no runtime dependencies, only stdlib.

### Optional Dependencies

**Python:**

- `orjson` - faster JSON
- `msgpack` - MessagePack support

**JavaScript:**

- `big.js` or `decimal.js` - precise Decimal
- `@msgpack/msgpack` - MessagePack

### Rationale

1. **Lightweight installation**: works out-of-the-box
2. **No conflicts**: no dependency hell
3. **Opt-in performance**: those who want can add orjson/msgpack

---

## 11. Dual Output: Standard and Typed

### Decision

Each format has two output functions:

- `as_*` -> standard output (for external systems)
- `as_typed_*` -> output with TYTX types

### Example

```python
data = {"price": Decimal("100.50")}

as_json(data)        # '{"price": 100.5}'      (standard)
as_typed_json(data)  # '{"price": "100.50::N"}' (TYTX)
```

### Rationale

1. **Interoperability**: `as_json` produces valid JSON for any system
2. **Type preservation**: `as_typed_json` maintains type information
3. **Explicit choice**: user decides which to use

---

## 12. Internal DataType for Built-ins

### Decision

`DataType` is an **internal** base class used only for built-in types.
Users use `register_class` for custom types.

### Rationale

1. **Simple API**: `register_class` is easier to use
2. **No inheritance**: functional pattern
3. **Separation**: stable core, flexible custom

---

## 13. Graceful Fallback

### Decision

Unknown types are returned as strings, without errors.

### Behavior

```python
from_text("value::UNKNOWN")  # -> "value::UNKNOWN" (string)
from_text("value::~FOO")  # -> "value::~FOO" (if not registered)
from_text("value::@BAR")  # -> "value::@BAR" (struct not registered)
```

### Rationale

1. **Robustness**: no crash for missing types
2. **Easy debugging**: original value is preserved
3. **Interoperability**: Python and JS can have different registered types

---

## 14. XTYTX Extended Envelope

### Decision

XTYTX is an envelope format for self-contained payloads with struct definitions:

```text
XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}
```

### Fields

| Field | Description |
|-------|-------------|
| `gstruct` | Global structs - registered permanently (overwrites existing) |
| `lstruct` | Local structs - valid only for this payload |
| `data` | TYTX payload (can be empty for struct-only registration) |

### Lookup Precedence

During decoding: `lstruct` > `registry` (lstruct wins on conflict)

### Rationale

1. **Self-contained**: no pre-registration needed
2. **Flexible**: global + local struct definitions
3. **Streaming-friendly**: prefix allows early detection

See [xtytx.md](../spec/xtytx.md) for full specification.

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0

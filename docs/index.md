# TYTX - Typed Text Protocol

**A multi-language protocol for type-safe data exchange over JSON, XML, and MessagePack.**

---

## Overview

JSON only knows: string, number, boolean, null. What about `Decimal`, `Date`, `DateTime`?

```json
{"price": 100.50, "date": "2025-01-15"}
```

Is `price` a float (imprecise) or a Decimal (exact for money)? Is `date` a string or a Date?

**TYTX solves this** by encoding type information directly in values:

```json
{"price": "100.50::N", "date": "2025-01-15::D"}
```

After parsing: `price` → `Decimal("100.50")`, `date` → `date(2025, 1, 15)`.

**No ambiguity. No surprises. Type safety across the wire.**

---

## Quick Example

```python
from genro_tytx import from_text, from_json
from decimal import Decimal

# Simple values
from_text("99.99::N")           # → Decimal("99.99")
from_text("2025-01-15::D")      # → date(2025, 1, 15)
from_text("true::B")            # → True

# JSON documents
from_json('{"price": "99.99::N", "qty": "5::L"}')
# → {"price": Decimal("99.99"), "qty": 5}
```

---

## Multi-Language Support

| Package | Language | Install |
|---------|----------|---------|
| `genro-tytx` | **Python** | `pip install genro-tytx` |
| `genro-tytx` | **JavaScript** | `npm install genro-tytx` |
| `genro-tytx-ts` | **TypeScript** | `npm install genro-tytx-ts` |

Same API, same types, across all languages.

---

## Documentation

```{toctree}
:maxdepth: 2
:caption: Getting Started

installation
quickstart
```

```{toctree}
:maxdepth: 2
:caption: User Guide

guide/types
guide/json
guide/xml
guide/msgpack
guide/registry
guide/pydantic
guide/javascript
guide/http_helpers
```

```{toctree}
:maxdepth: 2
:caption: Examples

examples/index
```

```{toctree}
:maxdepth: 1
:caption: Reference

api/reference
faq
```

---

## Feature Status

| Feature | Python | JS | TS |
|---------|:------:|:--:|:--:|
| Base types (10 codes) | ✅ | ✅ | ✅ |
| Typed arrays (`#`) | ✅ | ✅ | ✅ |
| Custom types (`~`) | ✅ | ✅ | ✅ |
| Struct schemas (`@`) | ✅ | ✅ | ✅ |
| XTYTX envelope | ✅ | ✅ | ✅ |
| JSON / XML / MessagePack | ✅ | ✅ | ✅ |
| Pydantic integration | ✅ | N/A | N/A |
| JSON Schema / OpenAPI | ✅ | ✅ | ✅ |

---

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

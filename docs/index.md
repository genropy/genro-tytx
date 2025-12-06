# TYTX Base - Typed Text Protocol

**Minimal implementation of TYTX protocol for scalar types over JSON, XML, and MessagePack.**

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
from datetime import date
from decimal import Decimal
from genro_tytx import to_typed_text, from_text, to_typed_json, from_json

# Encode (text format - suffix only)
data = {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
text_str = to_typed_text(data)
# '{"price": "100.50::N", "date": "2025-01-15::D"}::JS'

# Decode
result = from_text(text_str)
# {"price": Decimal("100.50"), "date": date(2025, 1, 15)}

# Encode (JSON format - with TYTX:// protocol prefix)
json_str = to_typed_json(data)
# 'TYTX://{"price": "100.50::N", "date": "2025-01-15::D"}::JS'

# Decode
result = from_json(json_str)
# {"price": Decimal("100.50"), "date": date(2025, 1, 15)}
```

---

## API Functions

| Function | Format | Description |
|----------|--------|-------------|
| `to_typed_text` | `...::JS` | Encode with suffix marker only |
| `from_text` | `...::JS` | Decode text format |
| `to_typed_json` | `TYTX://...::JS` | Encode with protocol prefix and suffix |
| `from_json` | `TYTX://...::JS` | Decode JSON format (prefix optional) |

---

## Supported Types

### JSON (non-native types only)

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `N` | `"100.50::N"` |
| date | `D` | `"2025-01-15::D"` |
| datetime | `DHZ` | `"2025-01-15T10:30:00Z::DHZ"` |
| time | `H` | `"10:30:00::H"` |

> **Note**: `DH` is deprecated but still accepted for backward compatibility.

### XML (all types, everything is string)

| Type | Suffix | Example |
|------|--------|---------|
| Decimal | `N` | `<price _type="N">100.50</price>` |
| date | `D` | `<d _type="D">2025-01-15</d>` |
| datetime | `DHZ` | `<dt _type="DHZ">2025-01-15T10:30:00Z</dt>` |
| time | `H` | `<t _type="H">10:30:00</t>` |
| bool | `B` | `<flag _type="B">1</flag>` |
| int | `I` | `<count _type="I">42</count>` |

---

## Documentation

```{toctree}
:maxdepth: 2
:caption: Getting Started

Overview <self>
installation
quickstart
```

---

## TYTX Base vs TYTX

| Feature | TYTX Base | TYTX |
|---------|:---------:|:----:|
| Scalar types (N, D, DHZ, H, B, L, R, T, I) | ✅ | ✅ |
| JSON / XML / MessagePack | ✅ | ✅ |
| HTTP utilities | ✅ | ✅ |
| Typed arrays (`#`) | ❌ | ✅ |
| Custom types (`~`) | ❌ | ✅ |
| Struct schemas (`@`) | ❌ | ✅ |
| XTYTX envelope | ❌ | ✅ |
| Pydantic integration | ❌ | ✅ |

**Use TYTX Base** when you only need scalar types and want a minimal footprint.

**Use TYTX** when you need advanced features like typed arrays, custom types, or struct schemas.

---

## License

Apache License 2.0 - Copyright 2025 Softwell S.r.l.

# TYTX API Reference

## HTTP helpers (JS/TS/Python)

- JS (CommonJS): `fetch_typed(url, { expect?: 'json'|'text'|'xml'|'msgpack' })` hydrates via `from_json`/`from_xml`/`from_text` (msgpack optional).
- TS (ESM): `fetchTyped(url, opts)` equivalent; XML in TS is treated as typed text if no XML parser is present.
- Sending typed payloads: `fetchTypedRequest` (TS/JS). `sendAs: 'json'|'text'|'msgpack'` serializes via `asTypedJson`, `as_typed_text`, or `packb` and sets `Content-Type` + `X-TYTX-Request`.
- XTYTX envelope: `fetchXtytx` (TS) / `fetch_xtytx` (JS) with optional `autoStructs` to include referenced `lstruct` schemas automatically.
- Python: `genro_tytx.http_utils` provides `fetch_typed`, `fetch_typed_request`, `fetch_xtytx`, `build_xtytx_envelope` (urllib-based, sync). Async wrappers: `genro_tytx.http_async_utils` (`fetch_typed_async`, `fetch_typed_request_async`, `fetch_xtytx_async`). Server-side hydration: ASGI `TytxASGIMiddleware`, WSGI `TytxWSGIMiddleware`.
- Node server-side hydration: `hydrateTypedBody` (TS) to hydrate JSON/text/msgpack/XTYTX bodies in Express/Koa/Fastify by passing raw body + headers.

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
*** End Patch!*\

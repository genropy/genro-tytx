# JSON Utilities

TYTX provides utilities for working with JSON data.

## Functions Overview

| Function | Purpose |
|----------|---------|
| `as_typed_json(data)` | Serialize with TYTX type suffixes |
| `as_json(data)` | Serialize to standard JSON |
| `from_json(json_str)` | Parse JSON with type hydration |

## Typed JSON

<!-- test: test_core.py::TestJSONUtils::test_as_typed_json_complex -->

Use `as_typed_json()` to serialize Python objects with type information:

```python
from genro_tytx import as_typed_json
from decimal import Decimal
from datetime import date, datetime

data = {
    "price": Decimal("99.99"),
    "date": date(2025, 1, 15),
    "timestamp": datetime(2025, 1, 15, 10, 30),
    "quantity": 5,
    "name": "Widget",
    "active": True
}

json_str = as_typed_json(data)
```

Output:
```json
{
    "price": "99.99::D",
    "date": "2025-01-15::d",
    "timestamp": "2025-01-15T10:30:00::dt",
    "quantity": 5,
    "name": "Widget",
    "active": true
}
```

### What Gets Typed

| Python Type | JSON Output | Typed |
|-------------|-------------|-------|
| `Decimal` | `"99.99::D"` | Yes |
| `date` | `"2025-01-15::d"` | Yes |
| `datetime` | `"2025-01-15T10:00::dt"` | Yes |
| `int` | `5` | No (native) |
| `float` | `1.5` | No (native) |
| `str` | `"hello"` | No (native) |
| `bool` | `true` | No (native) |
| `None` | `null` | No (native) |
| `list` | `[...]` | No (native) |
| `dict` | `{...}` | No (native) |

## Standard JSON

<!-- test: test_core.py::TestJSONUtils::test_as_json_standard -->

Use `as_json()` for systems that don't understand TYTX:

```python
from genro_tytx import as_json
from decimal import Decimal
from datetime import date

data = {"price": Decimal("99.99"), "date": date(2025, 1, 15)}

json_str = as_json(data)
# '{"price": 99.99, "date": "2025-01-15"}'
```

Conversions:
- `Decimal` → float
- `date` → ISO string
- `datetime` → ISO string

## Parsing JSON

<!-- test: test_core.py::TestJSONUtils::test_from_json_simple -->

Use `from_json()` to parse JSON with type hydration:

```python
from genro_tytx import from_json

# Simple values
result = from_json('{"price": "99.99::D", "count": "42::I"}')
# {"price": Decimal("99.99"), "count": 42}
```

### Nested Structures

<!-- test: test_core.py::TestJSONUtils::test_from_json_nested -->

```python
from genro_tytx import from_json

json_str = '''
{
    "order": {
        "price": "100::D",
        "date": "2025-01-15::d",
        "customer": "Acme"
    }
}
'''
result = from_json(json_str)
# result["order"]["price"] → Decimal("100")
# result["order"]["date"] → date(2025, 1, 15)
# result["order"]["customer"] → "Acme"
```

### Lists

<!-- test: test_core.py::TestJSONUtils::test_from_json_list -->

```python
from genro_tytx import from_json

json_str = '{"prices": ["10::D", "20::D", "30::D"]}'
result = from_json(json_str)
# result["prices"] → [Decimal("10"), Decimal("20"), Decimal("30")]
```

### Non-Typed Values

<!-- test: test_core.py::TestJSONUtils::test_from_json_preserves_non_typed -->

Values without type suffix are preserved as-is:

```python
from genro_tytx import from_json

json_str = '{"a": "hello", "b": 123, "c": true}'
result = from_json(json_str)
# {"a": "hello", "b": 123, "c": True}
```

## Round-Trip

<!-- test: test_core.py::TestJSONUtils::test_json_roundtrip -->

Typed values survive JSON round-trip:

```python
from genro_tytx import as_typed_json, from_json
from decimal import Decimal
from datetime import date, datetime

original = {
    "price": Decimal("123.45"),
    "date": date(2025, 6, 15),
    "timestamp": datetime(2025, 6, 15, 14, 30),
    "name": "Test",
    "count": 42
}

# Serialize
json_str = as_typed_json(original)

# Parse back
restored = from_json(json_str)

# Verify
assert restored["price"] == original["price"]      # Decimal preserved
assert restored["date"] == original["date"]        # date preserved
assert restored["timestamp"] == original["timestamp"]  # datetime preserved
```

## Error Handling

<!-- test: test_core.py::TestEdgeCases::test_json_encoder_type_error -->

Non-serializable objects raise `TypeError`:

```python
from genro_tytx import as_typed_json

class Custom:
    pass

as_typed_json({"obj": Custom()})  # raises TypeError
```

## Use Cases

### API Response

```python
from genro_tytx import as_typed_json

def get_order(order_id):
    order = fetch_order(order_id)  # Returns dict with Decimal, date
    return as_typed_json(order)
```

### API Request Parsing

```python
from genro_tytx import from_json

def create_order(request_body: str):
    data = from_json(request_body)
    # data["price"] is already Decimal if it was "100::D"
    process_order(data)
```

### WebSocket Messages

```python
from genro_tytx import as_typed_json, from_json

async def handle_message(ws, message):
    data = from_json(message)
    result = process(data)
    await ws.send(as_typed_json(result))
```

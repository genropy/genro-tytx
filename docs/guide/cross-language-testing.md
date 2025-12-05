# Cross-Language HTTP Testing

TYTX provides comprehensive cross-language testing to ensure type fidelity between Python and JavaScript implementations over HTTP.

## Architecture

The test infrastructure uses two HTTP servers running in parallel:

```
┌─────────────────┐         HTTP          ┌─────────────────┐
│  Python Server  │ ◄──────────────────► │    JS Server    │
│   Port 8765     │                       │   Port 8766     │
└─────────────────┘                       └─────────────────┘
        │                                         │
        │  GET /json, /msgpack, /xml, /text/*    │
        │  POST /echo/json, /echo/msgpack, etc.  │
        │                                         │
        ▼                                         ▼
┌─────────────────┐                       ┌─────────────────┐
│  Python Tests   │                       │    JS Tests     │
│  (pytest)       │                       │   (vitest)      │
└─────────────────┘                       └─────────────────┘
```

## Test Scenarios

### 1. One-Way: Server → Client

Data serialized by one language and deserialized by the other.

| Scenario | Description |
|----------|-------------|
| Python → JS | Python server sends, JS client receives and hydrates |
| JS → Python | JS server sends, Python client receives and hydrates |

### 2. Round-Trip: Client → Server → Client

Data makes a full round-trip through the other language's server.

| Scenario | Description |
|----------|-------------|
| Python → JS → Python | Python sends, JS echoes, Python receives |
| JS → Python → JS | JS sends, Python echoes, JS receives |

## Formats Tested

All scenarios are tested with three serialization formats:

| Format | Content-Type | TYTX Header |
|--------|--------------|-------------|
| JSON | `application/json` | `X-TYTX-Request: json` |
| MessagePack | `application/x-msgpack` | `X-TYTX-Request: msgpack` |
| XML | `application/xml` | `X-TYTX-Request: xml` |

## Types Tested

Each format tests the following TYTX types:

| Type | Python | JavaScript | Wire Format |
|------|--------|------------|-------------|
| Integer | `int` | `number` | `42::L` |
| Float | `float` | `number` | `3.14::R` |
| Decimal | `Decimal` | `Big` | `99.99::N` |
| Boolean | `bool` | `boolean` | `true::B` |
| Date | `date` | `Date` | `2025-01-15::D` |
| DateTime | `datetime` | `Date` | `2025-01-15T10:30:00Z::DHZ` |
| Time | `time` | `Date` | `14:30:00::H` |
| Null | `None` | `null` | `null` |
| Array | `list` | `Array` | Native JSON array |
| Nested Object | `dict` | `object` | Native JSON object |

## Example: JSON Round-Trip

### Python → JS → Python

```python
from genro_tytx.http_utils import fetch_typed_request
from datetime import date, datetime

# Send typed data to JS server, receive echo
result = fetch_typed_request(
    "http://127.0.0.1:8766/echo/json",
    body={
        "id": 123,
        "price": Decimal("99.99"),
        "created": date(2025, 1, 15),
        "active": True
    },
    send_as="json",
    expect="json"
)

# Types are preserved after round-trip
assert result["id"] == 123
assert result["price"] == Decimal("99.99")
assert result["created"] == date(2025, 1, 15)
assert result["active"] is True
```

### JS → Python → JS

```javascript
const { fetch_typed_request } = require('genro-tytx');

// Send typed data to Python server, receive echo
const result = await fetch_typed_request('http://127.0.0.1:8765/echo/json', {
    body: {
        id: 123,
        price: new Big('99.99'),
        created: new Date('2025-01-15'),
        active: true
    },
    sendAs: 'json',
    expect: 'json'
});

// Types are preserved after round-trip
assert.strictEqual(result.id, 123);
assert.strictEqual(result.price.toString(), '99.99');
assert.ok(result.created instanceof Date);
assert.strictEqual(result.active, true);
```

## Example: MessagePack Round-Trip

### Python → JS → Python

```python
from genro_tytx.http_utils import fetch_typed_request
from datetime import datetime

result = fetch_typed_request(
    "http://127.0.0.1:8766/echo/msgpack",
    body={
        "timestamp": datetime(2025, 6, 15, 14, 30, 45),
        "values": [1, 2, 3, 4, 5],
        "nested": {"x": 10, "y": 20}
    },
    send_as="msgpack",
    expect="msgpack"
)

assert isinstance(result["timestamp"], datetime)
assert result["values"] == [1, 2, 3, 4, 5]
assert result["nested"]["x"] == 10
```

### JS → Python → JS

```javascript
const { fetch_typed_request } = require('genro-tytx');

const result = await fetch_typed_request('http://127.0.0.1:8765/echo/msgpack', {
    body: {
        timestamp: new Date('2025-06-15T14:30:45Z'),
        values: [1, 2, 3, 4, 5],
        nested: { x: 10, y: 20 }
    },
    sendAs: 'msgpack',
    expect: 'msgpack'
});

assert.ok(result.timestamp instanceof Date);
assert.deepStrictEqual(result.values, [1, 2, 3, 4, 5]);
assert.strictEqual(result.nested.x, 10);
```

## Example: XML Round-Trip

### Python → JS → Python

```python
from genro_tytx.http_utils import fetch_typed_request

result = fetch_typed_request(
    "http://127.0.0.1:8766/echo/xml",
    body={"user": {"id": 123, "name": "test"}},
    send_as="json",
    expect="xml"
)

# XML returns structure: {root: {attrs: {}, value: {...}}}
data = result["root"]["value"]
assert data["user"]["value"]["id"]["value"] == 123
```

### JS → Python → JS

```javascript
const { fetch_typed_request } = require('genro-tytx');

const result = await fetch_typed_request('http://127.0.0.1:8765/echo/xml', {
    body: { user: { id: 123, name: 'test' } },
    sendAs: 'json',
    expect: 'xml'
});

// Extract values from XML structure
const data = extractXmlValues(result.root || result);
assert.strictEqual(data.user.id, 123);
assert.strictEqual(data.user.name, 'test');
```

## Running the Tests

### Prerequisites

Start both test servers:

```bash
# Terminal 1: Python server
cd genro-tytx
python -m tests.test_cross_language_server

# Terminal 2: JS server
cd genro-tytx/js
node test/server.js
```

### Run Tests

```bash
# Python tests (calls JS server)
pytest tests/test_cross_http.py -v

# JS tests (calls Python server)
cd js && npm test -- test/test_cross_http.js
```

### Test Matrix Summary

| Test File | Client | Server | Tests |
|-----------|--------|--------|-------|
| `tests/test_cross_http.py` | Python | JS (8766) | ~54 |
| `js/test/test_cross_http.js` | JS | Python (8765) | ~57 |

## Test Categories

### Python Test Classes

```
TestJSServesPythonReceivesJSON      # JS → Python: JSON GET
TestJSServesPythonReceivesMsgpack   # JS → Python: msgpack GET
TestJSServesPythonReceivesText      # JS → Python: typed text GET
TestPythonJSPythonJsonEcho          # Python → JS → Python: JSON echo
TestPythonJSPythonMsgpackEcho       # Python → JS → Python: msgpack echo
TestJSServesPythonReceivesXML       # JS → Python: XML GET
TestPythonJSPythonXmlEcho           # Python → JS → Python: XML echo
```

### JS Test Suites

```
Python → JS: JSON                    # Python → JS: JSON GET
Python → JS: msgpack                 # Python → JS: msgpack GET
Python → JS: typed text              # Python → JS: typed text GET
JS → Python → JS: JSON echo          # JS → Python → JS: JSON echo
JS → Python → JS: msgpack echo       # JS → Python → JS: msgpack echo
Python → JS: XML                     # Python → JS: XML GET
JS → Python → JS: XML echo           # JS → Python → JS: XML echo
```

## Why Cross-Language Testing Matters

1. **Type Fidelity**: Ensures types survive serialization across language boundaries
2. **Protocol Compliance**: Verifies both implementations follow the same TYTX specification
3. **Edge Cases**: Catches subtle differences in how languages handle dates, decimals, etc.
4. **Real-World Scenarios**: Simulates actual client-server communication patterns

## Common Pitfalls Caught by These Tests

| Issue | Example |
|-------|---------|
| Timezone handling | `datetime` vs `Date` UTC conversion |
| Decimal precision | `Decimal("99.99")` vs `99.99000000000001` |
| Date-only values | `date(2025, 1, 15)` vs midnight DateTime |
| Null vs undefined | Python `None` vs JS `null`/`undefined` |
| Integer overflow | Python unlimited int vs JS 53-bit safe int |

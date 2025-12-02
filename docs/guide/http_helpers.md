# HTTP helpers (Python / JS / TS)

TYTX includes lightweight, framework-agnostic helpers to **send typed payloads and hydrate responses** across Python, JavaScript, and TypeScript. They share the same concepts:

- `sendAs`: how to serialize the request (`json` / `text` / `msgpack`).
- `expect`: how to hydrate the response (`json` / `text` / `xml` / `msgpack` / `xtytx`).
- `xtytx`: send/receive the extended envelope that can carry local/global structs and schemas.
- Auto-structs (JS/TS): when `xtytx` is used, referenced structs (`::@STRUCT`) are auto-collected and sent as `lstruct`.

## Python client (`genro_tytx.http_utils`)

```python
from decimal import Decimal
from genro_tytx.http_utils import (
    fetch_typed,
    fetch_typed_request,
    fetch_xtytx,
    build_xtytx_envelope,
)

# Hydrate a response (infer Content-Type)
data = fetch_typed("https://api.example.com/pet/1")

# Send typed JSON (adds X-TYTX-Request: json)
resp = fetch_typed_request(
    "https://api.example.com/pet",
    body={"price": Decimal("10.5")},
    send_as="json",     # or "text" or "msgpack"
    expect="json",
)

# Send XTYTX envelope (with optional structs/schemas)
xt = fetch_xtytx(
    "https://api.example.com/pet",
    payload={"price": Decimal("10.5")},
    gstruct={"PRICE": {"price": "N"}},
)
assert xt.data["price"] == Decimal("10.5")
```

Behaviors:
- `fetch_typed` hydrates based on `expect` or inferred `Content-Type`.
- `fetch_typed_request` serializes `body` according to `send_as` and sets `Content-Type` / `X-TYTX-Request`.
- `fetch_xtytx` builds and sends an XTYTX envelope (`XTYTX://` prefix) and returns `XtytxResult`.

## JS client (`genro-tytx`)

```js
const { fetch_typed, fetch_typed_request, fetch_xtytx } = require('genro-tytx');

const pet = await fetch_typed('/api/pet/1'); // infer Content-Type

// Send typed JSON
const created = await fetch_typed_request('/api/pet', {
  method: 'POST',
  body: { name: 'Fido' },
  sendAs: 'json',       // or 'text' or 'msgpack'
  expect: 'json',
});

// Send XTYTX with auto-collected lstruct
const xt = await fetch_xtytx('/api/pet', {
  payload: { total: '{"amount":"10.5::N"}::@ORDER' },
  gstruct: { ORDER: { amount: 'N' } },
});
console.log(xt.data.total.amount); // -> 10.5 as number
```

## TS client (`genro-tytx-ts`)

```ts
import { fetchTyped, fetchTypedRequest, fetchXtytx } from 'genro-tytx-ts';

const pet = await fetchTyped('/api/pet/1');

const created = await fetchTypedRequest('/api/pet', {
  method: 'POST',
  body: { name: 'Fido' },
  sendAs: 'json',
  expect: 'json',
});

const xt = await fetchXtytx('/api/pet', {
  payload: { total: '{"amount":"10.5::N"}::@ORDER' },
  gstruct: { ORDER: { amount: 'N' } },
});
```

TS mirrors the JS API, with typed signatures and inferred return types.

## Server-side hydration (Python)

If your Python app exposes HTTP endpoints, you can hydrate incoming requests automatically and, when the client asks for TYTX, auto-serialize responses in the same format:

- ASGI: `genro_tytx.middleware.asgi.TytxASGIMiddleware`
- WSGI: `genro_tytx.middleware.wsgi.TytxWSGIMiddleware`

What they do:
- Detect `Content-Type` or `X-TYTX-Request` (`json`, `text`, `msgpack`, `xtytx`).
- Hydrate the request body (including XTYTX envelopes) and store it in:
  - ASGI: `scope["tytx"] = {"data": hydrated}` and `scope["tytx_body"] = original_bytes`
  - WSGI: `environ["tytx.data"] = hydrated` and `environ["tytx.body"] = original_bytes`
- Rewind the body so downstream handlers can still read it.
- If the request carries `X-TYTX-Request`, and the response body is a plain object/array, it is auto-serialized back as typed JSON/text/msgpack or XTYTX (adds `X-TYTX-Response` for XTYTX).

## Server-side helpers (Node.js / TS)

If you use Node.js (Express/Koa/Fastify), you can hydrate the body with the TypeScript helper:

```ts
import { hydrateTypedBody } from 'genro-tytx-ts';

const hydrated = hydrateTypedBody({
  raw: bodyBuffer,
  contentType: req.headers['content-type'],
  tytxRequest: req.headers['x-tytx-request'] as string | undefined,
});

req.tytx = hydrated;
```

Works with JSON/text/msgpack/XTYTX. The helper is framework-agnostic; just pass body and headers.

## Async variant in Python

If you want to use the helpers from async code without extra dependencies, use the `asyncio.to_thread` wrappers:

```python
from genro_tytx.http_async_utils import fetch_typed_async, fetch_typed_request_async

data = await fetch_typed_async("https://api.example.com/pet/1")

resp = await fetch_typed_request_async(
    "https://api.example.com/order",
    body={"price": Decimal("10.5")},
    send_as="json",
    expect="json",
)
```

The signature mirrors the sync helpers; pick whichever you prefer.

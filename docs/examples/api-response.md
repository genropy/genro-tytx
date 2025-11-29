# Example: REST API with Typed JSON

Preserving type information in API responses.

## Scenario

An e-commerce API needs to:
- Return prices as exact Decimal values
- Return dates as date objects
- Support both TYTX-aware and standard JSON clients

## Implementation

<!-- test: test_core.py::TestJSONUtils::test_json_roundtrip -->

```python
from decimal import Decimal
from datetime import date, datetime
from genro_tytx import as_typed_json, as_json, from_json

# Order data with precise types
order = {
    "id": 12345,
    "customer": "Acme Corp",
    "items": [
        {"product": "Widget", "price": Decimal("99.99"), "qty": 2},
        {"product": "Gadget", "price": Decimal("149.50"), "qty": 1}
    ],
    "total": Decimal("349.48"),
    "order_date": date(2025, 1, 15),
    "ship_date": date(2025, 1, 18),
    "created_at": datetime(2025, 1, 15, 10, 30, 0)
}

# For TYTX-aware clients
typed_response = as_typed_json(order)
print(typed_response)
```

**Output (typed):**
```json
{
    "id": "12345::L",
    "customer": "Acme Corp",
    "items": [
        {"product": "Widget", "price": "99.99::N", "qty": "2::L"},
        {"product": "Gadget", "price": "149.50::N", "qty": "1::L"}
    ],
    "total": "349.48::N",
    "order_date": "2025-01-15::D",
    "ship_date": "2025-01-18::D",
    "created_at": "2025-01-15T10:30:00::DH"
}
```

```python
# For standard JSON clients
standard_response = as_json(order)
print(standard_response)
```

**Output (standard):**
```json
{
    "id": 12345,
    "customer": "Acme Corp",
    "items": [
        {"product": "Widget", "price": 99.99, "qty": 2},
        {"product": "Gadget", "price": 149.50, "qty": 1}
    ],
    "total": 349.48,
    "order_date": "2025-01-15",
    "ship_date": "2025-01-18",
    "created_at": "2025-01-15T10:30:00"
}
```

## Parsing API Requests

```python
# Client sends typed JSON
request_body = '''
{
    "product": "New Widget",
    "price": "199.99::N",
    "available_from": "2025-02-01::D"
}
'''

# Parse with type hydration
data = from_json(request_body)

# Types are preserved
assert isinstance(data["price"], Decimal)
assert data["price"] == Decimal("199.99")

assert isinstance(data["available_from"], date)
assert data["available_from"] == date(2025, 2, 1)
```

## FastAPI Integration

```python
from fastapi import FastAPI, Request, Response
from genro_tytx import as_typed_json, from_json

app = FastAPI()

@app.post("/orders")
async def create_order(request: Request):
    # Parse typed JSON body
    body = await request.body()
    order_data = from_json(body.decode())

    # order_data["price"] is already Decimal
    # order_data["date"] is already date

    # Process order...
    result = process_order(order_data)

    # Return typed response
    return Response(
        content=as_typed_json(result),
        media_type="application/json"
    )

@app.get("/orders/{order_id}")
async def get_order(order_id: int, typed: bool = False):
    order = fetch_order(order_id)

    if typed:
        # TYTX-aware client
        return Response(
            content=as_typed_json(order),
            media_type="application/json"
        )
    else:
        # Standard JSON client
        return Response(
            content=as_json(order),
            media_type="application/json"
        )
```

## JavaScript Client

```javascript
import { from_json, as_typed_json } from 'genro-tytx';

// Fetch order with types
const response = await fetch('/orders/123?typed=true');
const data = from_json(await response.text());

// data.price is correctly typed
console.log(data.price);  // "99.99" (Decimal as string in JS)
console.log(data.order_date);  // Date object

// Send order with types
const order = {
    product: "Widget",
    price: 99.99,  // Will be "99.99::R" (number → float in JS)
    date: new Date()
};

await fetch('/orders', {
    method: 'POST',
    body: as_typed_json(order),
    headers: {'Content-Type': 'application/json'}
});
```

## Benefits

1. **Precision**: Decimal prices don't lose precision as floats
2. **Type safety**: Dates are dates, not strings
3. **Backward compatible**: Standard JSON for legacy clients
4. **Round-trip safe**: Types survive JSON serialization

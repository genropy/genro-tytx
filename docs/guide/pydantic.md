# Pydantic Integration

TYTX provides a `TytxModel` base class for Pydantic that automatically handles TYTX serialization.

## Installation

Pydantic support requires the optional `pydantic` dependency:

```bash
pip install genro-tytx[pydantic]

# For MessagePack support with Pydantic:
pip install genro-tytx[pydantic,msgpack]
```

## Overview

`TytxModel` extends Pydantic's `BaseModel` with TYTX-aware serialization:

| Method | Purpose |
|--------|---------|
| `model_dump_json()` | Serialize to TYTX JSON (preserves Decimal precision) |
| `model_validate_tytx()` | Validate from TYTX JSON or dict |
| `model_dump_msgpack()` | Serialize to MessagePack bytes |
| `model_validate_tytx_msgpack()` | Validate from MessagePack bytes |

## Basic Usage

```python
from decimal import Decimal
from datetime import date
from genro_tytx.pydantic import TytxModel

class Order(TytxModel):
    price: Decimal
    order_date: date
    quantity: int
    name: str

order = Order(
    price=Decimal("99.99"),
    order_date=date(2025, 1, 15),
    quantity=5,
    name="Widget"
)

# Serialize to TYTX JSON
json_str = order.model_dump_json()
# '{"price": "99.99::N", "order_date": "2025-01-15::D", "quantity": "5::L", "name": "Widget"}'

# Deserialize from TYTX JSON
restored = Order.model_validate_tytx(json_str)
assert restored.price == Decimal("99.99")  # Decimal preserved!
```

## Why TytxModel?

Standard Pydantic's `model_dump_json()` converts `Decimal` to `float`, losing precision:

```python
from pydantic import BaseModel
from decimal import Decimal

class StandardModel(BaseModel):
    price: Decimal

order = StandardModel(price=Decimal("99.99"))
json_str = order.model_dump_json()
# '{"price": 99.99}'  # Float, not Decimal!

# When parsed back, it's a float
import json
data = json.loads(json_str)
# data["price"] == 99.99  # float, precision may be lost
```

With `TytxModel`, Decimal precision is preserved:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal

class TytxOrder(TytxModel):
    price: Decimal

order = TytxOrder(price=Decimal("99.99"))
json_str = order.model_dump_json()
# '{"price": "99.99::N"}'  # TYTX typed string

restored = TytxOrder.model_validate_tytx(json_str)
assert restored.price == Decimal("99.99")  # Exact Decimal!
```

## JSON Serialization

### model_dump_json()

Serializes to TYTX-typed JSON string:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal
from datetime import date, datetime

class Invoice(TytxModel):
    total: Decimal
    due_date: date
    created_at: datetime
    invoice_number: int
    customer: str
    paid: bool

invoice = Invoice(
    total=Decimal("1234.56"),
    due_date=date(2025, 2, 15),
    created_at=datetime(2025, 1, 15, 10, 30, 0),
    invoice_number=12345,
    customer="Acme Corp",
    paid=False
)

json_str = invoice.model_dump_json()
```

Output:
```json
{
    "total": "1234.56::N",
    "due_date": "2025-02-15::D",
    "created_at": "2025-01-15T10:30:00::DH",
    "invoice_number": "12345::L",
    "customer": "Acme Corp",
    "paid": "false::B"
}
```

### model_validate_tytx()

Validates from TYTX JSON string, bytes, or dict:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal

class Order(TytxModel):
    price: Decimal
    quantity: int

# From JSON string
order = Order.model_validate_tytx('{"price": "99.99::N", "quantity": "5::L"}')
assert order.price == Decimal("99.99")

# From bytes
order = Order.model_validate_tytx(b'{"price": "99.99::N", "quantity": "5::L"}')

# From dict with typed values
order = Order.model_validate_tytx({"price": "99.99::N", "quantity": "5::L"})

# From regular dict (falls back to standard validation)
order = Order.model_validate_tytx({"price": Decimal("99.99"), "quantity": 5})
```

## MessagePack Serialization

Requires: `pip install genro-tytx[msgpack]`

### model_dump_msgpack()

Serializes to MessagePack bytes with TYTX types preserved:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal
from datetime import date

class Order(TytxModel):
    price: Decimal
    order_date: date

order = Order(price=Decimal("99.99"), order_date=date(2025, 1, 15))

# Serialize to bytes
packed = order.model_dump_msgpack()
assert isinstance(packed, bytes)
```

### model_validate_tytx_msgpack()

Validates from MessagePack bytes:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal
from datetime import date

class Order(TytxModel):
    price: Decimal
    order_date: date

# Assume packed is MessagePack bytes from model_dump_msgpack()
restored = Order.model_validate_tytx_msgpack(packed)
assert restored.price == Decimal("99.99")
assert restored.order_date == date(2025, 1, 15)
```

## Validation

All standard Pydantic validation works with `TytxModel`:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal
from pydantic import Field, field_validator

class Order(TytxModel):
    price: Decimal = Field(gt=0)
    quantity: int = Field(ge=1, le=100)
    discount: Decimal = Field(default=Decimal("0"), ge=0, le=1)

    @field_validator("price")
    @classmethod
    def price_must_have_two_decimals(cls, v: Decimal) -> Decimal:
        if v.as_tuple().exponent < -2:
            raise ValueError("Price must have at most 2 decimal places")
        return v

# Validation works
order = Order(price=Decimal("99.99"), quantity=5)

# Validation error
try:
    Order(price=Decimal("-10"), quantity=5)  # price must be > 0
except ValidationError as e:
    print(e)

# TYTX validation also validates
try:
    Order.model_validate_tytx('{"price": "-10::N", "quantity": "5::L"}')
except ValidationError as e:
    print(e)
```

## Nested Models

TytxModel works with nested models:

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal

class Item(TytxModel):
    name: str
    price: Decimal

class Order(TytxModel):
    items: list[Item]
    total: Decimal

order = Order(
    items=[
        Item(name="Widget", price=Decimal("25.00")),
        Item(name="Gadget", price=Decimal("75.50")),
    ],
    total=Decimal("100.50")
)

# JSON serialization
json_str = order.model_dump_json()

# MessagePack serialization
packed = order.model_dump_msgpack()

# Both preserve nested Decimal values
restored = Order.model_validate_tytx(json_str)
assert restored.items[0].price == Decimal("25.00")
```

## Use Cases

### API Endpoints

```python
from fastapi import FastAPI
from genro_tytx.pydantic import TytxModel
from decimal import Decimal

app = FastAPI()

class OrderRequest(TytxModel):
    price: Decimal
    quantity: int

class OrderResponse(TytxModel):
    order_id: int
    total: Decimal

@app.post("/orders")
async def create_order(request: OrderRequest) -> OrderResponse:
    total = request.price * request.quantity
    return OrderResponse(order_id=123, total=total)

# Client can send TYTX JSON:
# {"price": "99.99::N", "quantity": "5::L"}
```

### Database Models

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal
from datetime import datetime

class Transaction(TytxModel):
    id: int
    amount: Decimal
    timestamp: datetime
    description: str

# Store as TYTX JSON in database
def save_transaction(tx: Transaction):
    json_str = tx.model_dump_json()
    db.execute("INSERT INTO transactions (data) VALUES (?)", [json_str])

def load_transaction(tx_id: int) -> Transaction:
    row = db.execute("SELECT data FROM transactions WHERE id = ?", [tx_id])
    return Transaction.model_validate_tytx(row["data"])
```

### Binary Protocols

```python
from genro_tytx.pydantic import TytxModel
from decimal import Decimal

class Message(TytxModel):
    msg_type: str
    payload: dict
    amount: Decimal

async def send_message(ws, msg: Message):
    await ws.send(msg.model_dump_msgpack())

async def receive_message(ws) -> Message:
    data = await ws.recv()
    return Message.model_validate_tytx_msgpack(data)
```

## Comparison with Standard Pydantic

| Feature | Pydantic BaseModel | TytxModel |
|---------|-------------------|-----------|
| Decimal in JSON | Converted to float | Preserved as "value::N" |
| date/datetime | ISO string | "value::D" / "value::DH" |
| Round-trip precision | May lose precision | Exact preservation |
| MessagePack | Not built-in | Built-in support |
| Validation | Full support | Full support |
| Performance | Native | Slightly slower (type encoding) |

## Best Practices

1. **Use for financial data**: Always use `TytxModel` when dealing with `Decimal` values that require exact precision.

2. **API boundaries**: Use `TytxModel` at API boundaries to ensure type information is preserved across services.

3. **Storage**: Store as TYTX JSON or MessagePack to preserve types across serialization.

4. **Mixed usage**: You can use `TytxModel` alongside regular Pydantic models. Use `TytxModel` only where type preservation matters.

5. **Validation**: Continue to use Pydantic's validation features - they work identically with `TytxModel`.

# TYTX vs Alternatives

How TYTX compares to other approaches for handling types across the wire.

## The Problem

When sending data between Python and JavaScript, you need to handle types that JSON doesn't support natively: `Decimal`, `date`, `datetime`, `time`. Here's how different solutions approach this.

## Comparison Table

| Approach | Schema Required | Setup Complexity | Runtime Overhead | Type Safety |
|----------|:--------------:|:----------------:|:----------------:|:-----------:|
| **TYTX** | No | Minimal | Low | ✅ Automatic |
| Manual Conversion | No | None | Low | ❌ Error-prone |
| JSON Schema | Yes | Medium | Medium | ⚠️ Validation only |
| Protocol Buffers | Yes | High | Low | ✅ Compile-time |
| GraphQL | Yes | High | Medium | ✅ Schema-based |
| TypeBox/Zod | Yes | Medium | Medium | ✅ Runtime |

## Detailed Comparison

### Manual Conversion (The Default)

What most applications do today:

```python
# Server
return {
    "price": str(price),  # Decimal → string
    "date": date.isoformat(),  # date → string
}
```

```javascript
// Client
const data = await response.json();
const price = new Decimal(data.price);  // string → Decimal
const date = new Date(data.date);       // string → Date
```

**Problems:**

- Conversion code scattered everywhere
- Easy to forget conversions
- No guarantee client/server agree on format
- Breaks when format changes

**TYTX eliminates this entirely** - types are preserved automatically.

### JSON Schema

JSON Schema validates structure but doesn't transport types:

```json
{
  "type": "object",
  "properties": {
    "price": { "type": "string", "pattern": "^\\d+\\.\\d{2}$" },
    "date": { "type": "string", "format": "date" }
  }
}
```

**Limitations:**

- Only validates, doesn't convert
- Schema must be maintained separately
- Client still receives strings
- No runtime type conversion

**TYTX advantage**: Types are converted automatically, no schema needed.

### Protocol Buffers / gRPC

Strongly typed with schema compilation:

```protobuf
message Order {
  string price = 1;  // No native Decimal
  google.protobuf.Timestamp date = 2;
}
```

**Trade-offs:**

- ✅ Excellent type safety
- ✅ Efficient binary format
- ❌ Requires schema definition
- ❌ Requires code generation
- ❌ No native Decimal support
- ❌ Complex setup for web clients

**When to use**: High-performance microservices, mobile apps.

**TYTX advantage**: Works with standard JSON/HTTP, no build step, native Decimal support.

### GraphQL

Type system with query language:

```text
type Order {
  price: String!  # Custom scalar needed for Decimal
  date: Date!
}
```

**Trade-offs:**

- ✅ Strong type system
- ✅ Client specifies what it needs
- ❌ Significant infrastructure
- ❌ Custom scalars for Decimal/Date
- ❌ Learning curve

**When to use**: Complex APIs with many clients needing different data shapes.

**TYTX advantage**: Zero infrastructure, works with existing REST APIs.

### TypeBox / Zod (Runtime Validation)

TypeScript-first schema validation:

```typescript
const OrderSchema = Type.Object({
  price: Type.String(),  // Still a string
  date: Type.String(),   // Still a string
});
```

**Limitations:**

- Validates but doesn't convert
- TypeScript-only
- Schema duplication between client/server
- Manual conversion still needed

**TYTX advantage**: Actual type conversion, works across Python/JS.

## When to Use TYTX

TYTX is ideal when you need:

- **Transparent type handling** without conversion code
- **Decimal precision** for financial data
- **Date/time preservation** across client/server
- **Minimal setup** - just use `asgi_data`/`wsgi_data`
- **Standard HTTP/JSON** - no special infrastructure
- **Transport flexibility** - switch to MessagePack for better performance with a single parameter change

## When to Consider Alternatives

- **Protocol Buffers**: Extreme performance requirements, microservices
- **GraphQL**: Complex data requirements, multiple client types
- **Manual conversion**: Simple apps with few type conversions

## Migration Path

TYTX works alongside existing solutions:

```python
# Gradually adopt TYTX
@app.post("/api/v1/order")  # Old endpoint - manual conversion
async def create_order_v1(request):
    ...

@app.post("/api/v2/order")  # New endpoint - TYTX
async def create_order_v2(request):
    data = request.scope["tytx"]["body"]  # Types already converted
    ...
```

You can migrate endpoint by endpoint without breaking existing clients.

(real-world-examples)=
## Real-World Comparison: Before and After

### Scenario 1: Form with Many Typed Fields

A typical business form with mixed types: dates, decimals, timestamps, booleans.

#### ❌ Without TYTX (Traditional Approach)

**Server (Python)**:

```python
@app.post("/api/save-contract")
async def save_contract(request: Request):
    data = await request.json()

    # Manual conversion of EVERY field
    contract = Contract(
        amount=Decimal(data["amount"]),           # string → Decimal
        start_date=date.fromisoformat(data["start_date"]),  # string → date
        end_date=date.fromisoformat(data["end_date"]),
        created_at=datetime.fromisoformat(data["created_at"]),
        hourly_rate=Decimal(data["hourly_rate"]),
        discount=Decimal(data["discount"]) if data.get("discount") else None,
        is_active=data["is_active"],  # OK - native JSON
        renewal_time=time.fromisoformat(data["renewal_time"]) if data.get("renewal_time") else None,
    )

    saved = await db.save(contract)

    # Manual conversion back for response
    return {
        "id": saved.id,
        "amount": str(saved.amount),              # Decimal → string
        "start_date": saved.start_date.isoformat(),  # date → string
        "end_date": saved.end_date.isoformat(),
        "created_at": saved.created_at.isoformat(),
        "hourly_rate": str(saved.hourly_rate),
        "discount": str(saved.discount) if saved.discount else None,
        "is_active": saved.is_active,
        "renewal_time": saved.renewal_time.isoformat() if saved.renewal_time else None,
    }
```

**Client (JavaScript)**:

```javascript
async function saveContract(formData) {
    // Manual conversion before sending
    const payload = {
        amount: formData.amount.toString(),           // Decimal → string
        start_date: formData.startDate.toISOString().slice(0, 10),  // Date → string
        end_date: formData.endDate.toISOString().slice(0, 10),
        created_at: formData.createdAt.toISOString(),
        hourly_rate: formData.hourlyRate.toString(),
        discount: formData.discount?.toString() ?? null,
        is_active: formData.isActive,
        renewal_time: formData.renewalTime
            ? `${formData.renewalTime.getUTCHours().toString().padStart(2,'0')}:${formData.renewalTime.getUTCMinutes().toString().padStart(2,'0')}:00`
            : null,
    };

    const response = await fetch('/api/save-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    // Manual conversion after receiving
    return {
        id: result.id,
        amount: new Decimal(result.amount),           // string → Decimal
        startDate: new Date(result.start_date),       // string → Date
        endDate: new Date(result.end_date),
        createdAt: new Date(result.created_at),
        hourlyRate: new Decimal(result.hourly_rate),
        discount: result.discount ? new Decimal(result.discount) : null,
        isActive: result.is_active,
        renewalTime: result.renewal_time ? parseTime(result.renewal_time) : null,
    };
}
```

**Problems**:

- 30+ lines of conversion code
- Easy to forget a field or use wrong format
- Time parsing is particularly error-prone
- Changes require updates in 4 places (server in, server out, client in, client out)

#### ✅ With TYTX

**Server (Python)**:

```python
@app.post("/api/save-contract")
async def save_contract(request: Request):
    data = request.scope["tytx"]["body"]

    # All types are already correct!
    contract = Contract(
        amount=data["amount"],           # Already Decimal
        start_date=data["start_date"],   # Already date
        end_date=data["end_date"],
        created_at=data["created_at"],   # Already datetime
        hourly_rate=data["hourly_rate"],
        discount=data.get("discount"),
        is_active=data["is_active"],
        renewal_time=data.get("renewal_time"),  # Already time
    )

    saved = await db.save(contract)

    # Just return - middleware handles encoding
    return {
        "id": saved.id,
        "amount": saved.amount,
        "start_date": saved.start_date,
        "end_date": saved.end_date,
        "created_at": saved.created_at,
        "hourly_rate": saved.hourly_rate,
        "discount": saved.discount,
        "is_active": saved.is_active,
        "renewal_time": saved.renewal_time,
    }
```

**Client (JavaScript)**:

```javascript
async function saveContract(formData) {
    // Send directly - fetchTytx handles encoding
    const result = await fetchTytx('/api/save-contract', {
        method: 'POST',
        body: {
            amount: formData.amount,           // Decimal
            start_date: formData.startDate,    // Date
            end_date: formData.endDate,
            created_at: formData.createdAt,    // Date
            hourly_rate: formData.hourlyRate,
            discount: formData.discount,
            is_active: formData.isActive,
            renewal_time: formData.renewalTime,
        }
    });

    // Use directly - all types are correct
    return result;
}
```

**Result**: Zero conversion code. Types flow naturally.

---

### Scenario 2: Excel-like Grid with Bulk Data

Loading and saving a spreadsheet-like grid with hundreds of rows of financial data.

#### ❌ Without TYTX

**Server response**:

```python
@app.get("/api/transactions")
async def get_transactions():
    rows = await db.fetch_all("SELECT * FROM transactions LIMIT 500")

    # Convert EVERY cell in EVERY row
    return {
        "rows": [
            {
                "id": row.id,
                "date": row.date.isoformat(),
                "amount": str(row.amount),
                "tax": str(row.tax),
                "total": str(row.total),
                "due_date": row.due_date.isoformat(),
                "paid_at": row.paid_at.isoformat() if row.paid_at else None,
                "rate": str(row.rate),
                "quantity": row.quantity,
                "unit_price": str(row.unit_price),
                "discount_pct": str(row.discount_pct),
            }
            for row in rows
        ]
    }
```

**Client loading**:

```javascript
async function loadGrid() {
    const response = await fetch('/api/transactions');
    const data = await response.json();

    // Convert every cell back
    return data.rows.map(row => ({
        id: row.id,
        date: new Date(row.date),
        amount: new Decimal(row.amount),
        tax: new Decimal(row.tax),
        total: new Decimal(row.total),
        dueDate: new Date(row.due_date),
        paidAt: row.paid_at ? new Date(row.paid_at) : null,
        rate: new Decimal(row.rate),
        quantity: row.quantity,
        unitPrice: new Decimal(row.unit_price),
        discountPct: new Decimal(row.discount_pct),
    }));
}
```

**Client saving** (user edited 50 rows):

```javascript
async function saveChanges(modifiedRows) {
    const payload = modifiedRows.map(row => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        amount: row.amount.toString(),
        tax: row.tax.toString(),
        total: row.total.toString(),
        due_date: row.dueDate.toISOString().slice(0, 10),
        paid_at: row.paidAt?.toISOString() ?? null,
        rate: row.rate.toString(),
        quantity: row.quantity,
        unit_price: row.unitPrice.toString(),
        discount_pct: row.discountPct.toString(),
    }));

    await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload })
    });
}
```

**Server receiving edits**:

```python
@app.put("/api/transactions")
async def update_transactions(request: Request):
    data = await request.json()

    for row in data["rows"]:
        await db.execute(
            "UPDATE transactions SET date=?, amount=?, tax=?, ... WHERE id=?",
            date.fromisoformat(row["date"]),
            Decimal(row["amount"]),
            Decimal(row["tax"]),
            Decimal(row["total"]),
            date.fromisoformat(row["due_date"]),
            datetime.fromisoformat(row["paid_at"]) if row["paid_at"] else None,
            Decimal(row["rate"]),
            row["quantity"],
            Decimal(row["unit_price"]),
            Decimal(row["discount_pct"]),
            row["id"],
        )
```

**Total**: ~80 lines of conversion code for one grid.

#### ✅ With TYTX

**Server**:

```python
@app.get("/api/transactions")
async def get_transactions():
    rows = await db.fetch_all("SELECT * FROM transactions LIMIT 500")
    return {"rows": [dict(row) for row in rows]}  # Types preserved automatically

@app.put("/api/transactions")
async def update_transactions(request: Request):
    data = await asgi_data(request.scope, request.receive)
    for row in data["body"]["rows"]:
        await db.execute(
            "UPDATE transactions SET date=?, amount=?, ... WHERE id=?",
            row["date"], row["amount"], row["tax"], row["total"],
            row["due_date"], row["paid_at"], row["rate"],
            row["quantity"], row["unit_price"], row["discount_pct"],
            row["id"],
        )
```

**Client**:

```javascript
async function loadGrid() {
    const data = await fetchTytx('/api/transactions');
    return data.rows;  // All types correct
}

async function saveChanges(modifiedRows) {
    await fetchTytx('/api/transactions', {
        method: 'PUT',
        body: { rows: modifiedRows }  // Types preserved
    });
}
```

**Total**: Zero conversion code.

---

### Scenario 3: Query Parameters with Typed Filters

Filtering a list with date ranges and price thresholds.

#### ❌ Without TYTX

**Client**:

```javascript
const url = new URL('/api/orders');
url.searchParams.set('start_date', startDate.toISOString().slice(0, 10));
url.searchParams.set('end_date', endDate.toISOString().slice(0, 10));
url.searchParams.set('min_price', minPrice.toString());
url.searchParams.set('max_price', maxPrice.toString());
url.searchParams.set('created_after', createdAfter.toISOString());

const response = await fetch(url);
```

**Server**:

```python
@app.get("/api/orders")
async def list_orders(request: Request):
    params = request.query_params

    start_date = date.fromisoformat(params["start_date"])
    end_date = date.fromisoformat(params["end_date"])
    min_price = Decimal(params["min_price"])
    max_price = Decimal(params["max_price"])
    created_after = datetime.fromisoformat(params["created_after"])

    # Use in query...
```

#### ✅ With TYTX

**Client** (URL built manually with TYTX suffixes):

```
/api/orders?start_date=2025-01-01::D&end_date=2025-12-31::D&min_price=100.00::N&max_price=500.00::N
```

**Server**:

```python
@app.get("/api/orders")
async def list_orders(request: Request):
    data = await asgi_data(request.scope, request.receive)
    params = data["query"]

    # Already typed!
    start_date = params["start_date"]    # date
    end_date = params["end_date"]        # date
    min_price = params["min_price"]      # Decimal
    max_price = params["max_price"]      # Decimal
```

---

## Summary: Lines of Code Comparison

| Scenario | Without TYTX | With TYTX | Savings |
|----------|-------------|-----------|---------|
| Form (8 typed fields) | ~60 lines | 0 lines | 100% |
| Grid (500 rows × 10 cols) | ~80 lines | 0 lines | 100% |
| Query filters (5 params) | ~15 lines | 0 lines | 100% |

**More importantly**: Zero bugs from forgotten conversions, wrong formats, or timezone issues.

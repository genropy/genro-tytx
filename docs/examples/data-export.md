# Example: Data Export/Import

Preserving types in data interchange.

## Scenario

Export data from one system and import into another while preserving:
- Decimal precision for financial data
- Date/datetime types
- Boolean flags
- Nested structures

## CSV with Type Markers

```python
import csv
from decimal import Decimal
from datetime import date, datetime
from genro_tytx import as_typed_text, from_text

# Data to export
records = [
    {"id": 1, "name": "Widget", "price": Decimal("99.99"), "date": date(2025, 1, 15)},
    {"id": 2, "name": "Gadget", "price": Decimal("149.50"), "date": date(2025, 1, 16)},
    {"id": 3, "name": "Thing", "price": Decimal("49.99"), "date": date(2025, 1, 17)},
]

# Export with types
with open("export.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["id", "name", "price", "date"])
    writer.writeheader()
    for record in records:
        writer.writerow({
            "id": as_typed_text(record["id"]),
            "name": record["name"],
            "price": as_typed_text(record["price"]),
            "date": as_typed_text(record["date"])
        })

# CSV content:
# id,name,price,date
# 1::I,Widget,99.99::D,2025-01-15::d
# 2::I,Gadget,149.50::D,2025-01-16::d
# 3::I,Thing,49.99::D,2025-01-17::d

# Import with types
with open("export.csv", "r") as f:
    reader = csv.DictReader(f)
    imported = []
    for row in reader:
        imported.append({
            "id": from_text(row["id"]),
            "name": row["name"],
            "price": from_text(row["price"]),
            "date": from_text(row["date"])
        })

# Types restored
assert imported[0]["price"] == Decimal("99.99")
assert imported[0]["date"] == date(2025, 1, 15)
```

## JSON Lines (JSONL) Export

```python
from genro_tytx import as_typed_json, from_json
from decimal import Decimal
from datetime import date

# Export as JSONL
records = [
    {"id": 1, "amount": Decimal("1000.00"), "date": date(2025, 1, 15)},
    {"id": 2, "amount": Decimal("2500.50"), "date": date(2025, 1, 16)},
]

with open("export.jsonl", "w") as f:
    for record in records:
        f.write(as_typed_json(record) + "\n")

# File content:
# {"id": 1, "amount": "1000.00::D", "date": "2025-01-15::d"}
# {"id": 2, "amount": "2500.50::D", "date": "2025-01-16::d"}

# Import JSONL
with open("export.jsonl", "r") as f:
    imported = [from_json(line) for line in f]

# Types preserved
assert imported[0]["amount"] == Decimal("1000.00")
```

## XML Data Export

<!-- test: test_core.py::TestXMLNewStructure::test_xml_roundtrip -->

```python
from genro_tytx import as_typed_xml, from_xml
from decimal import Decimal
from datetime import date

# Build export structure
export_data = {
    "export": {
        "attrs": {"version": "1.0", "date": date.today()},
        "value": {
            "records": {
                "attrs": {"count": 2},
                "value": {
                    "record": [
                        {
                            "attrs": {"id": 1},
                            "value": {
                                "name": {"attrs": {}, "value": "Widget"},
                                "price": {"attrs": {}, "value": Decimal("99.99")},
                                "date": {"attrs": {}, "value": date(2025, 1, 15)}
                            }
                        },
                        {
                            "attrs": {"id": 2},
                            "value": {
                                "name": {"attrs": {}, "value": "Gadget"},
                                "price": {"attrs": {}, "value": Decimal("149.50")},
                                "date": {"attrs": {}, "value": date(2025, 1, 16)}
                            }
                        }
                    ]
                }
            }
        }
    }
}

# Export
xml = as_typed_xml(export_data)
with open("export.xml", "w") as f:
    f.write(xml)

# Import
with open("export.xml", "r") as f:
    imported = from_xml(f.read())

# Access typed data
records = imported["export"]["value"]["records"]["value"]["record"]
assert records[0]["value"]["price"]["value"] == Decimal("99.99")
assert records[0]["value"]["date"]["value"] == date(2025, 1, 15)
```

## Batch Processing

```python
from genro_tytx import as_typed_json, from_json
from decimal import Decimal
from datetime import date
import gzip

def export_batch(records, filename):
    """Export records as gzipped JSONL."""
    with gzip.open(filename, "wt") as f:
        for record in records:
            f.write(as_typed_json(record) + "\n")

def import_batch(filename):
    """Import records from gzipped JSONL."""
    with gzip.open(filename, "rt") as f:
        for line in f:
            yield from_json(line)

# Usage
records = [
    {"id": i, "amount": Decimal(str(i * 100)), "date": date(2025, 1, i)}
    for i in range(1, 1001)
]

export_batch(records, "batch.jsonl.gz")

for record in import_batch("batch.jsonl.gz"):
    # record["amount"] is Decimal
    # record["date"] is date
    process(record)
```

## Database Export/Import

```python
from genro_tytx import as_typed_json, from_json
from decimal import Decimal
from datetime import date

# Export from database
def export_table(cursor, table_name, output_file):
    cursor.execute(f"SELECT * FROM {table_name}")
    columns = [desc[0] for desc in cursor.description]

    with open(output_file, "w") as f:
        for row in cursor:
            record = dict(zip(columns, row))
            f.write(as_typed_json(record) + "\n")

# Import to database
def import_table(cursor, table_name, input_file):
    with open(input_file, "r") as f:
        for line in f:
            record = from_json(line)
            columns = list(record.keys())
            values = list(record.values())
            placeholders = ", ".join(["?"] * len(columns))
            cursor.execute(
                f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})",
                values
            )
```

## Benefits

1. **Lossless**: No precision loss in Decimal values
2. **Type-safe**: Dates remain dates, not strings
3. **Portable**: Standard text formats (CSV, JSON, XML)
4. **Streamable**: Works with large datasets (JSONL)
5. **Compressible**: Text compresses well

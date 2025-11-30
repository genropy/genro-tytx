#!/usr/bin/env python3
"""
TYTX Performance Benchmarks

Run with: python benchmarks/benchmark.py
"""

import time
import json
from decimal import Decimal
from datetime import date, datetime, time as dt_time
from statistics import mean, stdev

# Import TYTX
from genro_tytx import (
    from_text, as_text, as_typed_text,
    from_json, as_json, as_typed_json,
    from_xml, as_xml, as_typed_xml,
    registry
)


def benchmark(name: str, func, iterations: int = 10000, warmup: int = 1000):
    """Run benchmark and return stats."""
    # Warmup
    for _ in range(warmup):
        func()

    # Measure
    times = []
    for _ in range(iterations):
        start = time.perf_counter_ns()
        func()
        end = time.perf_counter_ns()
        times.append(end - start)

    avg_ns = mean(times)
    std_ns = stdev(times) if len(times) > 1 else 0
    ops_per_sec = 1_000_000_000 / avg_ns if avg_ns > 0 else 0

    return {
        "name": name,
        "iterations": iterations,
        "avg_ns": avg_ns,
        "std_ns": std_ns,
        "avg_us": avg_ns / 1000,
        "ops_per_sec": ops_per_sec
    }


def print_result(result: dict):
    """Print benchmark result."""
    print(f"  {result['name']:<40} {result['avg_us']:>8.2f} µs  ({result['ops_per_sec']:>10,.0f} ops/sec)")


def run_benchmarks():
    print("=" * 70)
    print("TYTX Performance Benchmarks")
    print("=" * 70)

    # ==========================================================================
    # Text Parsing (from_text)
    # ==========================================================================
    print("\n📖 from_text (parse typed strings)")
    print("-" * 70)

    results = []

    # Integer
    results.append(benchmark("Integer (123::L)", lambda: from_text("123::L")))

    # Float
    results.append(benchmark("Float (3.14159::R)", lambda: from_text("3.14159::R")))

    # Decimal
    results.append(benchmark("Decimal (99999.99::N)", lambda: from_text("99999.99::N")))

    # Boolean
    results.append(benchmark("Boolean (true::B)", lambda: from_text("true::B")))

    # Date
    results.append(benchmark("Date (2025-01-15::D)", lambda: from_text("2025-01-15::D")))

    # DateTime
    results.append(benchmark("DateTime (2025-01-15T10:30:00Z::DHZ)",
                            lambda: from_text("2025-01-15T10:30:00Z::DHZ")))

    # Time
    results.append(benchmark("Time (10:30:00::H)", lambda: from_text("10:30:00::H")))

    # String (no type)
    results.append(benchmark("String (plain, no type)", lambda: from_text("hello world")))

    # JSON
    json_str = '{"a": 1, "b": 2}::JS'
    results.append(benchmark("JSON object", lambda: from_text(json_str)))

    for r in results:
        print_result(r)

    # ==========================================================================
    # Text Serialization (as_typed_text)
    # ==========================================================================
    print("\n📝 as_typed_text (serialize with type suffix)")
    print("-" * 70)

    results = []

    results.append(benchmark("Integer (123)", lambda: as_typed_text(123)))
    results.append(benchmark("Float (3.14159)", lambda: as_typed_text(3.14159)))
    results.append(benchmark("Decimal", lambda: as_typed_text(Decimal("99999.99"))))
    results.append(benchmark("Boolean (True)", lambda: as_typed_text(True)))
    results.append(benchmark("Date", lambda: as_typed_text(date(2025, 1, 15))))
    results.append(benchmark("DateTime", lambda: as_typed_text(datetime(2025, 1, 15, 10, 30))))
    results.append(benchmark("String", lambda: as_typed_text("hello world")))

    for r in results:
        print_result(r)

    # ==========================================================================
    # Typed Arrays
    # ==========================================================================
    print("\n📦 Typed Arrays")
    print("-" * 70)

    results = []

    # Parse
    results.append(benchmark("Parse [1,2,3]::L", lambda: from_text("[1,2,3]::L")))
    results.append(benchmark("Parse [[1,2],[3,4]]::L (nested)",
                            lambda: from_text("[[1,2],[3,4]]::L")))

    large_array = "[" + ",".join(str(i) for i in range(100)) + "]::L"
    results.append(benchmark("Parse 100 integers", lambda: from_text(large_array)))

    # Serialize
    small_list = [1, 2, 3]
    results.append(benchmark("Serialize [1,2,3] compact",
                            lambda: as_typed_text(small_list, compact_array=True)))

    nested_list = [[1, 2], [3, 4]]
    results.append(benchmark("Serialize nested compact",
                            lambda: as_typed_text(nested_list, compact_array=True)))

    large_list = list(range(100))
    results.append(benchmark("Serialize 100 integers compact",
                            lambda: as_typed_text(large_list, compact_array=True)))

    for r in results:
        print_result(r)

    # ==========================================================================
    # JSON Utilities
    # ==========================================================================
    print("\n🔄 JSON Utilities")
    print("-" * 70)

    results = []

    # Simple object
    simple_obj = {"price": Decimal("99.99"), "count": 42, "name": "Widget"}
    results.append(benchmark("as_typed_json (simple)", lambda: as_typed_json(simple_obj)))
    results.append(benchmark("as_json (simple)", lambda: as_json(simple_obj)))

    typed_json = '{"price": "99.99::N", "count": "42::L", "name": "Widget"}'
    results.append(benchmark("from_json (simple)", lambda: from_json(typed_json)))

    # Complex object
    complex_obj = {
        "order": {
            "id": 12345,
            "items": [
                {"name": "Widget", "price": Decimal("25.00"), "qty": 2},
                {"name": "Gadget", "price": Decimal("75.50"), "qty": 1}
            ],
            "total": Decimal("125.50"),
            "date": date(2025, 1, 15),
            "status": "shipped"
        }
    }
    results.append(benchmark("as_typed_json (complex)", lambda: as_typed_json(complex_obj)))
    results.append(benchmark("as_json (complex)", lambda: as_json(complex_obj)))

    complex_typed_json = as_typed_json(complex_obj)
    results.append(benchmark("from_json (complex)", lambda: from_json(complex_typed_json)))

    for r in results:
        print_result(r)

    # ==========================================================================
    # XML Utilities
    # ==========================================================================
    print("\n📄 XML Utilities")
    print("-" * 70)

    results = []

    # Simple
    simple_xml_data = {"price": {"attrs": {}, "value": Decimal("99.99")}}
    results.append(benchmark("as_typed_xml (simple)", lambda: as_typed_xml(simple_xml_data)))
    results.append(benchmark("as_xml (simple)", lambda: as_xml(simple_xml_data)))

    simple_xml = "<price>99.99::N</price>"
    results.append(benchmark("from_xml (simple)", lambda: from_xml(simple_xml)))

    # With attributes
    attr_xml_data = {
        "product": {
            "attrs": {"id": 123, "price": Decimal("99.50")},
            "value": "Widget"
        }
    }
    results.append(benchmark("as_typed_xml (with attrs)", lambda: as_typed_xml(attr_xml_data)))

    attr_xml = '<product id="123::L" price="99.50::N">Widget</product>'
    results.append(benchmark("from_xml (with attrs)", lambda: from_xml(attr_xml)))

    for r in results:
        print_result(r)

    # ==========================================================================
    # Registry Operations
    # ==========================================================================
    print("\n🔍 Registry Operations")
    print("-" * 70)

    results = []

    results.append(benchmark("registry.get('L')", lambda: registry.get("L")))
    results.append(benchmark("registry.get('INTEGER')", lambda: registry.get("INTEGER")))
    results.append(benchmark("registry.is_typed('123::L')", lambda: registry.is_typed("123::L")))
    results.append(benchmark("registry.is_typed('hello')", lambda: registry.is_typed("hello")))
    results.append(benchmark("registry.get_for_value(123)", lambda: registry.get_for_value(123)))
    results.append(benchmark("registry.get_for_value(Decimal)",
                            lambda: registry.get_for_value(Decimal("100"))))

    for r in results:
        print_result(r)

    # ==========================================================================
    # Roundtrip Comparisons
    # ==========================================================================
    print("\n🔁 Roundtrip (serialize + parse)")
    print("-" * 70)

    results = []

    # Integer roundtrip
    def int_roundtrip():
        s = as_typed_text(12345)
        return from_text(s)
    results.append(benchmark("Integer roundtrip", int_roundtrip))

    # Decimal roundtrip
    dec_val = Decimal("99999.99")
    def decimal_roundtrip():
        s = as_typed_text(dec_val)
        return from_text(s)
    results.append(benchmark("Decimal roundtrip", decimal_roundtrip))

    # Date roundtrip
    date_val = date(2025, 1, 15)
    def date_roundtrip():
        s = as_typed_text(date_val)
        return from_text(s)
    results.append(benchmark("Date roundtrip", date_roundtrip))

    # JSON roundtrip
    json_obj = {"price": Decimal("99.99"), "date": date(2025, 1, 15), "count": 42}
    def json_roundtrip():
        s = as_typed_json(json_obj)
        return from_json(s)
    results.append(benchmark("JSON object roundtrip", json_roundtrip))

    # Array roundtrip
    array_val = list(range(50))
    def array_roundtrip():
        s = as_typed_text(array_val, compact_array=True)
        return from_text(s)
    results.append(benchmark("Array (50 ints) roundtrip", array_roundtrip))

    for r in results:
        print_result(r)

    # ==========================================================================
    # Comparison with stdlib json
    # ==========================================================================
    print("\n⚡ Comparison with stdlib json")
    print("-" * 70)

    # Prepare data that json can handle (no Decimal/date)
    json_native = {"price": 99.99, "count": 42, "name": "Widget", "active": True}
    json_str = json.dumps(json_native)

    results = []
    results.append(benchmark("json.dumps (native)", lambda: json.dumps(json_native)))
    results.append(benchmark("json.loads (native)", lambda: json.loads(json_str)))

    # TYTX with same data (native types pass through)
    results.append(benchmark("as_typed_json (native types)", lambda: as_typed_json(json_native)))
    typed_native = as_typed_json(json_native)
    results.append(benchmark("from_json (native types)", lambda: from_json(typed_native)))

    for r in results:
        print_result(r)

    # ==========================================================================
    # Payload Size Comparison
    # ==========================================================================
    print("\n📏 Payload Size Comparison")
    print("-" * 70)

    def size_comparison(name: str, data: dict, description: str = ""):
        """Compare sizes of different serialization formats."""
        # Standard JSON (no types preserved)
        std_json = as_json(data)
        std_json_bytes = len(std_json.encode('utf-8'))

        # TYTX JSON (with type markers)
        tytx_json = as_typed_json(data)
        tytx_json_bytes = len(tytx_json.encode('utf-8'))

        # Raw JSON (Python's json.dumps)
        try:
            raw_json = json.dumps(data, default=str)
            raw_json_bytes = len(raw_json.encode('utf-8'))
        except Exception:
            raw_json_bytes = 0

        overhead = ((tytx_json_bytes - std_json_bytes) / std_json_bytes * 100) if std_json_bytes > 0 else 0

        print(f"\n  {name}")
        if description:
            print(f"  {description}")
        print(f"    Standard JSON:  {std_json_bytes:>6} bytes")
        print(f"    TYTX JSON:      {tytx_json_bytes:>6} bytes  (+{overhead:.1f}% overhead)")

        return {
            "name": name,
            "std_json": std_json_bytes,
            "tytx_json": tytx_json_bytes,
            "overhead_pct": overhead
        }

    # Test cases
    print("-" * 70)

    # Simple object with mixed types
    simple = {
        "id": 12345,
        "price": Decimal("99.99"),
        "date": date(2025, 1, 15),
        "active": True,
        "name": "Widget"
    }
    size_comparison("Simple object (5 fields)", simple,
                   "int, Decimal, date, bool, str")

    # Order with items
    order = {
        "order_id": 100001,
        "customer": "Acme Corp",
        "items": [
            {"sku": "W001", "name": "Widget", "price": Decimal("25.00"), "qty": 2},
            {"sku": "G001", "name": "Gadget", "price": Decimal("75.50"), "qty": 1},
            {"sku": "T001", "name": "Thing", "price": Decimal("15.25"), "qty": 5}
        ],
        "subtotal": Decimal("201.75"),
        "tax": Decimal("20.18"),
        "total": Decimal("221.93"),
        "created": datetime(2025, 1, 15, 10, 30, 0),
        "status": "pending"
    }
    size_comparison("Order with 3 items", order,
                   "Nested structure with Decimals and datetime")

    # Array of integers
    int_array = {"values": list(range(100))}
    size_comparison("Array of 100 integers", int_array,
                   "Homogeneous int array")

    # Array of decimals (prices)
    price_array = {"prices": [Decimal(f"{i}.{i:02d}") for i in range(1, 51)]}
    size_comparison("Array of 50 Decimals", price_array,
                   "Homogeneous Decimal array (prices)")

    # Dates array
    from datetime import timedelta
    base_date = date(2025, 1, 1)
    date_array = {"dates": [base_date + timedelta(days=i) for i in range(30)]}
    size_comparison("Array of 30 dates", date_array,
                   "Homogeneous date array")

    # Large nested structure
    large_data = {
        "report": {
            "id": 999,
            "title": "Monthly Sales Report",
            "generated": datetime(2025, 1, 31, 23, 59, 59),
            "summary": {
                "total_orders": 1234,
                "total_revenue": Decimal("123456.78"),
                "avg_order_value": Decimal("100.05"),
                "period_start": date(2025, 1, 1),
                "period_end": date(2025, 1, 31)
            },
            "top_products": [
                {"name": f"Product {i}", "sales": Decimal(f"{1000-i*10}.00"), "units": 100-i}
                for i in range(10)
            ],
            "daily_totals": [
                {"date": base_date + timedelta(days=i), "revenue": Decimal(f"{4000+i*100}.00")}
                for i in range(31)
            ]
        }
    }
    size_comparison("Large report structure", large_data,
                   "Complex nested with 10 products, 31 daily records")

    # Comparison with compact arrays
    print("\n" + "-" * 70)
    print("  📦 Typed Arrays (compact format) vs element-by-element")
    print("-" * 70)

    int_list = list(range(100))

    # Element by element (each value typed)
    element_typed = json.dumps([as_typed_text(v) for v in int_list])
    element_bytes = len(element_typed.encode('utf-8'))

    # Compact array format
    compact_typed = as_typed_text(int_list, compact_array=True)
    compact_bytes = len(compact_typed.encode('utf-8'))

    # Raw JSON array
    raw_array = json.dumps(int_list)
    raw_bytes = len(raw_array.encode('utf-8'))

    print(f"\n  100 integers:")
    print(f"    Raw JSON array:         {raw_bytes:>6} bytes")
    print(f"    Element-by-element:     {element_bytes:>6} bytes  (+{(element_bytes-raw_bytes)/raw_bytes*100:.1f}%)")
    print(f"    Compact typed array:    {compact_bytes:>6} bytes  (+{(compact_bytes-raw_bytes)/raw_bytes*100:.1f}%)")
    print(f"    Savings (compact vs element): {element_bytes - compact_bytes} bytes ({(element_bytes-compact_bytes)/element_bytes*100:.1f}%)")

    # Decimals
    dec_list = [Decimal(f"{i}.{i:02d}") for i in range(50)]

    element_typed_dec = json.dumps([as_typed_text(v) for v in dec_list])
    element_bytes_dec = len(element_typed_dec.encode('utf-8'))

    compact_typed_dec = as_typed_text(dec_list, compact_array=True)
    compact_bytes_dec = len(compact_typed_dec.encode('utf-8'))

    raw_dec = json.dumps([float(d) for d in dec_list])
    raw_bytes_dec = len(raw_dec.encode('utf-8'))

    print(f"\n  50 Decimals:")
    print(f"    Raw JSON (as float):    {raw_bytes_dec:>6} bytes")
    print(f"    Element-by-element:     {element_bytes_dec:>6} bytes  (+{(element_bytes_dec-raw_bytes_dec)/raw_bytes_dec*100:.1f}%)")
    print(f"    Compact typed array:    {compact_bytes_dec:>6} bytes  (+{(compact_bytes_dec-raw_bytes_dec)/raw_bytes_dec*100:.1f}%)")
    print(f"    Savings (compact vs element): {element_bytes_dec - compact_bytes_dec} bytes ({(element_bytes_dec-compact_bytes_dec)/element_bytes_dec*100:.1f}%)")

    print("\n" + "=" * 70)
    print("Benchmark complete!")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmarks()

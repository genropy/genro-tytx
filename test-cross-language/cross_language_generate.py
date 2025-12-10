# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
Generate encoded test files from Python for cross-language testing.

Run this first, then run the JS/TS cross-language tests.
"""

import json
import sys
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path

# Add python directory to path
sys.path.insert(0, str(Path(__file__).parent / "python"))

from dataset_builder import build_dataset

from genro_tytx import to_tytx, to_msgpack, to_xml

OUTPUT_DIR = Path(__file__).parent / "cross_language_data"
OUTPUT_DIR.mkdir(exist_ok=True)

# Build dataset
DATASET = build_dataset()

# Test cases for cross-language testing
TEST_CASES = {
    "decimal_simple": {"price": Decimal("100.50")},
    "date_simple": {"d": date(2025, 1, 15)},
    "datetime_utc": {"dt": datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)},
    "time_simple": {"t": time(10, 30, 45)},
    "mixed_types": {
        "price": Decimal("999.99"),
        "date": date(2025, 6, 15),
        "datetime": datetime(2025, 6, 15, 14, 30, 0, tzinfo=timezone.utc),
        "time": time(8, 0, 0),
        "string": "hello",
        "integer": 42,
        "float": 3.14,
        "boolean": True,
        "null": None,
    },
    "nested_structure": {
        "invoice": {
            "total": Decimal("1234.56"),
            "issued": date(2025, 3, 1),
            "items": [
                {"name": "Item A", "price": Decimal("100.00"), "qty": 2},
                {"name": "Item B", "price": Decimal("200.00"), "qty": 1},
            ],
        }
    },
    "array_of_decimals": [Decimal("1.1"), Decimal("2.2"), Decimal("3.3")],
    "array_of_dates": [date(2025, 1, 1), date(2025, 2, 1), date(2025, 3, 1)],
}


def generate_json_files():
    """Generate JSON encoded files."""
    for name, data in TEST_CASES.items():
        # Text format (::JS suffix)
        text_encoded = to_tytx(data)
        (OUTPUT_DIR / f"{name}.tytx.json").write_text(text_encoded, encoding="utf-8")

    print(f"Generated {len(TEST_CASES)} JSON files in {OUTPUT_DIR}")


def generate_msgpack_files():
    """Generate MessagePack encoded files."""
    try:
        import msgpack  # noqa: F401
    except ImportError:
        print("Skipping MessagePack - msgpack not installed")
        return

    for name, data in TEST_CASES.items():
        encoded = to_msgpack(data)
        (OUTPUT_DIR / f"{name}.tytx.msgpack").write_bytes(encoded)

    print(f"Generated {len(TEST_CASES)} MessagePack files in {OUTPUT_DIR}")


def generate_xml_files():
    """Generate XML encoded files."""
    for name, data in TEST_CASES.items():
        # Use root=True to wrap in <tytx_root>, which gets auto-unwrapped on decode
        encoded = to_xml(data, declaration=False, root=True)
        (OUTPUT_DIR / f"{name}.tytx.xml").write_text(encoded, encoding="utf-8")

    print(f"Generated {len(TEST_CASES)} XML files in {OUTPUT_DIR}")


def generate_expected_json():
    """Generate expected values as plain JSON for comparison."""
    def serialize_for_json(obj):
        if isinstance(obj, Decimal):
            return {"_type": "Decimal", "value": str(obj)}
        if isinstance(obj, date) and not isinstance(obj, datetime):
            return {"_type": "date", "value": obj.isoformat()}
        if isinstance(obj, datetime):
            return {"_type": "datetime", "value": obj.isoformat()}
        if isinstance(obj, time):
            return {"_type": "time", "value": obj.isoformat()}
        if isinstance(obj, list):
            return [serialize_for_json(v) for v in obj]
        if isinstance(obj, dict):
            return {k: serialize_for_json(v) for k, v in obj.items()}
        return obj

    expected = {name: serialize_for_json(data) for name, data in TEST_CASES.items()}
    (OUTPUT_DIR / "expected.json").write_text(
        json.dumps(expected, indent=2), encoding="utf-8"
    )
    print(f"Generated expected.json in {OUTPUT_DIR}")


if __name__ == "__main__":
    generate_json_files()
    generate_msgpack_files()
    generate_xml_files()
    generate_expected_json()
    print("\nAll cross-language test files generated!")

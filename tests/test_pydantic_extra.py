import builtins
import importlib
from datetime import datetime, time, timezone
from decimal import Decimal

import pytest

import genro_tytx.pydantic as gp
from genro_tytx import from_text, registry


def test_check_pydantic_import_error(monkeypatch):
    """_check_pydantic raises when import fails and resets cache."""
    original_import = builtins.__import__
    gp._pydantic_available = None

    def fake_import(name, *args, **kwargs):
        if name == "pydantic":
            raise ImportError("missing pydantic")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    with pytest.raises(ImportError, match="pydantic is required"):
        gp._check_pydantic()

    gp._pydantic_available = None
    importlib.reload(gp)


def test_model_dump_and_validate_hydrates_dict_and_bytes():
    """model_dump_json/model_validate_tytx cover dict, bytes and nested hydration."""
    pytest.importorskip("pydantic")
    TytxModel = gp.TytxModel

    class Payload(TytxModel):
        amount: Decimal
        when: datetime
        tags: list[int]
        metadata: dict[str, Decimal]
        count: int
        raw_values: list[int]
        items: list[dict[str, Decimal]]
        matrix: list[list[int]]

    obj = Payload(
        amount=Decimal("10.50"),
        when=datetime(2025, 1, 15, 9, 30, 0, tzinfo=timezone.utc),  # UTC-aware for DHZ
        tags=[1, 2],
        metadata={"price": Decimal("5.00")},
        count=7,
        raw_values=[1, 2],
        items=[{"price": Decimal("1.00")}, {"price": Decimal("2.00")}],
        matrix=[[5, 6]],
    )

    json_str = obj.model_dump_json(indent=2)
    assert '"amount": "10.50::N"' in json_str
    assert '"when": "2025-01-15T09:30:00Z::DHZ"' in json_str  # DHZ with Z suffix
    assert '"tags": [' in json_str

    hydrated = Payload.model_validate_tytx(
        {
            "amount": "10.50::N",
            "when": "2025-01-15T09:30:00Z::DHZ",  # DHZ format
            "tags": ["1::L", "2::L"],
            "metadata": {"price": "5.00::N"},
            "count": 7,
            "raw_values": [1, "2::L"],
            "items": [{"price": "1.00::N"}, {"price": "2.00::N"}],
            "matrix": [["5::L", "6::L"]],
        }
    )
    assert hydrated.amount == Decimal("10.50")
    assert hydrated.when == datetime(
        2025, 1, 15, 9, 30, 0, tzinfo=timezone.utc
    )  # UTC-aware
    assert hydrated.tags == [1, 2]
    assert hydrated.metadata["price"] == Decimal("5.00")
    assert hydrated.count == 7
    assert hydrated.raw_values == [1, 2]
    assert hydrated.items[0]["price"] == Decimal("1.00")
    assert hydrated.matrix == [[5, 6]]

    byte_hydrated = Payload.model_validate_tytx(
        b'{"amount": "10.50::N", "when": "2025-01-15T09:30:00Z::DHZ", "tags": ["1::L"], "metadata": {"price": "5.00::N"}, "count": 1, "raw_values": [1], "items": [{"price": "3.00::N"}], "matrix": [["7::L"]]}'
    )
    assert byte_hydrated.amount == Decimal("10.50")
    assert byte_hydrated.tags == [1]
    assert byte_hydrated.raw_values == [1]
    assert byte_hydrated.items[0]["price"] == Decimal("3.00")
    assert byte_hydrated.matrix == [[7]]

    roundtripped = Payload.model_validate_tytx(obj)
    assert roundtripped == obj


def test_dir_exposes_tytxmodel():
    """__dir__ includes TytxModel."""
    assert "TytxModel" in dir(gp)


def test_time_type_parse_serialize_and_registry():
    """Cover TimeType parse/serialize/format and registry type detection."""
    from genro_tytx import TimeType

    parsed = from_text("10:15:30::H")
    assert parsed == time(10, 15, 30)

    tt = TimeType()
    assert tt.serialize(parsed) == "10:15:30"
    assert tt.parse("10:15:30") == parsed
    assert tt.format(parsed, "%H:%M") == "10:15"

    assert registry._get_type_code_for_value(parsed) == "H"

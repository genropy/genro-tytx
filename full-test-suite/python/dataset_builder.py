"""
Dataset builder shared by the full test suite.

Reads the JSON spec and produces Python objects (Decimal/date/datetime/time/etc.).
Keeps generation deterministic so that JS can mirror the same values.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any

SPEC_PATH = Path(__file__).resolve().parents[1] / "dataset_spec.json"

getcontext().prec = 28  # generous precision for test decimals


@dataclass
class ColumnSpec:
    name: str
    type: str
    start: Any | None = None
    step: Any | None = None
    step_days: int | None = None
    step_seconds: int | None = None
    mod: Any | None = None
    template: Any | None = None
    choices: list[str] | None = None
    value: Any | None = None
    pattern: str | None = None


def _load_spec() -> dict[str, Any]:
    with SPEC_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _to_decimal(val: float | str) -> Decimal:
    if isinstance(val, str):
        return Decimal(val)
    return Decimal(str(val))


def _parse_time(value: str) -> time:
    # Supports HH:MM:SS or HH:MM:SS.microseconds
    if "." in value:
        main, micro = value.split(".")
        h, m, s = map(int, main.split(":"))
        microsecond = int(float(f"0.{micro}") * 1_000_000)
        return time(hour=h, minute=m, second=s, microsecond=microsecond)
    h, m, s = map(int, value.split(":"))
    return time(hour=h, minute=m, second=s)


def _parse_datetime(value: str, aware: bool = True) -> datetime:
    if value.endswith("Z"):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    dt = datetime.fromisoformat(value)
    if aware:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_scalar(entry: dict[str, Any]) -> Any:
    t = entry["type"]
    v = entry.get("value")
    if t == "decimal":
        return _to_decimal(v)
    if t == "date":
        return date.fromisoformat(v)
    if t == "datetime":
        return _parse_datetime(v, aware=True)
    if t == "datetime_naive":
        return _parse_datetime(v, aware=False)
    if t == "time":
        return _parse_time(v)
    if t == "bool":
        return bool(v)
    if t == "int":
        return int(v)
    if t == "float":
        return float(v)
    if t == "string":
        return str(v)
    if t == "null":
        return None
    raise ValueError(f"Unsupported scalar type: {t}")


def _resolve_refs(data: Any, scalar_map: dict[str, Any]) -> Any:
    if isinstance(data, str) and data.startswith("#"):
        return scalar_map[data[1:]]
    if isinstance(data, dict):
        return {k: _resolve_refs(v, scalar_map) for k, v in data.items()}
    if isinstance(data, list):
        return [_resolve_refs(item, scalar_map) for item in data]
    return data


def _build_scalars(spec: dict[str, Any]) -> dict[str, Any]:
    scalars = {}
    for entry in spec.get("scalar", []):
        scalars[entry["id"]] = _parse_scalar(entry)
    return scalars


def _build_composites(spec: dict[str, Any], scalar_map: dict[str, Any]) -> dict[str, Any]:
    composites = {}
    for entry in spec.get("composite", []):
        composites[entry["id"]] = _resolve_refs(entry["value"], scalar_map)
    return composites


def _column_value(col: ColumnSpec, row: int) -> Any:
    idx = row - 1
    if col.type == "int":
        base = int(col.start or 0) + idx * int(col.step or 0)
        if col.mod:
            base %= int(col.mod)
        return base
    if col.type == "float":
        base = float(col.start or 0.0) + idx * float(col.step or 0.0)
        if col.mod:
            base %= float(col.mod)
        return base
    if col.type == "decimal":
        base = _to_decimal(col.start or 0)
        step = _to_decimal(col.step or 0)
        value = base + step * idx
        if col.mod:
            value = value % _to_decimal(col.mod)
        return value
    if col.type == "bool":
        expr = col.pattern or ""
        if expr == "row%2==0":
            return idx % 2 == 0
        if expr == "row%3==0":
            return idx % 3 == 0
        if expr == "row%5<2":
            return idx % 5 < 2
        # Fallback: even/odd checks
        return idx % 2 == 0
    if col.type == "string":
        if col.template:
            return (
                col.template.replace("{row}", str(row))
                .replace("{row_mod_10}", str(row % 10))
                .replace("{row_mod_255}", str(row % 255))
                .replace("{row_mod_251}", str(row % 251))
                .replace("{row_pad_5}", str(row).zfill(5))
                .replace("{row_pad_12}", str(row).zfill(12))
            )
        if col.choices:
            return col.choices[idx % len(col.choices)]
        return ""
    if col.type == "date":
        start = date.fromisoformat(col.start)
        days = idx * (col.step_days or 0)
        return start + timedelta(days=days)
    if col.type == "datetime":
        start = _parse_datetime(col.start, aware=True)
        seconds = idx * (col.step_seconds or 0)
        return start + timedelta(seconds=seconds)
    if col.type == "datetime_naive":
        start = _parse_datetime(col.start, aware=False)
        seconds = idx * (col.step_seconds or 0)
        return start + timedelta(seconds=seconds)
    if col.type == "time":
        base_date = datetime.combine(date(1970, 1, 1), _parse_time(col.start))
        seconds = idx * (col.step_seconds or 0)
        new_time = (base_date + timedelta(seconds=seconds)).time()
        return new_time
    if col.type == "list":
        return col.template or []
    if col.type == "dict":
        return col.template or {}
    raise ValueError(f"Unsupported column type: {col.type}")


def _build_recordset(spec: dict[str, Any]) -> list[dict[str, Any]]:
    recordset_spec = spec["recordset"]
    rows = recordset_spec["rows"]
    columns = [
        ColumnSpec(
            name=col["name"],
            type=col["type"],
            start=col.get("start"),
            step=col.get("step"),
            step_days=col.get("step_days"),
            step_seconds=col.get("step_seconds"),
            mod=col.get("mod"),
            template=col.get("template"),
            choices=col.get("choices"),
            value=col.get("value"),
            pattern=col.get("pattern"),
        )
        for col in recordset_spec["columns"]
    ]

    data: list[dict[str, Any]] = []
    for row in range(1, rows + 1):
        record: dict[str, Any] = {}
        for col in columns:
            if col.value is not None:
                if col.type == "decimal":
                    val = _to_decimal(col.value)
                elif col.type == "int":
                    val = int(col.value)
                elif col.type == "float":
                    val = float(col.value)
                elif col.type == "bool":
                    val = bool(col.value)
                elif col.type == "string":
                    val = str(col.value)
                elif col.type == "date":
                    val = date.fromisoformat(col.value)
                elif col.type.startswith("datetime"):
                    val = _parse_datetime(col.value, aware=col.type == "datetime")
                elif col.type == "time":
                    val = _parse_time(col.value)
                else:
                    val = col.value
            else:
                val = _column_value(col, row)
            record[col.name] = val
        data.append(record)
    return data


def build_dataset() -> dict[str, Any]:
    """
    Build the full dataset as a dict with scalar/composite/recordset entries.
    """
    spec = _load_spec()
    scalars = _build_scalars(spec)
    composites = _build_composites(spec, scalars)
    recordset = _build_recordset(spec)
    payloads = list(scalars.values()) + list(composites.values())
    payloads.append({"records": recordset})
    return {
        "scalars": scalars,
        "composites": composites,
        "recordset": recordset,
        "payloads": payloads,
    }


if __name__ == "__main__":
    dataset = build_dataset()
    print(
        f"Scalars: {len(dataset['scalars'])}, "
        f"Composites: {len(dataset['composites'])}, "
        f"Record rows: {len(dataset['recordset'])}"
    )

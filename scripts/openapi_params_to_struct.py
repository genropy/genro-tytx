"""
OpenAPI → TYTX params structs generator.

Reads an OpenAPI v3 file (JSON or YAML) and emits a JSON list where each item is:
    {
        "path": "/pet/{petId}",
        "method": "GET",
        "params": {"petId": {"type": "L", "validate": {"required": true}}}
    }

Only parameters (path/query/header/cookie) are mapped. Request bodies and responses are ignored.
YAML support requires PyYAML; if unavailable, only JSON is accepted.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_openapi(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".yaml", ".yml"}:
        try:
            import yaml  # type: ignore
        except Exception as exc:  # pragma: no cover - optional dependency
            raise SystemExit("PyYAML is required to parse YAML files") from exc
        return yaml.safe_load(text)  # type: ignore[arg-type]
    return json.loads(text)


_MAP_TYPE: dict[tuple[str | None, str | None], str] = {
    ("integer", None): "L",
    ("integer", "int32"): "L",
    ("integer", "int64"): "L",
    ("number", None): "R",
    ("number", "float"): "R",
    ("number", "double"): "R",
    ("number", "decimal"): "N",
    ("boolean", None): "B",
    ("string", None): "T",
    ("string", "date"): "D",
    ("string", "date-time"): "DHZ",
    ("string", "time"): "H",
}


def to_tytx_field(schema: dict[str, Any] | None, required: bool) -> str | dict[str, Any]:
    if not isinstance(schema, dict):
        return "T"
    t = schema.get("type")
    fmt = schema.get("format")
    code = _MAP_TYPE.get((t, fmt)) or _MAP_TYPE.get((t, None)) or "T"
    validate: dict[str, Any] = {}
    if required:
        validate["required"] = True
    if "enum" in schema:
        validate["enum"] = schema["enum"]
    if "minLength" in schema:
        validate["min"] = schema["minLength"]
    if "maxLength" in schema:
        validate["max"] = schema["maxLength"]
    if "pattern" in schema:
        validate["pattern"] = schema["pattern"]
    if "minimum" in schema:
        validate["min"] = schema["minimum"]
    if "maximum" in schema:
        validate["max"] = schema["maximum"]
    if validate:
        return {"type": code, "validate": validate}
    return code


def merge_parameters(path_params: list[dict[str, Any]] | None, op_params: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    combined: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for group in (path_params or [], op_params or []):
        # group may be a list of parameter dicts
        if not isinstance(group, list):
            continue
        for param in group:
            if not isinstance(param, dict):
                continue
            name = param.get("name")
            loc = param.get("in")
            key = (name, loc)
            if name is None or loc is None:
                continue
            if key in seen:
                continue
            seen.add(key)
            combined.append(param)
    return combined


def convert(openapi: dict[str, Any]) -> list[dict[str, Any]]:
    paths: dict[str, Any] = openapi.get("paths") or {}
    operations: list[dict[str, Any]] = []

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        path_level_params = path_item.get("parameters")
        for method, op_obj in path_item.items():
            if method.lower() in {"parameters"} or method.startswith("x-"):
                continue
            if not isinstance(op_obj, dict):
                continue
            op_params = merge_parameters(path_level_params, op_obj.get("parameters"))
            fields: dict[str, Any] = {}
            for p in op_params:
                name = p.get("name", "param")
                schema = p.get("schema")
                required = bool(p.get("required", False))
                fields[name] = to_tytx_field(schema, required)
            operations.append({"path": path, "method": method.upper(), "params": fields})
    return operations


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert OpenAPI parameters to TYTX structs JSON.")
    parser.add_argument("input", type=Path, help="OpenAPI file (JSON or YAML)")
    parser.add_argument("-o", "--output", type=Path, default=Path("openapi_params_structs.json"), help="Output JSON path")
    args = parser.parse_args()

    openapi = load_openapi(args.input)
    operations = convert(openapi)
    args.output.write_text(json.dumps(operations, indent=2), encoding="utf-8")
    print(f"written {args.output} with {len(operations)} operations")


if __name__ == "__main__":
    main()

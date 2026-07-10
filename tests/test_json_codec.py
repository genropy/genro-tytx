# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for the public untyped JSON codec (json_dumps / json_loads)."""

import json

import pytest

from genro_tytx import encode as encode_module
from genro_tytx import json_dumps, json_loads


@pytest.fixture(params=[True, False], ids=["orjson", "stdlib"])
def orjson_toggle(request):
    """Exercise both the orjson and the stdlib json path."""
    original = encode_module.USE_ORJSON
    encode_module.USE_ORJSON = request.param and encode_module.HAS_ORJSON
    yield encode_module.USE_ORJSON
    encode_module.USE_ORJSON = original


ROUNDTRIP_VALUES = [
    {"a": 1, "b": 2},
    {"nested": {"x": [1, 2, 3]}},
    [1, "alfa", True, None],
    "hello world",
    42,
    3.14,
    True,
    None,
    [],
    {},
]


class TestJsonDumps:
    """json_dumps: Python value -> UTF-8 JSON bytes, untyped."""

    def test_returns_bytes(self, orjson_toggle):
        result = json_dumps({"a": 1})
        assert isinstance(result, bytes)

    def test_no_tytx_suffix(self, orjson_toggle):
        """Plain JSON only: no ::JS / ::N / ::D markers in the output."""
        result = json_dumps({"price": 100.5, "date": "2025-01-15"}).decode("utf-8")
        assert "::" not in result

    def test_matches_stdlib_json(self, orjson_toggle):
        value = {"a": 1, "b": [2, 3], "c": "x"}
        assert json_loads(json_dumps(value)) == value

    def test_non_ascii_not_escaped(self):
        """stdlib fallback must use ensure_ascii=False (no \\uXXXX escaping)."""
        original = encode_module.USE_ORJSON
        encode_module.USE_ORJSON = False
        try:
            result = json_dumps("àè")
        finally:
            encode_module.USE_ORJSON = original
        assert result == '"àè"'.encode()
        assert b"\\u" not in result


class TestJsonLoads:
    """json_loads: str | bytes -> Python value."""

    def test_accepts_str(self, orjson_toggle):
        assert json_loads('{"a": 1}') == {"a": 1}

    def test_accepts_bytes(self, orjson_toggle):
        assert json_loads(b'{"a": 1}') == {"a": 1}

    def test_matches_stdlib_json(self, orjson_toggle):
        payload = '{"a": 1, "b": [2, 3]}'
        assert json_loads(payload) == json.loads(payload)


class TestRoundtrip:
    """json_loads(json_dumps(x)) == x for JSON-native values."""

    @pytest.mark.parametrize("value", ROUNDTRIP_VALUES)
    def test_roundtrip(self, value, orjson_toggle):
        assert json_loads(json_dumps(value)) == value

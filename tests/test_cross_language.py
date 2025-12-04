# Copyright 2025 Softwell S.r.l.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Cross-language compatibility tests for TYTX protocol.

These tests verify that Python implementation produces output
identical to the shared fixtures that JS and TS must also match.
"""

import json
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path

import pytest

import genro_tytx as tytx

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "cross_language.json"


@pytest.fixture
def fixtures():
    """Load cross-language test fixtures."""
    with open(FIXTURES_PATH) as f:
        return json.load(f)


def _create_value(spec):
    """Create Python value from fixture spec."""
    if isinstance(spec, dict) and "type" in spec:
        type_name = spec["type"]
        value = spec["value"]
        if type_name == "int":
            return int(value)
        elif type_name == "float":
            return float(value)
        elif type_name == "bool":
            return bool(value)
        elif type_name == "string":
            return str(value)
        elif type_name == "date":
            return date.fromisoformat(value)
        elif type_name == "datetime":
            # Handle Z suffix for Python 3.10 compatibility
            if value.endswith("Z"):
                value = value[:-1] + "+00:00"
            return datetime.fromisoformat(value)
        elif type_name == "time":
            return time.fromisoformat(value)
        elif type_name == "decimal":
            return Decimal(value)
    return spec


def _create_object(obj):
    """Recursively create Python object from fixture spec."""
    if isinstance(obj, dict):
        if "type" in obj and "value" in obj and len(obj) == 2:
            return _create_value(obj)
        return {k: _create_object(v) for k, v in obj.items() if not k.startswith("_")}
    elif isinstance(obj, list):
        return [_create_object(item) for item in obj]
    return obj


class TestTypedText:
    """Test as_typed_text produces expected output."""

    def test_typed_text_cases(self, fixtures):
        """Verify as_typed_text output matches fixtures."""
        for case in fixtures["typed_text"]["cases"]:
            value = _create_value(case["input"])
            expected = case["expected"]
            result = tytx.as_typed_text(value)
            assert (
                result == expected
            ), f"as_typed_text({value!r}) = {result!r}, expected {expected!r}"


class TestFromText:
    """Test from_text parses typed strings correctly."""

    def test_from_text_cases(self, fixtures):
        """Verify from_text output matches fixtures."""
        for case in fixtures["from_text"]["cases"]:
            input_str = case["input"]
            expected_spec = case["expected"]
            result = tytx.from_text(input_str)

            expected_type = expected_spec["type"]
            expected_value = expected_spec["value"]

            if expected_type == "int":
                assert isinstance(result, int)
                assert result == expected_value
            elif expected_type == "float":
                assert isinstance(result, float)
                assert result == pytest.approx(expected_value)
            elif expected_type == "bool":
                assert isinstance(result, bool)
                assert result == expected_value
            elif expected_type == "string":
                assert isinstance(result, str)
                assert result == expected_value
            elif expected_type == "date":
                assert isinstance(result, date)
                assert result == date.fromisoformat(expected_value)
            elif expected_type == "datetime":
                assert isinstance(result, datetime)
                # Handle Z suffix for Python 3.10 compatibility
                if expected_value.endswith("Z"):
                    expected_value = expected_value[:-1] + "+00:00"
                assert result == datetime.fromisoformat(expected_value)
            elif expected_type == "time":
                assert isinstance(result, time)
                assert result == time.fromisoformat(expected_value)
            elif expected_type == "decimal":
                assert isinstance(result, Decimal)
                assert str(result) == expected_value


class TestTypedJson:
    """Test as_typed_json produces expected output."""

    def test_typed_json_cases(self, fixtures):
        """Verify as_typed_json output matches fixtures."""
        for case in fixtures["typed_json"]["cases"]:
            input_obj = _create_object(case["input"])
            expected = case["expected"]

            result_str = tytx.as_typed_json(input_obj)
            result = json.loads(result_str)

            assert result == expected, (
                f"Case '{case.get('name', 'unnamed')}': "
                f"as_typed_json({input_obj!r}) = {result!r}, expected {expected!r}"
            )


class TestJsonRoundtrip:
    """Test JSON roundtrip preserves values."""

    def test_roundtrip_cases(self, fixtures):
        """Verify from_json(as_typed_json(x)) == x."""
        for case in fixtures["json_roundtrip"]["cases"]:
            input_obj = _create_object(case["input"])

            json_str = tytx.as_typed_json(input_obj)
            result = tytx.from_json(json_str)

            # Compare with expected types
            self._assert_equal_typed(result, input_obj, case.get("name", "unnamed"))

    def _assert_equal_typed(self, result, expected, name):
        """Assert two values are equal with correct types."""
        if isinstance(expected, dict):
            assert isinstance(
                result, dict
            ), f"{name}: expected dict, got {type(result)}"
            assert set(result.keys()) == set(expected.keys()), f"{name}: keys mismatch"
            for k in expected:
                self._assert_equal_typed(result[k], expected[k], f"{name}.{k}")
        elif isinstance(expected, list):
            assert isinstance(
                result, list
            ), f"{name}: expected list, got {type(result)}"
            assert len(result) == len(expected), f"{name}: length mismatch"
            for i, (r, e) in enumerate(zip(result, expected, strict=True)):
                self._assert_equal_typed(r, e, f"{name}[{i}]")
        elif isinstance(expected, date) and not isinstance(expected, datetime):
            assert isinstance(
                result, date
            ), f"{name}: expected date, got {type(result)}"
            assert result == expected
        elif isinstance(expected, datetime):
            assert isinstance(
                result, datetime
            ), f"{name}: expected datetime, got {type(result)}"
            assert result == expected
        elif isinstance(expected, float):
            assert isinstance(
                result, (int, float)
            ), f"{name}: expected number, got {type(result)}"
            assert result == pytest.approx(expected)
        else:
            assert result == expected, f"{name}: {result!r} != {expected!r}"

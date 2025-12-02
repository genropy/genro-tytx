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

"""Tests for TYTX detection helpers and hydrate_dict."""

from datetime import date
from decimal import Decimal

import pytest

from genro_tytx import (
    TYTX_PREFIX,
    XTYTX_PREFIX,
    detect_tytx_mode,
    hydrate_dict,
    is_tytx_payload,
)


class TestConstants:
    """Tests for exported constants."""

    def test_tytx_prefix(self) -> None:
        """TYTX_PREFIX should be 'TYTX://'."""
        assert TYTX_PREFIX == "TYTX://"

    def test_xtytx_prefix(self) -> None:
        """XTYTX_PREFIX should be 'XTYTX://'."""
        assert XTYTX_PREFIX == "XTYTX://"


class TestIsTytxPayload:
    """Tests for is_tytx_payload() function."""

    def test_tytx_string(self) -> None:
        """Detect TYTX:// prefix in string."""
        assert is_tytx_payload('TYTX://{"price": "100::N"}') is True

    def test_xtytx_string(self) -> None:
        """Detect XTYTX:// prefix in string."""
        assert is_tytx_payload('XTYTX://{"data": "..."}') is True

    def test_plain_json_string(self) -> None:
        """Plain JSON without prefix returns False."""
        assert is_tytx_payload('{"price": 100}') is False

    def test_tytx_bytes(self) -> None:
        """Detect TYTX:// prefix in bytes."""
        assert is_tytx_payload(b'TYTX://{"price": "100::N"}') is True

    def test_xtytx_bytes(self) -> None:
        """Detect XTYTX:// prefix in bytes."""
        assert is_tytx_payload(b'XTYTX://{"data": "..."}') is True

    def test_plain_json_bytes(self) -> None:
        """Plain JSON bytes without prefix returns False."""
        assert is_tytx_payload(b'{"price": 100}') is False

    def test_empty_string(self) -> None:
        """Empty string returns False."""
        assert is_tytx_payload("") is False

    def test_empty_bytes(self) -> None:
        """Empty bytes returns False."""
        assert is_tytx_payload(b"") is False


class TestDetectTytxMode:
    """Tests for detect_tytx_mode() function."""

    def test_tytx_string(self) -> None:
        """Detect 'tytx' mode from TYTX:// prefix."""
        assert detect_tytx_mode('TYTX://{"price": "100::N"}') == "tytx"

    def test_xtytx_string(self) -> None:
        """Detect 'xtytx' mode from XTYTX:// prefix."""
        assert detect_tytx_mode('XTYTX://{"data": "..."}') == "xtytx"

    def test_plain_json_string(self) -> None:
        """Plain JSON returns None."""
        assert detect_tytx_mode('{"price": 100}') is None

    def test_tytx_bytes(self) -> None:
        """Detect 'tytx' mode from bytes."""
        assert detect_tytx_mode(b'TYTX://{"price": "100::N"}') == "tytx"

    def test_xtytx_bytes(self) -> None:
        """Detect 'xtytx' mode from bytes."""
        assert detect_tytx_mode(b'XTYTX://{"data": "..."}') == "xtytx"

    def test_plain_json_bytes(self) -> None:
        """Plain JSON bytes returns None."""
        assert detect_tytx_mode(b'{"price": 100}') is None

    def test_empty_string(self) -> None:
        """Empty string returns None."""
        assert detect_tytx_mode("") is None

    def test_xtytx_takes_precedence(self) -> None:
        """XTYTX check happens before TYTX check."""
        # Ensure XTYTX is detected correctly (not as TYTX)
        assert detect_tytx_mode("XTYTX://...") == "xtytx"


class TestHydrateDict:
    """Tests for hydrate_dict() function."""

    def test_simple_hydration(self) -> None:
        """Hydrate simple typed values."""
        data = {"price": "100::N", "count": "5::L"}
        result = hydrate_dict(data)

        assert result["price"] == Decimal("100")
        assert result["count"] == 5
        # Original should be unchanged
        assert data["price"] == "100::N"

    def test_with_date(self) -> None:
        """Hydrate date values."""
        data = {"date": "2025-01-15::D"}
        result = hydrate_dict(data)

        assert result["date"] == date(2025, 1, 15)

    def test_nested_dict(self) -> None:
        """Hydrate nested dictionaries."""
        data = {"order": {"total": "99.99::N", "items": "3::L"}}
        result = hydrate_dict(data)

        assert result["order"]["total"] == Decimal("99.99")
        assert result["order"]["items"] == 3

    def test_with_list(self) -> None:
        """Hydrate lists of typed values."""
        data = {"prices": ["10::N", "20::N", "30::N"]}
        result = hydrate_dict(data)

        assert result["prices"] == [Decimal("10"), Decimal("20"), Decimal("30")]

    def test_inplace_false(self) -> None:
        """Default behavior creates new dict."""
        data = {"price": "100::N"}
        result = hydrate_dict(data, inplace=False)

        assert result is not data
        assert data["price"] == "100::N"  # Original unchanged
        assert result["price"] == Decimal("100")

    def test_inplace_true(self) -> None:
        """inplace=True modifies original dict."""
        data = {"price": "100::N"}
        result = hydrate_dict(data, inplace=True)

        assert result is data
        assert data["price"] == Decimal("100")

    def test_mixed_types(self) -> None:
        """Hydrate dict with mixed typed and plain values."""
        data = {"price": "100::N", "name": "Product", "active": True, "count": 5}
        result = hydrate_dict(data)

        assert result["price"] == Decimal("100")
        assert result["name"] == "Product"  # Plain string unchanged
        assert result["active"] is True  # Bool unchanged
        assert result["count"] == 5  # Plain int unchanged

    def test_empty_dict(self) -> None:
        """Hydrate empty dict returns empty dict."""
        result = hydrate_dict({})
        assert result == {}

    def test_no_typed_values(self) -> None:
        """Dict without typed values returns equivalent dict."""
        data = {"name": "Test", "value": 42}
        result = hydrate_dict(data)

        assert result == data

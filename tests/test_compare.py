# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for TYTX comparison utilities."""

from datetime import datetime, timezone, timedelta
from decimal import Decimal

from genro_tytx.compare import datetime_equivalent, tytx_equivalent


class TestDatetimeEquivalent:
    """Tests for datetime_equivalent function."""

    def test_both_naive_equal(self):
        """Two equal naive datetimes."""
        a = datetime(2025, 1, 15, 10, 30)
        b = datetime(2025, 1, 15, 10, 30)
        assert datetime_equivalent(a, b) is True

    def test_both_naive_not_equal(self):
        """Two different naive datetimes."""
        a = datetime(2025, 1, 15, 10, 30)
        b = datetime(2025, 1, 15, 11, 30)
        assert datetime_equivalent(a, b) is False

    def test_both_aware_equal(self):
        """Two equal aware datetimes (same timezone)."""
        a = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        b = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        assert datetime_equivalent(a, b) is True

    def test_both_aware_different_tz_same_instant(self):
        """Two aware datetimes in different timezones representing same instant."""
        utc = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        plus_one = datetime(2025, 1, 15, 11, 30, tzinfo=timezone(timedelta(hours=1)))
        assert datetime_equivalent(utc, plus_one) is True

    def test_both_aware_not_equal(self):
        """Two different aware datetimes."""
        a = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        b = datetime(2025, 1, 15, 11, 30, tzinfo=timezone.utc)
        assert datetime_equivalent(a, b) is False

    def test_naive_vs_aware_utc_equal(self):
        """Naive datetime equals aware UTC with same wall-clock time."""
        naive = datetime(2025, 1, 15, 10, 30)
        aware = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        assert datetime_equivalent(naive, aware) is True

    def test_aware_vs_naive_equal(self):
        """Aware UTC datetime equals naive with same wall-clock time (reversed args)."""
        aware = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        naive = datetime(2025, 1, 15, 10, 30)
        assert datetime_equivalent(aware, naive) is True

    def test_naive_vs_aware_not_equal(self):
        """Naive datetime not equal to aware with different wall-clock time."""
        naive = datetime(2025, 1, 15, 10, 30)
        aware = datetime(2025, 1, 15, 11, 30, tzinfo=timezone.utc)
        assert datetime_equivalent(naive, aware) is False


class TestTytxEquivalent:
    """Tests for tytx_equivalent function."""

    def test_same_values(self):
        """Equal primitive values."""
        assert tytx_equivalent(42, 42) is True
        assert tytx_equivalent("hello", "hello") is True
        assert tytx_equivalent(3.14, 3.14) is True

    def test_different_values(self):
        """Different primitive values."""
        assert tytx_equivalent(42, 43) is False
        assert tytx_equivalent("hello", "world") is False

    def test_decimal_equal(self):
        """Equal Decimal values."""
        assert tytx_equivalent(Decimal("100.50"), Decimal("100.50")) is True

    def test_datetime_naive_vs_aware(self):
        """Datetime naive vs aware UTC equivalence."""
        naive = datetime(2025, 1, 15, 10, 30)
        aware = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        assert tytx_equivalent(naive, aware) is True

    def test_dict_equal(self):
        """Equal dicts."""
        a = {"x": 1, "y": 2}
        b = {"x": 1, "y": 2}
        assert tytx_equivalent(a, b) is True

    def test_dict_different_keys(self):
        """Dicts with different keys."""
        a = {"x": 1, "y": 2}
        b = {"x": 1, "z": 2}
        assert tytx_equivalent(a, b) is False

    def test_dict_different_values(self):
        """Dicts with same keys but different values."""
        a = {"x": 1, "y": 2}
        b = {"x": 1, "y": 3}
        assert tytx_equivalent(a, b) is False

    def test_dict_with_datetime(self):
        """Dict containing datetime naive vs aware."""
        a = {"dt": datetime(2025, 1, 15, 10, 30)}
        b = {"dt": datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)}
        assert tytx_equivalent(a, b) is True

    def test_list_equal(self):
        """Equal lists."""
        a = [1, 2, 3]
        b = [1, 2, 3]
        assert tytx_equivalent(a, b) is True

    def test_list_different_length(self):
        """Lists with different lengths."""
        a = [1, 2, 3]
        b = [1, 2]
        assert tytx_equivalent(a, b) is False

    def test_list_different_values(self):
        """Lists with same length but different values."""
        a = [1, 2, 3]
        b = [1, 2, 4]
        assert tytx_equivalent(a, b) is False

    def test_list_with_datetime(self):
        """List containing datetime naive vs aware."""
        a = [datetime(2025, 1, 15, 10, 30)]
        b = [datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)]
        assert tytx_equivalent(a, b) is True

    def test_nested_structure(self):
        """Nested dict/list with datetime."""
        a = {
            "items": [
                {"dt": datetime(2025, 1, 15, 10, 30)},
                {"dt": datetime(2025, 1, 16, 11, 45)},
            ]
        }
        b = {
            "items": [
                {"dt": datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)},
                {"dt": datetime(2025, 1, 16, 11, 45, tzinfo=timezone.utc)},
            ]
        }
        assert tytx_equivalent(a, b) is True

    def test_type_mismatch(self):
        """Different types are not equivalent."""
        assert tytx_equivalent(42, "42") is False
        assert tytx_equivalent([1, 2], {"a": 1}) is False

    def test_none_values(self):
        """None values."""
        assert tytx_equivalent(None, None) is True
        assert tytx_equivalent(None, 0) is False

    def test_xml_attrs_differ(self):
        """Different XML attrs should NOT be equivalent."""
        a = {"item": {"attrs": {"id": 1}, "value": "test"}}
        b = {"item": {"attrs": {"id": 2}, "value": "test"}}
        assert tytx_equivalent(a, b) is False

    def test_xml_attrs_same(self):
        """Same XML attrs should be equivalent."""
        a = {"item": {"attrs": {"id": 1}, "value": "test"}}
        b = {"item": {"attrs": {"id": 1}, "value": "test"}}
        assert tytx_equivalent(a, b) is True

    def test_xml_attrs_empty_both(self):
        """Empty attrs on both sides should be equivalent."""
        a = {"item": {"attrs": {}, "value": "test"}}
        b = {"item": {"attrs": {}, "value": "test"}}
        assert tytx_equivalent(a, b) is True

    def test_xml_attrs_one_empty_one_not(self):
        """One with attrs, one without should NOT be equivalent."""
        a = {"item": {"attrs": {"id": 1}, "value": "test"}}
        b = {"item": {"attrs": {}, "value": "test"}}
        assert tytx_equivalent(a, b) is False

    def test_xml_nested_attrs(self):
        """Nested XML structure with attrs."""
        a = {
            "order": {
                "attrs": {"id": 123},
                "value": {
                    "item": {"attrs": {"name": "Widget"}, "value": None}
                }
            }
        }
        b = {
            "order": {
                "attrs": {"id": 123},
                "value": {
                    "item": {"attrs": {"name": "Widget"}, "value": None}
                }
            }
        }
        assert tytx_equivalent(a, b) is True

    def test_xml_nested_attrs_differ(self):
        """Nested XML structure with different attrs."""
        a = {
            "order": {
                "attrs": {"id": 123},
                "value": {
                    "item": {"attrs": {"name": "Widget"}, "value": None}
                }
            }
        }
        b = {
            "order": {
                "attrs": {"id": 456},  # Different id
                "value": {
                    "item": {"attrs": {"name": "Widget"}, "value": None}
                }
            }
        }
        assert tytx_equivalent(a, b) is False

import logging
from datetime import datetime, timezone

from genro_tytx import DateTimeType, NaiveDateTimeType, TypeRegistry


def test_datetime_type_serialize_and_locale():
    dt_type = DateTimeType()
    dt = datetime(2025, 1, 1, 10, 30, 0)
    assert dt_type.serialize(dt) == "2025-01-01T10:30:00Z"
    # _format_with_locale should delegate to strftime and restore locale
    assert dt_type._format_with_locale(dt, "%Y-%m-%d %H:%M:%S", None) == "2025-01-01 10:30:00"

    naive = NaiveDateTimeType()
    naive_dt = datetime(2025, 1, 1, 10, 30, 0)
    assert naive.serialize(naive_dt) == "2025-01-01T10:30:00"
    assert naive._format_with_locale(naive_dt, "%Y-%m-%d %H:%M:%S", None) == "2025-01-01 10:30:00"


def test_naive_datetime_serializes_as_dhz():
    """Naive datetime is serialized as DHZ (not DH) - by design."""
    from genro_tytx import as_typed_text

    # Naive datetime → DHZ (assumes UTC)
    naive_dt = datetime(2025, 12, 3, 9, 42, 7)
    result = as_typed_text(naive_dt)
    assert result == "2025-12-03T09:42:07Z::DHZ"
    assert "::DH" not in result or "::DHZ" in result  # Must be DHZ, not DH

    # Aware datetime → DHZ
    aware_dt = datetime(2025, 12, 3, 9, 42, 7, tzinfo=timezone.utc)
    result = as_typed_text(aware_dt)
    assert result == "2025-12-03T09:42:07Z::DHZ"


def test_naive_datetime_logs_debug_warning(caplog):
    """Serializing naive datetime emits a debug log message."""
    dt_type = DateTimeType()
    naive_dt = datetime(2025, 1, 15, 10, 30, 0)

    with caplog.at_level(logging.DEBUG, logger="genro_tytx.builtin"):
        result = dt_type.serialize(naive_dt)

    assert result == "2025-01-15T10:30:00Z"
    assert "Naive datetime" in caplog.text
    assert "DHZ" in caplog.text
    assert "deprecated" in caplog.text.lower()


def test_aware_datetime_no_debug_warning(caplog):
    """Serializing aware datetime does NOT emit a debug log message."""
    dt_type = DateTimeType()
    aware_dt = datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)

    with caplog.at_level(logging.DEBUG, logger="genro_tytx.builtin"):
        result = dt_type.serialize(aware_dt)

    assert result == "2025-01-15T10:30:00Z"
    assert "Naive datetime" not in caplog.text


def test_registry_leaf_and_compact_fallbacks():
    reg = TypeRegistry()
    # _get_leaf_type_code returns None for list (not a leaf)
    assert reg._get_leaf_type_code([1, 2]) is None

    # Force missing type class branch in _try_compact_array
    reg._codes.pop("L", None)  # type: ignore[attr-defined]
    assert reg._try_compact_array([1, 2]) is None  # type: ignore[attr-defined]

    # _serialize_array_elements recurses into nested lists
    serialized = reg._serialize_array_elements([[1, 2], [3]])  # type: ignore[attr-defined]
    assert serialized.startswith('[["1"')

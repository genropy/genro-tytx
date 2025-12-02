from datetime import datetime

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

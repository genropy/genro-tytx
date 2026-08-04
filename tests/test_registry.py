# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for custom type registration hooks (register_type)."""

import pytest

from genro_tytx import from_tytx, register_type, to_tytx
from genro_tytx.registry import SUFFIX_TO_TYPE, TYPE_REGISTRY


class Point:
    """A minimal custom type local to the test (no external dependency)."""

    def __init__(self, x: int, y: int):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return isinstance(other, Point) and (self.x, self.y) == (other.x, other.y)


def _serialize_point(p: Point) -> str:
    return f"{p.x},{p.y}"


def _deserialize_point(s: str) -> Point:
    x, y = s.split(",")
    return Point(int(x), int(y))


@pytest.fixture
def clean_registry():
    """Snapshot and restore the global registry around each test."""
    type_snapshot = dict(TYPE_REGISTRY)
    suffix_snapshot = dict(SUFFIX_TO_TYPE)
    yield
    TYPE_REGISTRY.clear()
    TYPE_REGISTRY.update(type_snapshot)
    SUFFIX_TO_TYPE.clear()
    SUFFIX_TO_TYPE.update(suffix_snapshot)


class TestRegisterType:
    """register_type exposes custom types to the TYTX codec."""

    def test_populates_both_registries(self, clean_registry):
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        assert TYPE_REGISTRY[Point] == ("PT", _serialize_point, False)
        assert SUFFIX_TO_TYPE["PT"] == (Point, _deserialize_point)

    def test_unregistered_type_raises(self):
        """Without registration the codec cannot serialize the custom type."""
        with pytest.raises(TypeError, match="not JSON serializable"):
            to_tytx({"p": Point(1, 2)})

    def test_scalar_roundtrip(self, clean_registry):
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        encoded = to_tytx(Point(3, 4))
        assert encoded.endswith("::PT")
        assert from_tytx(encoded) == Point(3, 4)

    def test_inside_structure_roundtrip(self, clean_registry):
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        encoded = to_tytx([1, Point(5, 6), "k"])
        assert "::PT" in encoded
        assert encoded.endswith("::JS")
        assert from_tytx(encoded) == [1, Point(5, 6), "k"]

    def test_inside_dict_roundtrip(self, clean_registry):
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        encoded = to_tytx({"origin": Point(0, 0), "name": "test"})
        assert from_tytx(encoded) == {"origin": Point(0, 0), "name": "test"}

    def test_json_native_skips_suffix(self, clean_registry):
        """json_native=True: no suffix unless force_suffix is requested."""

        class Tag(str):
            pass

        register_type(Tag, "TG", str, Tag, json_native=True)
        # json_native types without force_suffix are emitted bare (utils.raw_encode)
        assert to_tytx(Tag("hello")) == "hello"

    def test_registry_restored_after_test(self):
        """The clean_registry fixture must leave no trace of Point."""
        assert Point not in TYPE_REGISTRY
        assert "PT" not in SUFFIX_TO_TYPE

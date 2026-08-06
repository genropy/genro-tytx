# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for custom type registration hooks (register_type)."""

from datetime import date, time
from decimal import Decimal

import pytest

from genro_tytx import from_tytx, register_class, register_type, to_tytx
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

    def test_suffix_collision_raises(self, clean_registry):
        """A suffix owned by a different type cannot be silently clobbered."""
        with pytest.raises(ValueError, match="already registered"):
            register_type(Point, "N", _serialize_point, _deserialize_point)

    def test_custom_suffix_collision_raises(self, clean_registry):
        """Two different custom classes cannot share a suffix."""
        register_type(Point, "PT", _serialize_point, _deserialize_point)

        class Other:
            pass

        with pytest.raises(ValueError, match="already registered"):
            register_type(Other, "PT", str, lambda s: Other())

    def test_same_class_reregistration_replaces(self, clean_registry):
        """Re-registering the same class replaces both hooks coherently."""
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        register_type(
            Point,
            "PT",
            lambda p: f"{p.x};{p.y}",
            lambda s: Point(*map(int, s.split(";"))),
        )
        encoded = to_tytx(Point(1, 2))
        assert encoded == "1;2::PT"
        assert from_tytx(encoded) == Point(1, 2)

    def test_subclass_not_matched(self, clean_registry):
        """Matching is by exact type: a subclass is not serialized."""
        register_type(Point, "PT", _serialize_point, _deserialize_point)

        class Point3(Point):
            pass

        with pytest.raises(TypeError, match="not JSON serializable"):
            to_tytx({"p": Point3(1, 2)})


class TestRegisterClass:
    """register_class derives the registration from class-level hooks."""

    def test_decorator_registers(self, clean_registry):
        @register_class
        class Vec:
            __tytx_suffix__ = "VC"

            def __init__(self, a, b):
                self.a, self.b = a, b

            def __eq__(self, other):
                return isinstance(other, Vec) and (self.a, self.b) == (other.a, other.b)

            def to_tytx(self):
                return f"{self.a}|{self.b}"

            @classmethod
            def from_tytx(cls, s):
                a, b = s.split("|")
                return cls(int(a), int(b))

        assert TYPE_REGISTRY[Vec][0] == "VC"
        assert SUFFIX_TO_TYPE["VC"][0] is Vec
        # decorator returns the class unchanged
        assert Vec.__tytx_suffix__ == "VC"

        encoded = to_tytx([1, Vec(3, 4), "k"])
        assert "::VC" in encoded
        assert from_tytx(encoded) == [1, Vec(3, 4), "k"]

    def test_from_tytx_is_classmethod(self, clean_registry):
        """The deserializer stored is the bound classmethod (one string arg)."""

        @register_class
        class Vec:
            __tytx_suffix__ = "VC"

            def __init__(self, a):
                self.a = a

            def to_tytx(self):
                return str(self.a)

            @classmethod
            def from_tytx(cls, s):
                return cls(int(s))

        _, deserializer = SUFFIX_TO_TYPE["VC"]
        rebuilt = deserializer("7")
        assert isinstance(rebuilt, Vec)
        assert rebuilt.a == 7

    def test_json_native_flag_read_from_class(self, clean_registry):
        @register_class
        class Tag(str):
            __tytx_suffix__ = "TG"
            __tytx_json_native__ = True

            def to_tytx(self):
                return str(self)

            @classmethod
            def from_tytx(cls, s):
                return cls(s)

        assert TYPE_REGISTRY[Tag][2] is True
        # json_native emitted bare without force_suffix
        assert to_tytx(Tag("hello")) == "hello"

    def test_missing_suffix_raises(self, clean_registry):
        """A class without __tytx_suffix__ cannot be registered."""
        with pytest.raises(AttributeError):

            @register_class
            class Broken:
                def to_tytx(self):
                    return ""

                @classmethod
                def from_tytx(cls, s):
                    return cls()

    def test_missing_to_tytx_raises(self, clean_registry):
        """register_class fails fast when to_tytx is missing."""
        with pytest.raises(AttributeError, match="to_tytx"):

            @register_class
            class Broken:
                __tytx_suffix__ = "BK"

                @classmethod
                def from_tytx(cls, s):
                    return cls()

    def test_missing_from_tytx_raises(self, clean_registry):
        """register_class fails fast when from_tytx is missing."""
        with pytest.raises(AttributeError, match="from_tytx"):

            @register_class
            class Broken:
                __tytx_suffix__ = "BK"

                def to_tytx(self):
                    return ""


class TestMsgpackCustomTypes:
    """Registered custom types travel over the msgpack transport (ext code 4)."""

    def test_scalar_roundtrip(self, clean_registry):
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        packed = to_tytx(Point(3, 4), transport="msgpack")
        assert isinstance(packed, bytes)
        assert from_tytx(packed, transport="msgpack") == Point(3, 4)

    def test_nested_in_dict_and_list(self, clean_registry):
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        value = {"origin": Point(0, 0), "path": [Point(1, 2), "k", 5]}
        packed = to_tytx(value, transport="msgpack")
        assert from_tytx(packed, transport="msgpack") == value

    def test_unknown_suffix_degrades_to_string(self, clean_registry):
        """A receiver that does not know the suffix gets '<payload>::<suffix>'."""
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        packed = to_tytx({"p": Point(3, 4)}, transport="msgpack")
        del SUFFIX_TO_TYPE["PT"]  # simulate a receiver without the registration
        result = from_tytx(packed, transport="msgpack")
        assert result == {"p": "3,4::PT"}

    def test_payload_containing_colons(self, clean_registry):
        """The ext payload splits at the FIRST ':' only."""

        class Clockish:
            def __init__(self, text):
                self.text = text

            def __eq__(self, other):
                return isinstance(other, Clockish) and other.text == self.text

        register_type(Clockish, "CK", lambda c: c.text, Clockish)
        value = Clockish("12:30:45")
        packed = to_tytx({"t": value}, transport="msgpack")
        assert from_tytx(packed, transport="msgpack") == {"t": value}

    def test_builtin_ext_types_unchanged(self, clean_registry):
        """Ext codes 1/2/3 (Decimal, date, time) keep working alongside code 4."""
        register_type(Point, "PT", _serialize_point, _deserialize_point)
        value = {
            "price": Decimal("100.50"),
            "day": date(2025, 1, 15),
            "at": time(10, 30, 0),
            "p": Point(1, 2),
        }
        packed = to_tytx(value, transport="msgpack")
        assert from_tytx(packed, transport="msgpack") == value

    def test_unregistered_type_still_raises(self):
        """Without registration msgpack still refuses the unknown type."""
        with pytest.raises(TypeError):
            to_tytx({"p": Point(1, 2)}, transport="msgpack")

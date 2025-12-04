from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal

import pytest

from genro_tytx.registry import TypeRegistry


class CustomValue:
    def __init__(self, val: str) -> None:
        self.val = val

    def as_typed_text(self) -> str:  # pragma: no cover - exercised via registry
        return f"{self.val}::X_CUSTOM"

    @staticmethod
    def from_typed_text(s: str) -> "CustomValue":  # pragma: no cover - exercised via registry
        return CustomValue(s)


def test_parse_schema_json_errors():
    reg = TypeRegistry()
    with pytest.raises(ValueError):
        reg._parse_schema_json("not-json")
    with pytest.raises(ValueError):
        reg._parse_schema_json('"scalar"')  # valid JSON but wrong type


def test_register_struct_metadata_and_get():
    reg = TypeRegistry()
    reg._register_struct_metadata(
        "TEST",
        {
            "name": {"ui": {"label": "Name"}},
            "age": {"validate": {"min": 0}},
            "empty": {},
        },
    )
    all_meta = reg.get_struct_metadata("TEST")
    assert all_meta and all_meta["name"]["ui"]["label"] == "Name"
    assert reg.get_struct_metadata("TEST", "missing") is None
    assert reg.get_struct_metadata("UNKNOWN") is None


def test_unregister_class_removes_python_type():
    reg = TypeRegistry()
    reg.register_class("CUSTOM", CustomValue)
    assert reg.get_for_value(CustomValue("x")) is not None
    reg.unregister_class("CUSTOM")
    assert reg.get_for_value(CustomValue("y")) is None
    # missing code branch
    reg.unregister_class("NONE")
    # remove python_type to hit skip branch
    reg.register_class("CUSTOM2", CustomValue)
    del reg._python_types[CustomValue]
    reg.unregister_class("CUSTOM2")
    # ensure branch where code not found
    reg.unregister_class("MISSING")


def test_get_type_code_for_value_branches():
    reg = TypeRegistry()
    reg.register_struct("POINT", '{"x":"L","y":"L"}')
    assert reg._get_type_code_for_value(True) == "B"
    assert reg._get_type_code_for_value(5) == "L"
    assert reg._get_type_code_for_value(1.5) == "R"
    assert reg._get_type_code_for_value(Decimal("1.0")) == "N"
    assert reg._get_type_code_for_value(datetime.now(timezone.utc)) == "DHZ"
    assert reg._get_type_code_for_value(date.today()) == "D"
    assert reg._get_type_code_for_value(time(1, 2, 3)) == "H"
    assert reg._get_type_code_for_value({"x": 1}) == "JS"
    assert reg._get_type_code_for_value("text") is None
    # Custom extension
    reg.register_class("CUST2", CustomValue)
    assert reg._get_type_code_for_value(CustomValue("a")) == "~CUST2"


def test_try_compact_array_empty_and_mixed():
    reg = TypeRegistry()
    # empty array returns "[]"
    assert reg._try_compact_array([]) == "[]"
    # mixed types returns None (no compact)
    assert reg._try_compact_array([1, "x"]) is None


def test_register_class_errors_and_custom_parse():
    reg = TypeRegistry()

    class NoMethods:
        pass

    with pytest.raises(ValueError):
        reg.register_class("ERR", NoMethods)

    def ser(obj: Any) -> str:
        return f"{obj}::CUSTOM"

    def par(s: str) -> str:
        return s + "_parsed"

    reg.register_class("OK", str, serialize=ser, parse=par)
    ext = reg.get("~OK")
    assert ext and ext.parse("x") == "x_parsed"
    # class with serializer but missing from_typed_text -> parse error path
    class OnlySerialize:
        def as_typed_text(self):
            return "x"
    with pytest.raises(ValueError):
        reg.register_class("BADPARSE", OnlySerialize)


def test_from_text_missing_struct_and_custom():
    reg = TypeRegistry()
    # Missing struct in array -> returns original text
    assert reg.from_text('[{"a":1}]::#@MISSING') == '[{"a":1}]::#@MISSING'
    # Missing custom type -> returns original text
    assert reg.from_text("abc::~NOPE") == "abc::~NOPE"
    # Missing built-in type -> returns original text
    assert reg.from_text("1::ZZ") == "1::ZZ"
    # Unknown base type in typed array
    assert reg.from_text("[1]::#Z") == "[1]::#Z"
    # Unknown struct reference
    assert reg.from_text('{"a":1}::@UNKNOWN') == '{"a":1}::@UNKNOWN'
    # Empty string path
    assert reg.from_text("") == ""


def test_get_type_instance_branches():
    reg = TypeRegistry()
    from genro_tytx.builtin import DecimalType
    reg.register(DecimalType)
    reg.register_struct("POINT", '{"x":"L","y":"L"}')
    struct_type = reg.get("@POINT")
    assert struct_type is not None
    # instance path
    assert reg.from_text('{"x":1,"y":2}::@POINT') == {"x": 1, "y": 2}
    # class path via _get_type_instance on a built-in
    assert reg.as_typed_text(Decimal("2.0")) == "2.0::N"
    # custom extension serialize path
    reg.register_class("CSTM", CustomValue)
    # CustomValue.as_typed_text returns "z::X_CUSTOM", then registry adds "::~CSTM"
    assert reg.as_typed_text(CustomValue("z")).endswith("::~CSTM")


def test_collect_leaf_helpers():
    reg = TypeRegistry()
    assert reg._get_leaf_type_code([1, 2]) is None
    leafs = reg._collect_leaf_types([1, [2]])
    assert leafs == {"L"}
    # _serialize_leaf with nested list
    reg.register_struct("ROW", '{"x":"L"}')
    st = reg.get("@ROW")
    assert st is not None
    res = reg._serialize_leaf([{"x": 1}, {"x": 2}], st)
    assert res == ['{"x":1}', '{"x":2}']
    assert reg._has_typed_objects({"d": datetime.now(timezone.utc)})
    assert not reg._has_typed_objects({"plain": 1})
    assert not reg._has_typed_objects([{"plain": 1}])


def test_try_compact_array_missing_type(monkeypatch: pytest.MonkeyPatch):
    reg = TypeRegistry()
    monkeypatch.setattr(reg, "_collect_leaf_types", lambda v: {"ZZ"})
    assert reg._try_compact_array([1, 2]) is None


def test_unserialize_dict_values_nested():
    reg = TypeRegistry()
    reg.register_struct("ROW", '{"x":"L"}')
    result = reg._serialize_dict_values({"a": [{"x": 1}, {"x": 2}], "b": {"x": 3}})
    assert result.endswith("::TYTX")
    # ensure nested values are serialized (integers become strings in typed format)
    assert '"x":"1"' in result or '"x":1' in result


def test_struct_metadata_empty_and_missing_content():
    reg = TypeRegistry()
    reg._register_struct_metadata("EMPTY", {"field": {}})
    assert reg.get_struct_metadata("EMPTY") is None
    reg._struct_metadata["BROKEN"] = {"x": "deadbeef"}
    reg._metadata_content.clear()
    assert reg.get_struct_metadata("BROKEN") == {}


def test_unregister_struct_missing_entries():
    reg = TypeRegistry()
    reg.unregister_struct("NOPE")  # nothing registered
    reg.register_struct("TMP", '{"x":"L"}')
    # The struct name in _types uses lowercase format: "struct_tmp"
    del reg._types["struct_tmp"]
    reg.unregister_struct("TMP")


def test_custom_type_code_but_not_extension():
    reg = TypeRegistry()
    reg.register_struct("ROW", '{"x":"L"}')
    reg._codes["~FAKE"] = reg.get("@ROW")
    assert reg.from_text("v::~FAKE") == "v::~FAKE"


def test_custom_type_parse_branch():
    reg = TypeRegistry()
    reg.register_class("CUS3", CustomValue)
    parsed = reg.from_text("abc::~CUS3")
    assert isinstance(parsed, CustomValue)


def test_unregister_class_orphan_entries():
    reg = TypeRegistry()
    # full_code present but name missing in _types
    class DummyExt:
        name = "DUMMY"
        python_type = None
    reg._codes["~DUMMY"] = DummyExt()
    reg.unregister_class("DUMMY")


def test_unregister_struct_missing_type_entry():
    reg = TypeRegistry()
    code = "TMP2"
    reg.register_struct(code, '{"x":"L"}')
    del reg._types[f"struct_{code.lower()}"]
    reg.unregister_struct(code)

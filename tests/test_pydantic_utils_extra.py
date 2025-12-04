from __future__ import annotations

import typing
from typing import Literal, Union

import pytest
from pydantic import BaseModel, Field

from genro_tytx.pydantic_utils import PydanticConverter
from genro_tytx.registry import registry


def test_extract_field_metadata_literal_and_required():
    converter = PydanticConverter(registry)

    class Model(BaseModel):
        status: Literal["a", "b"] = Field(default="a", description="desc")
        code: str = Field(min_length=1, max_length=3, pattern="^A", default="AAA", title="Label")

    schema, metadata = converter._model_to_schema(Model, include_nested=True)
    assert schema["status"] == "T"
    assert metadata["status"]["validate"]["enum"] == ["a", "b"]
    assert "required" in metadata["status"]["validate"] or "default" in metadata["status"]["validate"]
    assert metadata["code"]["validate"]["min"] == 1
    assert metadata["code"]["validate"]["max"] == 3
    assert metadata["code"]["validate"]["pattern"] == "^A"
    assert metadata["code"]["validate"]["default"] == "AAA"
    assert metadata["code"]["ui"]["label"] == "Label"


def test_extract_field_metadata_manual_metadata():
    converter = PydanticConverter(registry)

    class Dummy:
        def __init__(self):
            pattern_holder = type("_PydanticGeneralMetadata", (), {"pattern": r"^x+$"})
            self.metadata = (pattern_holder(),)
            self.title = "Lbl"
            self.description = "Desc"
            self.default = 5

        def is_required(self):
            return True

    meta = converter._extract_field_metadata(Dummy(), str)
    assert meta["validate"]["pattern"] == r"^x+$"
    assert meta["validate"]["default"] == 5
    assert meta["validate"]["required"] is True
    assert meta["ui"]["label"] == "Lbl"
    assert meta["ui"]["hint"] == "Desc"

def test_extract_field_metadata_constraint_objects():
    converter = PydanticConverter(registry)

    # Note: class names must match what _extract_field_metadata looks for
    class MinLen:
        def __init__(self):
            self.min_length = 1
    class MaxLen:
        def __init__(self):
            self.max_length = 3
    class Pattern:  # Must be "Pattern" not "PatternC"
        def __init__(self):
            self.pattern = "^x$"
    class Ge:
        def __init__(self):
            self.ge = 0
    class Le:
        def __init__(self):
            self.le = 5
    class Gt:
        def __init__(self):
            self.gt = 1
    class Lt:
        def __init__(self):
            self.lt = 4

    class Dummy:
        def __init__(self):
            self.metadata = (MinLen(), MaxLen(), Pattern(), Ge(), Le(), Gt(), Lt())
            self.title = None
            self.description = None
            self.default = "d"
        def is_required(self):
            return True

    meta = converter._extract_field_metadata(Dummy(), str)
    validate = meta["validate"]
    # Gt(gt=1) → min = gt + 1 = 2 (last processed wins)
    assert validate["min"] == 2
    # Lt(lt=4) → max = lt - 1 = 3 (last processed wins)
    assert validate["max"] == 3
    assert validate["pattern"] == "^x$"
    assert validate["required"] is True
    assert validate["default"] == "d"


def test_python_type_to_tytx_code_literal_and_union(monkeypatch: pytest.MonkeyPatch):
    converter = PydanticConverter(registry)
    # Note: bool is subclass of int in Python, so Literal[True] → "L" (not "B")
    # isinstance(True, int) returns True
    assert converter._python_type_to_tytx_code(Literal[True], False, set()) == "L"
    # Test Union with actual types (not empty args which would cause IndexError)
    # Save original functions before patching to avoid recursion
    original_get_origin = typing.get_origin
    original_get_args = typing.get_args
    sentinel = object()
    monkeypatch.setattr("typing.get_origin", lambda obj: Union if obj is sentinel else original_get_origin(obj))
    # Return (str,) so the Union has a non-None type to process
    monkeypatch.setattr("typing.get_args", lambda obj: (str,) if obj is sentinel else original_get_args(obj))
    assert converter._python_type_to_tytx_code(sentinel, False, set()) == "T"


def test_python_type_to_tytx_code_nested_registration():
    converter = PydanticConverter(registry)

    class Inner(BaseModel):
        x: int

    class Outer(BaseModel):
        inner: Inner

    registry.unregister_struct("INNER")
    registry.unregister_struct("OUTER")
    code = converter._python_type_to_tytx_code(Outer, True, set())
    assert code == "@OUTER"
    assert registry.get_struct("INNER") is not None
    registry.unregister_struct("OUTER")
    registry.unregister_struct("INNER")

    # unique struct to force registration path again
    class Inner2(BaseModel):
        x: int
    class Outer2(BaseModel):
        inner: Inner2
    registry.unregister_struct("INNER2")
    registry.unregister_struct("OUTER2")
    code2 = converter._python_type_to_tytx_code(Outer2, True, set())
    assert code2 == "@OUTER2"
    registry.unregister_struct("OUTER2")
    registry.unregister_struct("INNER2")

    # with fresh registry to ensure register_struct branch
    from genro_tytx.registry import TypeRegistry

    fresh = TypeRegistry()
    conv2 = PydanticConverter(fresh)
    class Inner3(BaseModel):
        x: int
    class Outer3(BaseModel):
        inner: Inner3
    conv2._python_type_to_tytx_code(Outer3, True, set())
    assert fresh.get_struct("INNER3") is not None


def test_model_from_struct_default_name_and_keyerror():
    converter = PydanticConverter(registry)
    with pytest.raises(KeyError):
        converter.model_from_struct("MISSING")
    registry.register_struct("NAMED", '{"a":"T"}')
    try:
        Model = converter.model_from_struct("NAMED")
        assert Model.__name__ == "Named"
        Custom = converter.model_from_struct("NAMED", model_name="CustomModel")
        assert Custom.__name__ == "CustomModel"
    finally:
        registry.unregister_struct("NAMED")


def test_schema_to_model_constraints_ui_required():
    converter = PydanticConverter(registry)
    registry.register_struct(
        "TESTSCHEMA",
        {"value": "L"},
        metadata={
            "value": {
                "validate": {
                    "min": 1,
                    "max": 5,
                },
                "ui": {"label": "Val", "hint": "H"},
            }
        },
    )
    Model = converter._schema_to_model(
        "TESTSCHEMA", registry.get_struct("TESTSCHEMA"), "TestSchema", {}
    )
    field = Model.model_fields["value"]
    assert field.title == "Val"
    assert field.description == "H"
    # Check annotations for numeric constraints (Ge/Le)
    from annotated_types import Ge, Le
    constraints = {type(c).__name__: c for c in field.metadata}
    assert "Ge" in constraints
    assert constraints["Ge"].ge == 1
    assert "Le" in constraints
    assert constraints["Le"].le == 5
    registry.unregister_struct("TESTSCHEMA")


def test_apply_metadata_annotations_multiple():
    converter = PydanticConverter(registry)
    meta = {"min": 1, "max": 2, "pattern": r"^\d+$"}
    typ, info = converter._apply_metadata(int, meta, is_numeric=True)
    # When numeric min/max, annotations length==2 -> Annotated
    from typing import Annotated, get_origin

    assert get_origin(typ) is Annotated
    # info is a FieldInfo object; pattern is passed via Field(pattern=...)
    # Pydantic stores it in info.metadata as _PydanticGeneralMetadata
    from pydantic.fields import FieldInfo
    assert isinstance(info, FieldInfo)
    # Check pattern is stored in metadata
    assert len(info.metadata) > 0
    pattern_meta = info.metadata[0]
    assert hasattr(pattern_meta, "pattern")
    assert pattern_meta.pattern == r"^\d+$"


def test_apply_metadata_annotations_multiple_with_default():
    converter = PydanticConverter(registry)
    meta = {"min": 1, "max": 2, "default": 5}
    typ, info = converter._apply_metadata(int, meta, is_numeric=True)
    from typing import Annotated, get_origin

    assert get_origin(typ) is Annotated
    assert info.default == 5


def test_apply_metadata_string_constraints():
    converter = PydanticConverter(registry)
    typ, info = converter._apply_metadata(str, {"min": 1, "max": 3, "default": "x"}, is_numeric=False)
    from typing import Annotated, get_origin
    assert get_origin(typ) is Annotated
    assert info.default == "x"


def test_extract_field_metadata_default_none_is_optional():
    converter = PydanticConverter(registry)

    class Model(BaseModel):
        title: str | None = Field(default=None, title="T")

    schema, metadata = converter._model_to_schema(Model, include_nested=True)
    assert metadata["title"]["ui"]["label"] == "T"
    # When default=None, there's no validate section (only ui)
    assert "validate" not in metadata["title"] or metadata["title"]["validate"].get("required") is None


# Additional tests to cover remaining branch partials

def test_pydantic_general_metadata_without_pattern():
    """Test branch 290->268: _PydanticGeneralMetadata without pattern attribute."""
    converter = PydanticConverter(registry)

    class Dummy:
        def __init__(self):
            # _PydanticGeneralMetadata WITHOUT pattern (or pattern=None)
            no_pattern = type("_PydanticGeneralMetadata", (), {"other_attr": "value"})
            with_none_pattern = type("_PydanticGeneralMetadata", (), {"pattern": None})
            self.metadata = (no_pattern(), with_none_pattern())
            self.title = "T"
            self.description = None
            self.default = None

        def is_required(self):
            return False

    meta = converter._extract_field_metadata(Dummy(), str)
    # Should have ui.label but no pattern in validate
    assert meta["ui"]["label"] == "T"
    assert "validate" not in meta or "pattern" not in meta.get("validate", {})


def test_field_without_default_attribute():
    """Test branch 304->312: field_info without default attribute."""
    converter = PydanticConverter(registry)

    class DummyNoDefault:
        def __init__(self):
            self.metadata = ()
            self.title = "Label"
            self.description = None
            # NO default attribute at all

        def is_required(self):
            return False

    meta = converter._extract_field_metadata(DummyNoDefault(), str)
    assert meta["ui"]["label"] == "Label"
    assert "validate" not in meta or "default" not in meta.get("validate", {})


def test_literal_with_empty_args():
    """Test branch 315->319: Literal type with empty args."""
    converter = PydanticConverter(registry)

    # Create a mock annotation that looks like Literal but has empty args
    class DummyField:
        def __init__(self):
            self.metadata = ()
            self.title = None
            self.description = None
            self.default = None
            # Use actual Literal[()] which has empty args
            self.annotation = Literal[()]

        def is_required(self):
            return False

    # Directly test _extract_field_metadata with Literal[()]
    meta = converter._extract_field_metadata(DummyField(), Literal[()])
    # With empty args, enum should not be added (or be empty)
    assert meta is None or "validate" not in meta or "enum" not in meta.get("validate", {})


def test_nested_struct_already_registered():
    """Test branch 397->404: nested struct already registered, skip re-registration."""
    from genro_tytx.registry import TypeRegistry

    fresh = TypeRegistry()
    conv = PydanticConverter(fresh)

    class Inner(BaseModel):
        x: int

    class Outer(BaseModel):
        inner: Inner

    # Pre-register INNER with a different schema
    fresh.register_struct("INNER", {"x": "T"})  # Different from actual (should be "L")

    # Now convert Outer - should NOT overwrite the existing INNER
    code = conv._python_type_to_tytx_code(Outer, True, set())
    assert code == "@OUTER"

    # INNER should still have the original schema (not overwritten)
    assert fresh.get_struct("INNER") == {"x": "T"}


def test_apply_metadata_no_annotations():
    """Test branch 587->590: annotations list is empty (len != 1 and != 2)."""
    converter = PydanticConverter(registry)

    # Only field_kwargs, no annotations (no min/max)
    meta = {"label": "Test", "hint": "A hint"}
    typ, info = converter._apply_metadata(str, meta, is_numeric=False)

    # No min/max means no annotations, but field_kwargs exist
    assert typ is str  # Type unchanged (no Annotated)
    assert info.title == "Test"
    assert info.description == "A hint"


def test_apply_metadata_single_annotation():
    """Test single annotation case (len(annotations) == 1)."""
    converter = PydanticConverter(registry)
    from typing import Annotated, get_args, get_origin

    # Only min, no max -> single annotation
    meta = {"min": 5}
    typ, info = converter._apply_metadata(int, meta, is_numeric=True)

    assert get_origin(typ) is Annotated
    # Should have exactly one annotation (Ge)
    args = get_args(typ)
    # args[0] is the base type, args[1:] are annotations
    assert len(args) == 2  # (int, Ge(5))


def test_apply_metadata_two_annotations_no_field_kwargs():
    """Test branch 587->590: two annotations but no field_kwargs."""
    converter = PydanticConverter(registry)
    from typing import Annotated, get_args, get_origin

    # min + max -> two annotations, but no label/hint/default/pattern
    meta = {"min": 1, "max": 10}
    typ, info = converter._apply_metadata(int, meta, is_numeric=True)

    assert get_origin(typ) is Annotated
    # Should have two annotations (Ge, Le)
    args = get_args(typ)
    assert len(args) == 3  # (int, Ge(1), Le(10))
    # info should be ... (Ellipsis) since no field_kwargs
    assert info is ...

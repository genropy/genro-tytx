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
Utility functions for TYTX schema generation (standalone).

This module provides standalone helpers that work without the registry:
- Pydantic model → TYTX struct conversion (returns inline FieldDef format)
- TYTX struct → Pydantic model generation (accepts inline FieldDef format)
- Python type → TYTX code mapping

NOTE: For registry-based operations with separate schema/metadata, use:
- registry.struct_from_model() → returns (schema, metadata) tuple
- registry.model_from_struct() → uses registered metadata

This module uses inline FieldDef format for self-contained schemas:
    Simple field:
        "name": "T"

    Field with constraints:
        "name": {
            "type": "T",
            "validate": {"min": 1, "max": 100},
            "ui": {"label": "Name"}
        }
"""

from __future__ import annotations

import types
import typing
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

# Symbol prefix for struct schema types
STRUCT_PREFIX = "@"
ARRAY_PREFIX = "#"

# Python type to TYTX code mapping
TYPE_MAPPING: dict[type, str] = {
    str: "T",
    int: "L",
    float: "R",
    bool: "B",
    Decimal: "N",
    date: "D",
    datetime: "DHZ",
    time: "H",
}


def python_type_to_tytx_code(
    python_type: type | None,
    *,
    include_nested: bool = True,
    register_callback: Any | None = None,
    _registered: set[type] | None = None,
) -> str:
    """
    Map a Python type annotation to a TYTX type code.

    Handles:
    - Basic types (str, int, float, bool, Decimal, date, datetime, time)
    - Optional types (Optional[X] -> X)
    - List types (list[X] -> #X)
    - Dict types (dict -> JS)
    - Nested Pydantic models (-> @MODEL_NAME)
    - Union types (uses first non-None type)

    Args:
        python_type: Python type annotation
        include_nested: If True, recursively process nested Pydantic models
        register_callback: Optional callback(code, schema) to register nested structs
        _registered: Internal set to track already processed models

    Returns:
        TYTX type code string
    """
    if _registered is None:
        _registered = set()

    # Handle None
    if python_type is None:
        return "T"  # Default to text

    # Get origin for generic types (Optional, List, Union, etc.)
    origin = typing.get_origin(python_type)
    args = typing.get_args(python_type)

    # Handle Optional[X] and Union[X, None] -> X
    # In Python 3.10+, `str | None` creates a types.UnionType
    if origin is typing.Union or isinstance(python_type, types.UnionType):
        # For types.UnionType, get_args works correctly
        if not args:
            args = typing.get_args(python_type)
        # Filter out NoneType
        non_none_args = [a for a in args if a is not type(None)]
        if len(non_none_args) == 1:
            return python_type_to_tytx_code(
                non_none_args[0],
                include_nested=include_nested,
                register_callback=register_callback,
                _registered=_registered,
            )
        # Multiple types - use first one
        if non_none_args:
            return python_type_to_tytx_code(
                non_none_args[0],
                include_nested=include_nested,
                register_callback=register_callback,
                _registered=_registered,
            )
        return "T"

    # Handle list[X] -> #X
    if origin is list:
        if args:
            inner_code = python_type_to_tytx_code(
                args[0],
                include_nested=include_nested,
                register_callback=register_callback,
                _registered=_registered,
            )
            return f"{ARRAY_PREFIX}{inner_code}"
        return f"{ARRAY_PREFIX}T"  # list without type arg

    # Handle dict -> JS
    if origin is dict or python_type is dict:
        return "JS"

    # Check if it's a Pydantic model (for nested structs)
    try:
        from pydantic import BaseModel

        if isinstance(python_type, type) and issubclass(python_type, BaseModel):
            # Nested Pydantic model
            struct_code = python_type.__name__.upper()

            if include_nested and python_type not in _registered:
                _registered.add(python_type)
                nested_schema = model_to_schema(
                    python_type,
                    include_nested=include_nested,
                    register_callback=register_callback,
                    _registered=_registered,
                )
                # Register nested struct via callback
                if register_callback is not None:
                    register_callback(struct_code, nested_schema)

            return f"{STRUCT_PREFIX}{struct_code}"
    except ImportError:
        pass

    # Map basic Python types to TYTX codes
    if isinstance(python_type, type):
        return TYPE_MAPPING.get(python_type, "T")

    # Handle ForwardRef (string type annotations like "Node" in list["Node"])
    if isinstance(python_type, typing.ForwardRef):
        ref_name = python_type.__forward_arg__
        return f"{STRUCT_PREFIX}{ref_name.upper()}"

    # Handle string forward references (e.g., "Node")
    if isinstance(python_type, str):
        return f"{STRUCT_PREFIX}{python_type.upper()}"

    # Fallback
    return "T"


def model_to_schema(
    model_class: type,
    *,
    include_nested: bool = True,
    register_callback: Any | None = None,
    _registered: set[type] | None = None,
) -> dict[str, str | dict[str, Any]]:
    """
    Convert a Pydantic model to a TYTX v2 dict schema.

    Extracts Field() constraints and metadata into validate/ui sections.

    Args:
        model_class: Pydantic BaseModel subclass
        include_nested: If True, recursively register nested models
        register_callback: Optional callback(code, schema) to register nested structs
        _registered: Internal set to track already registered models

    Returns:
        Dict schema mapping field names to TYTX type codes or inline FieldDef dicts

    Raises:
        ImportError: If pydantic is not installed
        TypeError: If model_class is not a Pydantic BaseModel subclass

    Example:
        from pydantic import BaseModel, Field
        from decimal import Decimal

        class Customer(BaseModel):
            name: str = Field(min_length=1, max_length=100)
            balance: Decimal = Field(ge=0)

        schema = model_to_schema(Customer)
        # {
        #     'name': {'type': 'T', 'validate': {'min': 1, 'max': 100}},
        #     'balance': {'type': 'N', 'validate': {'min': 0}}
        # }
    """
    try:
        from pydantic import BaseModel
    except ImportError as e:
        raise ImportError(
            "pydantic is required for model_to_schema. "
            "Install with: pip install genro-tytx[pydantic]"
        ) from e

    if not (isinstance(model_class, type) and issubclass(model_class, BaseModel)):
        raise TypeError(
            f"model_class must be a Pydantic BaseModel subclass, got {type(model_class)}"
        )

    if _registered is None:
        _registered = set()

    schema: dict[str, str | dict[str, Any]] = {}

    for field_name, field_info in model_class.model_fields.items():
        annotation = field_info.annotation
        type_code = python_type_to_tytx_code(
            annotation,
            include_nested=include_nested,
            register_callback=register_callback,
            _registered=_registered,
        )

        # Extract Field() constraints into validate/ui sections
        field_def = _extract_field_constraints(field_info, type_code)
        schema[field_name] = field_def

    return schema


def _extract_field_constraints(field_info: Any, type_code: str) -> str | dict[str, Any]:
    """
    Extract Pydantic Field() constraints into inline FieldDef format.

    Args:
        field_info: Pydantic FieldInfo object
        type_code: Base TYTX type code

    Returns:
        Simple type code if no constraints, or inline FieldDef dict.
    """
    validate: dict[str, Any] = {}
    ui: dict[str, Any] = {}

    # Check if field is required (no default)
    if field_info.is_required():
        validate["required"] = True

    # Extract constraints from field_info metadata
    # String constraints
    if hasattr(field_info, "min_length") and field_info.min_length is not None:
        validate["min"] = field_info.min_length
    if hasattr(field_info, "max_length") and field_info.max_length is not None:
        validate["max"] = field_info.max_length
    if hasattr(field_info, "pattern") and field_info.pattern is not None:
        validate["pattern"] = field_info.pattern

    # Numeric constraints (ge, gt, le, lt)
    if hasattr(field_info, "ge") and field_info.ge is not None:
        validate["min"] = field_info.ge
    if hasattr(field_info, "gt") and field_info.gt is not None:
        validate["min"] = field_info.gt
        validate["minExclusive"] = True
    if hasattr(field_info, "le") and field_info.le is not None:
        validate["max"] = field_info.le
    if hasattr(field_info, "lt") and field_info.lt is not None:
        validate["max"] = field_info.lt
        validate["maxExclusive"] = True

    # Multiple of (for decimals)
    if hasattr(field_info, "multiple_of") and field_info.multiple_of is not None:
        validate["multipleOf"] = field_info.multiple_of

    # Default value
    if field_info.default is not None and not field_info.is_required():
        # Check if default is not PydanticUndefined
        try:
            from pydantic_core import PydanticUndefined

            if field_info.default is not PydanticUndefined:
                validate["default"] = field_info.default
        except ImportError:
            if field_info.default is not ...:
                validate["default"] = field_info.default

    # UI hints from title/description
    if field_info.title:
        ui["label"] = field_info.title
    if field_info.description:
        ui["hint"] = field_info.description

    # Build inline FieldDef or return simple type
    if validate or ui:
        field_def: dict[str, Any] = {"type": type_code}
        if validate:
            field_def["validate"] = validate
        if ui:
            field_def["ui"] = ui
        return field_def

    return type_code


def schema_to_model(
    code: str,
    schema: dict[str, str | dict[str, Any]],
    *,
    struct_registry: dict[str, dict[str, str | dict[str, Any]]] | None = None,
) -> type:
    """
    Generate a Pydantic model from a TYTX v2 struct schema.

    Converts inline FieldDef validate/ui sections into Pydantic Field() constraints.

    Args:
        code: Struct code (used as model class name)
        schema: TYTX dict schema (type codes or inline FieldDef dicts)
        struct_registry: Optional dict of known structs for nested references

    Returns:
        Dynamically generated Pydantic BaseModel subclass

    Raises:
        ImportError: If pydantic is not installed

    Example:
        Model = schema_to_model('CUSTOMER', {
            'name': {'type': 'T', 'validate': {'min': 1, 'required': True}},
            'balance': 'N'
        })
        instance = Model(name='John', balance=Decimal('100.50'))
    """
    try:
        from pydantic import Field, create_model
    except ImportError as e:
        raise ImportError(
            "pydantic is required for schema_to_model. "
            "Install with: pip install genro-tytx[pydantic]"
        ) from e

    if struct_registry is None:
        struct_registry = {}

    # Build field definitions
    field_definitions: dict[str, tuple[type, Any]] = {}

    for field_name, field_def in schema.items():
        # Parse inline FieldDef
        if isinstance(field_def, dict):
            type_code = field_def.get("type", "T")
            validate = field_def.get("validate", {})
            ui = field_def.get("ui", {})
        else:
            type_code = field_def
            validate = {}
            ui = {}

        python_type = tytx_code_to_python_type(
            type_code, struct_registry=struct_registry
        )

        # Build Field() kwargs from validate/ui
        field_kwargs: dict[str, Any] = {}

        # Required/default
        is_required = validate.get("required", False)
        if "default" in validate:
            field_kwargs["default"] = validate["default"]
        elif not is_required:
            field_kwargs["default"] = None

        # String constraints
        if "min" in validate and python_type is str:
            field_kwargs["min_length"] = validate["min"]
        if "max" in validate and python_type is str:
            field_kwargs["max_length"] = validate["max"]
        if "pattern" in validate:
            field_kwargs["pattern"] = validate["pattern"]

        # Numeric constraints
        if "min" in validate and python_type is not str:
            if validate.get("minExclusive"):
                field_kwargs["gt"] = validate["min"]
            else:
                field_kwargs["ge"] = validate["min"]
        if "max" in validate and python_type is not str:
            if validate.get("maxExclusive"):
                field_kwargs["lt"] = validate["max"]
            else:
                field_kwargs["le"] = validate["max"]
        if "multipleOf" in validate:
            field_kwargs["multiple_of"] = validate["multipleOf"]

        # UI hints
        if "label" in ui:
            field_kwargs["title"] = ui["label"]
        if "hint" in ui:
            field_kwargs["description"] = ui["hint"]

        # Create field definition
        # Note: field_kwargs always has at least "default" if not is_required (see line 395-396)
        if field_kwargs:
            field_definitions[field_name] = (python_type, Field(**field_kwargs))
        else:
            # Only reached when is_required=True and no other constraints
            field_definitions[field_name] = (python_type, ...)

    # Create model dynamically
    model_name = code.title().replace("_", "")
    return create_model(model_name, **field_definitions)  # type: ignore[call-overload,no-any-return]


def tytx_code_to_python_type(
    type_code: str,
    *,
    struct_registry: dict[str, dict[str, str | dict[str, Any]]] | None = None,
) -> type:
    """
    Map a TYTX type code to a Python type.

    Args:
        type_code: TYTX type code (e.g., 'T', 'N', '#L', '@CUSTOMER')
        struct_registry: Optional dict of known structs for nested references

    Returns:
        Python type annotation
    """
    if struct_registry is None:
        struct_registry = {}

    # Handle array prefix
    if type_code.startswith(ARRAY_PREFIX):
        inner_code = type_code[len(ARRAY_PREFIX) :]
        inner_type = tytx_code_to_python_type(
            inner_code, struct_registry=struct_registry
        )
        return list[inner_type]  # type: ignore[valid-type]

    # Handle struct prefix
    if type_code.startswith(STRUCT_PREFIX):
        struct_code = type_code[len(STRUCT_PREFIX) :]
        if struct_code in struct_registry:
            # Recursively generate nested model
            return schema_to_model(
                struct_code,
                struct_registry[struct_code],
                struct_registry=struct_registry,
            )
        # Unknown struct - use dict as fallback
        return dict

    # Reverse mapping: TYTX code to Python type
    reverse_mapping: dict[str, type] = {
        "T": str,
        "L": int,
        "R": float,
        "B": bool,
        "N": Decimal,
        "D": date,
        "DH": datetime,
        "DHZ": datetime,
        "H": time,
        "JS": dict,
    }

    return reverse_mapping.get(type_code, str)


__all__ = [
    "TYPE_MAPPING",
    "model_to_schema",
    "python_type_to_tytx_code",
    "schema_to_model",
    "tytx_code_to_python_type",
]

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
Utility functions for TYTX schema generation.

This module provides helpers for:
- Pydantic model → TYTX struct conversion
- TYTX struct → Pydantic model generation (Feature 8)
- Python type → TYTX code mapping
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

    # Fallback
    return "T"


def model_to_schema(
    model_class: type,
    *,
    include_nested: bool = True,
    register_callback: Any | None = None,
    _registered: set[type] | None = None,
) -> dict[str, str]:
    """
    Convert a Pydantic model to a TYTX dict schema.

    Args:
        model_class: Pydantic BaseModel subclass
        include_nested: If True, recursively register nested models
        register_callback: Optional callback(code, schema) to register nested structs
        _registered: Internal set to track already registered models

    Returns:
        Dict schema mapping field names to TYTX type codes

    Raises:
        ImportError: If pydantic is not installed
        TypeError: If model_class is not a Pydantic BaseModel subclass

    Example:
        from pydantic import BaseModel
        from decimal import Decimal

        class Customer(BaseModel):
            name: str
            balance: Decimal

        schema = model_to_schema(Customer)
        # {'name': 'T', 'balance': 'N'}
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

    schema: dict[str, str] = {}

    for field_name, field_info in model_class.model_fields.items():
        annotation = field_info.annotation
        type_code = python_type_to_tytx_code(
            annotation,
            include_nested=include_nested,
            register_callback=register_callback,
            _registered=_registered,
        )
        schema[field_name] = type_code

    return schema


def schema_to_model(
    code: str,
    schema: dict[str, str],
    *,
    struct_registry: dict[str, dict[str, str]] | None = None,
) -> type:
    """
    Generate a Pydantic model from a TYTX struct schema.

    This is Feature 8: TYTX struct → Pydantic model generation.

    Args:
        code: Struct code (used as model class name)
        schema: TYTX dict schema mapping field names to type codes
        struct_registry: Optional dict of known structs for nested references

    Returns:
        Dynamically generated Pydantic BaseModel subclass

    Raises:
        ImportError: If pydantic is not installed

    Example:
        Model = schema_to_model('CUSTOMER', {'name': 'T', 'balance': 'N'})
        instance = Model(name='John', balance=Decimal('100.50'))
    """
    try:
        from pydantic import create_model
    except ImportError as e:
        raise ImportError(
            "pydantic is required for schema_to_model. "
            "Install with: pip install genro-tytx[pydantic]"
        ) from e

    if struct_registry is None:
        struct_registry = {}

    # Build field definitions
    field_definitions: dict[str, tuple[type, Any]] = {}

    for field_name, type_code in schema.items():
        python_type = tytx_code_to_python_type(
            type_code, struct_registry=struct_registry
        )
        # All fields are required by default (use ... as default)
        field_definitions[field_name] = (python_type, ...)

    # Create model dynamically
    model_name = code.title().replace("_", "")
    return create_model(model_name, **field_definitions)  # type: ignore[call-overload,no-any-return]


def tytx_code_to_python_type(
    type_code: str,
    *,
    struct_registry: dict[str, dict[str, str]] | None = None,
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

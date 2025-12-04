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
Pydantic utilities for TYTX.

This module provides conversion between Pydantic models and TYTX structs.
"""
from __future__ import annotations

import contextlib
from typing import TYPE_CHECKING, Any, Literal

from .struct import FieldMetadata, FieldValue, MetadataDict

if TYPE_CHECKING:
    from .registry import TypeRegistry


class PydanticConverter:
    """
    Converts between Pydantic models and TYTX structs.

    This class provides bidirectional conversion:
    - Pydantic model → TYTX struct schema (struct_from_model)
    - TYTX struct schema → Pydantic model (model_from_struct)

    Usage:
        from genro_tytx import registry
        from genro_tytx.pydantic_utils import PydanticConverter

        converter = PydanticConverter(registry)

        # Pydantic → TYTX
        schema, metadata = converter.struct_from_model(MyModel)
        converter.register_struct_from_model('MYMODEL', MyModel)

        # TYTX → Pydantic
        MyModel = converter.model_from_struct('MYMODEL')
    """

    def __init__(self, registry: TypeRegistry) -> None:
        """
        Initialize converter with a TypeRegistry instance.

        Args:
            registry: TypeRegistry instance to use for struct registration
        """
        self._registry = registry

    def struct_from_model(
        self,
        model_class: type,
        *,
        include_nested: bool = False,
    ) -> tuple[dict[str, FieldValue], MetadataDict]:
        """
        Generate a TYTX struct schema and metadata from a Pydantic model.

        Extracts:
        - Schema: pure type mappings (str -> T, int -> L, Decimal -> N, etc.)
        - Metadata: field constraints and UI hints separately
        - Literal types as validate.enum in metadata
        - Nested Pydantic models as @STRUCT references

        Args:
            model_class: Pydantic BaseModel subclass
            include_nested: If True, recursively register nested Pydantic models
                as separate structs (default False - just generate references)

        Returns:
            Tuple of (schema, metadata):
            - schema: pure types {"name": "T", "balance": "N"}
            - metadata: {"name": {"validate": {"min": 1}, "ui": {"label": "Name"}}}

        Raises:
            ImportError: If pydantic is not installed
            TypeError: If model_class is not a Pydantic BaseModel subclass

        Examples:
            from pydantic import BaseModel, Field

            class Customer(BaseModel):
                name: str = Field(min_length=1, max_length=100, title="Name")
                email: str = Field(pattern=r'^[^@]+@[^@]+$')

            converter = PydanticConverter(registry)
            schema, metadata = converter.struct_from_model(Customer)
            # schema → {'name': 'T', 'email': 'T'}
            # metadata → {'name': {'validate': {'min': 1, 'max': 100}, 'ui': {'label': 'Name'}},
            #             'email': {'validate': {'pattern': '^[^@]+@[^@]+$'}}}
        """
        from pydantic import BaseModel

        if not (isinstance(model_class, type) and issubclass(model_class, BaseModel)):
            raise TypeError(
                f"model_class must be a Pydantic BaseModel subclass, got {type(model_class)}"
            )

        return self._model_to_schema(model_class, include_nested)

    def register_struct_from_model(
        self,
        code: str,
        model_class: type,
        *,
        include_nested: bool = True,
    ) -> None:
        """
        Auto-generate and register a struct schema from a Pydantic model.

        This is a convenience method that combines struct_from_model() and
        register_struct(). For more control, use struct_from_model() to
        generate the schema first, inspect/modify it, then register_struct().

        Args:
            code: Struct code (will be prefixed with @)
            model_class: Pydantic BaseModel subclass
            include_nested: If True, recursively register nested Pydantic models
                as separate structs (default True)

        Raises:
            ImportError: If pydantic is not installed
            TypeError: If model_class is not a Pydantic BaseModel subclass

        Examples:
            from pydantic import BaseModel, Field
            from decimal import Decimal

            class Customer(BaseModel):
                name: str = Field(min_length=1, title="Customer Name")
                balance: Decimal = Field(ge=0)

            converter = PydanticConverter(registry)
            converter.register_struct_from_model('CUSTOMER', Customer)
            # Registers schema: {'name': 'T', 'balance': 'N'}
            # With metadata: {'name': {'validate': {'min': 1}, 'ui': {'label': 'Customer Name'}},
            #                 'balance': {'validate': {'min': 0}}}
        """
        schema, metadata = self.struct_from_model(
            model_class, include_nested=include_nested
        )
        self._registry.register_struct(code, schema, metadata if metadata else None)

    def model_from_struct(
        self,
        code: str,
        *,
        model_name: str | None = None,
    ) -> type:
        """
        Generate a Pydantic BaseModel class from a registered TYTX struct.

        This is the inverse of struct_from_model(): given a TYTX struct schema,
        create a Pydantic model with proper field types and constraints.

        Type Mapping (TYTX → Python):
            T       -> str
            L       -> int
            R       -> float
            N       -> Decimal
            B       -> bool
            D       -> date
            DHZ     -> datetime
            H       -> time
            #X      -> list[X]
            JS      -> dict[str, Any]
            @STRUCT -> nested model (recursively generated)

        Args:
            code: Struct code without @ prefix (must be already registered)
            model_name: Optional custom class name. If not provided, uses
                code.title() (e.g., "CUSTOMER" -> "Customer")

        Returns:
            A dynamically created Pydantic BaseModel subclass

        Raises:
            ImportError: If pydantic is not installed
            KeyError: If struct code is not registered

        Examples:
            # Register a struct
            registry.register_struct('CUSTOMER', '{"name": "T", "balance": "N"}')

            # Generate Pydantic model
            converter = PydanticConverter(registry)
            Customer = converter.model_from_struct('CUSTOMER')

            # Use it
            customer = Customer(name="Mario", balance=Decimal("100.00"))
        """
        schema = self._registry._structs.get(code)
        if schema is None:
            raise KeyError(f"Struct '{code}' not registered")

        if model_name is None:
            model_name = code.title()

        return self._schema_to_model(code, schema, model_name, {})

    # -------------------------------------------------------------------------
    # Internal methods: Pydantic → TYTX
    # -------------------------------------------------------------------------

    def _model_to_schema(
        self,
        model_class: Any,
        include_nested: bool,
        _registered: set[type] | None = None,
    ) -> tuple[dict[str, FieldValue], MetadataDict]:
        """
        Convert a Pydantic model to TYTX schema and metadata.

        Args:
            model_class: Pydantic BaseModel subclass
            include_nested: If True, recursively register nested models
            _registered: Internal set to track already registered models (avoid infinite recursion)

        Returns:
            Tuple of (schema, metadata)
        """
        if _registered is None:
            _registered = set()

        schema: dict[str, FieldValue] = {}
        metadata: MetadataDict = {}

        for field_name, field_info in model_class.model_fields.items():
            annotation = field_info.annotation
            type_code = self._python_type_to_tytx_code(
                annotation, include_nested, _registered
            )
            field_meta = self._extract_field_metadata(field_info, annotation)

            schema[field_name] = type_code
            if field_meta:
                metadata[field_name] = field_meta

        return schema, metadata

    def _extract_field_metadata(
        self, field_info: Any, annotation: Any
    ) -> FieldMetadata | None:
        """
        Extract FieldMetadata from Pydantic FieldInfo.

        Maps Pydantic constraints to FieldMetadata format:
        - validate section: min, max, pattern, enum, default, required
        - ui section: label, hint
        """
        import typing

        validate: dict[str, Any] = {}
        ui: dict[str, Any] = {}

        # Extract constraints from field_info.metadata (Pydantic v2)
        if hasattr(field_info, "metadata") and field_info.metadata:
            for constraint in field_info.metadata:
                constraint_type = type(constraint).__name__

                # String constraints
                if constraint_type == "MinLen":
                    validate["min"] = constraint.min_length
                elif constraint_type == "MaxLen":
                    validate["max"] = constraint.max_length
                elif constraint_type == "Pattern":
                    validate["pattern"] = constraint.pattern

                # Numeric constraints
                elif constraint_type == "Ge":
                    validate["min"] = constraint.ge
                elif constraint_type == "Le":
                    validate["max"] = constraint.le
                elif constraint_type == "Gt":
                    validate["min"] = constraint.gt + 1
                elif constraint_type == "Lt":
                    validate["max"] = constraint.lt - 1

                # Pydantic general metadata
                elif (
                    constraint_type == "_PydanticGeneralMetadata"
                    and hasattr(constraint, "pattern")
                    and constraint.pattern is not None
                ):
                    validate["pattern"] = constraint.pattern

        # UI metadata
        if hasattr(field_info, "title") and field_info.title is not None:
            ui["label"] = field_info.title
        if hasattr(field_info, "description") and field_info.description is not None:
            ui["hint"] = field_info.description

        # Default value
        if hasattr(field_info, "default"):
            default = field_info.default
            from pydantic_core import PydanticUndefined

            if default is not PydanticUndefined and default is not None:
                validate["default"] = default

        # Handle Literal type for enum
        origin = typing.get_origin(annotation)
        if origin is typing.Literal:
            args = typing.get_args(annotation)
            if args:
                validate["enum"] = list(args)

        # Check if field is required
        is_required = hasattr(field_info, "is_required") and field_info.is_required()

        if not validate and not ui:
            return None

        if is_required and (len(validate) > 0 or ui):
            validate["required"] = True

        result: FieldMetadata = {}
        if validate:
            result["validate"] = validate  # type: ignore[typeddict-item]
        if ui:
            result["ui"] = ui  # type: ignore[typeddict-item]
        return result

    def _python_type_to_tytx_code(
        self,
        python_type: type,
        include_nested: bool,
        _registered: set[type],
    ) -> str:
        """
        Map a Python type annotation to a TYTX type code.

        Handles:
        - Basic types (str, int, float, bool, Decimal, date, datetime, time)
        - Optional types (Optional[X] -> X)
        - List types (list[X] -> #X)
        - Nested Pydantic models (-> @MODEL_NAME)
        - Union types (uses first non-None type)
        """
        import types
        import typing
        from datetime import date, datetime, time
        from decimal import Decimal

        origin = typing.get_origin(python_type)
        args = typing.get_args(python_type)

        # Handle Literal type
        if origin is typing.Literal:
            if args:
                first_value = args[0]
                if isinstance(first_value, int):
                    return "L"
                elif isinstance(first_value, float):
                    return "R"
                elif isinstance(first_value, bool):
                    return "B"
            return "T"

        # Handle Optional[X] and Union[X, None]
        if origin is typing.Union or isinstance(python_type, types.UnionType):
            if not args:
                args = typing.get_args(python_type)
            non_none_args = [a for a in args if a is not type(None)]
            # For Union with multiple types, take the first non-None type
            return self._python_type_to_tytx_code(
                non_none_args[0], include_nested, _registered
            )

        # Handle list[X] -> #X
        if origin is list:
            inner_code = self._python_type_to_tytx_code(
                args[0], include_nested, _registered
            )
            return f"#{inner_code}"

        # Handle dict -> JS
        if origin is dict or python_type is dict:
            return "JS"

        # Check if it's a Pydantic model (for nested structs)
        from pydantic import BaseModel

        if isinstance(python_type, type) and issubclass(python_type, BaseModel):
            struct_code = python_type.__name__.upper()

            if include_nested and python_type not in _registered:
                _registered.add(python_type)
                nested_schema, nested_metadata = self._model_to_schema(
                    python_type, include_nested, _registered
                )
                if struct_code not in self._registry._structs:
                    self._registry.register_struct(
                        struct_code,
                        nested_schema,
                        nested_metadata if nested_metadata else None,
                    )

            return f"@{struct_code}"

        # Map basic Python types to TYTX codes
        type_mapping: dict[type, str] = {
            str: "T",
            int: "L",
            float: "R",
            bool: "B",
            Decimal: "N",
            date: "D",
            datetime: "DHZ",
            time: "H",
        }

        if isinstance(python_type, type):
            return type_mapping.get(python_type, "T")

        # Handle ForwardRef
        if isinstance(python_type, typing.ForwardRef):
            ref_name = python_type.__forward_arg__
            return f"@{ref_name.upper()}"

        # Handle string forward references
        if isinstance(python_type, str):
            return f"@{python_type.upper()}"

        return "T"

    # -------------------------------------------------------------------------
    # Internal methods: TYTX → Pydantic
    # -------------------------------------------------------------------------

    def _schema_to_model(
        self,
        code: str,
        schema: list[FieldValue] | dict[str, FieldValue],
        model_name: str,
        _cache: dict[str, type],
    ) -> type:
        """
        Convert a TYTX schema to a Pydantic model class.
        """
        from typing import cast

        from pydantic import create_model

        from .struct import FieldMetadata

        if code in _cache:
            return _cache[code]

        schema_dict: dict[str, FieldValue]
        if isinstance(schema, list):
            schema_dict = {f"field_{i}": t for i, t in enumerate(schema)}
        else:
            schema_dict = schema

        field_definitions: dict[str, Any] = {}

        for field_name, type_def in schema_dict.items():
            field_meta = cast(
                FieldMetadata | None,
                self._registry.get_struct_metadata(code, field_name),
            )
            field_type, field_info = self._parse_type_def(type_def, _cache, field_meta)
            if field_info is not None:
                field_definitions[field_name] = (field_type, field_info)
            else:
                field_definitions[field_name] = (field_type, ...)

        model: type = create_model(model_name, **field_definitions)
        _cache[code] = model

        return model

    def _parse_type_def(
        self,
        type_def: FieldValue,
        _cache: dict[str, type],
        field_meta: FieldMetadata | None = None,
    ) -> tuple[Any, Any]:
        """
        Parse a TYTX type definition to Python type and Pydantic FieldInfo.
        """
        from datetime import date, datetime, time
        from decimal import Decimal
        from typing import Any

        if type_def is None:
            return (Any, None)

        if isinstance(type_def, list):
            return (list[Any], None)

        if isinstance(type_def, dict):
            inline_model = self._schema_to_model(
                "_inline", type_def, "InlineModel", _cache
            )
            return (inline_model, None)

        base_type = type_def.strip() if isinstance(type_def, str) else str(type_def)

        metadata: dict[str, Any] = {}
        if field_meta:
            if "validate" in field_meta:
                metadata.update(field_meta["validate"])
            if "ui" in field_meta:
                metadata.update(field_meta["ui"])

        type_map: dict[str, type] = {
            "T": str,
            "L": int,
            "R": float,
            "N": Decimal,
            "B": bool,
            "D": date,
            "DHZ": datetime,
            "H": time,
        }

        # Handle array types (#X)
        if base_type.startswith("#"):
            inner_type_code = base_type[1:]
            inner_type, _ = self._parse_type_def(inner_type_code, _cache)
            python_type: Any = list[inner_type]  # type: ignore[valid-type]
            return self._apply_metadata(python_type, metadata, is_numeric=False)

        # Handle dict type (JS)
        if base_type == "JS":
            python_type = dict[str, Any]
            return self._apply_metadata(python_type, metadata, is_numeric=False)

        # Handle nested struct (@CODE)
        if base_type.startswith("@"):
            nested_code = base_type[1:]
            nested_schema = self._registry._structs[nested_code]
            nested_model = self._schema_to_model(
                nested_code,
                nested_schema,
                nested_code.title(),
                _cache,
            )
            return self._apply_metadata(nested_model, metadata, is_numeric=False)

        python_type = type_map.get(base_type, str)
        is_numeric = base_type in ("L", "R", "N")
        return self._apply_metadata(python_type, metadata, is_numeric=is_numeric)

    def _apply_metadata(
        self,
        python_type: Any,
        metadata: dict[str, Any],
        is_numeric: bool,
    ) -> tuple[Any, Any]:
        """
        Apply TYTX metadata to create Pydantic Field constraints.
        """
        from typing import Annotated

        from annotated_types import Ge, Le, MaxLen, MinLen
        from pydantic import Field

        if not metadata:
            return (python_type, None)

        # Handle enum -> Literal type
        if "enum" in metadata:
            enum_val = metadata["enum"]
            enum_values = enum_val if isinstance(enum_val, list) else [enum_val]
            python_type = Literal[tuple(enum_values)]

        field_kwargs: dict[str, Any] = {}

        if "label" in metadata:
            field_kwargs["title"] = metadata["label"]
        if "hint" in metadata:
            field_kwargs["description"] = metadata["hint"]
        if "default" in metadata:
            field_kwargs["default"] = metadata["default"]

        annotations: list[Any] = []

        if "min" in metadata:
            min_val = metadata["min"]
            if is_numeric:
                if isinstance(min_val, (int, float)):
                    annotations.append(Ge(min_val))
                else:
                    with contextlib.suppress(ValueError):
                        annotations.append(
                            Ge(
                                int(min_val)
                                if "." not in str(min_val)
                                else float(min_val)
                            )
                        )
            else:
                if isinstance(min_val, int):
                    annotations.append(MinLen(min_val))
                else:
                    with contextlib.suppress(ValueError):
                        annotations.append(MinLen(int(min_val)))

        if "max" in metadata:
            max_val = metadata["max"]
            if is_numeric:
                if isinstance(max_val, (int, float)):
                    annotations.append(Le(max_val))
                else:
                    with contextlib.suppress(ValueError):
                        annotations.append(
                            Le(
                                int(max_val)
                                if "." not in str(max_val)
                                else float(max_val)
                            )
                        )
            else:
                if isinstance(max_val, int):
                    annotations.append(MaxLen(max_val))
                else:
                    with contextlib.suppress(ValueError):
                        annotations.append(MaxLen(int(max_val)))

        if "pattern" in metadata and "pattern" not in field_kwargs:
            field_kwargs["pattern"] = metadata["pattern"]

        if field_kwargs or annotations:
            final_type: Any = python_type
            if annotations:
                if len(annotations) == 1:
                    final_type = Annotated[python_type, annotations[0]]
                elif len(annotations) == 2:
                    final_type = Annotated[python_type, annotations[0], annotations[1]]

            if field_kwargs:
                return (final_type, Field(**field_kwargs))
            return (final_type, ...)

        return (python_type, None)

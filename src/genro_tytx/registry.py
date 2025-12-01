from collections.abc import Callable
from typing import Any

from .base import DataType
from .extension import CUSTOM_PREFIX
from .extension import ExtensionType as _ExtensionType
from .struct import STRUCT_PREFIX
from .struct import StructType as _StructType

# Symbol prefix for typed arrays (hash = each element #i)
ARRAY_PREFIX = "#"

# Re-export for backwards compatibility
__all_prefixes__ = ["CUSTOM_PREFIX", "ARRAY_PREFIX", "STRUCT_PREFIX", "X_PREFIX", "Y_PREFIX", "Z_PREFIX"]


def _get_type_instance(
    type_or_instance: "type[DataType] | _ExtensionType | _StructType",
) -> "DataType | _ExtensionType | _StructType":
    """Get a type instance from either a DataType class or _ExtensionType/_StructType instance."""
    if isinstance(type_or_instance, (_ExtensionType, _StructType)):
        return type_or_instance
    return type_or_instance()


class TypeRegistry:
    """
    Registry for pluggable data types.

    Uses unified dictionaries for both built-in and custom types.
    Type code prefixes:
        - ~ (tilde): custom extension types registered via register_class
        - @ (at): struct schema types registered via register_struct
        - # (hash): typed arrays where each element #i is of given type
    """

    def __init__(self) -> None:
        # Unified registries for built-in DataType, custom _ExtensionType, and _StructType
        self._types: dict[str, type[DataType] | _ExtensionType | _StructType] = {}
        self._codes: dict[str, type[DataType] | _ExtensionType | _StructType] = {}
        self._python_types: dict[type, type[DataType] | _ExtensionType] = {}
        # Struct schemas registry: code -> schema (list, dict, or str)
        self._structs: dict[str, list[str] | dict[str, str] | str] = {}

    def register(self, type_cls: type[DataType]) -> None:
        """
        Register a new data type (internal, for built-in types).
        """
        self._types[type_cls.name] = type_cls
        self._codes[type_cls.code] = type_cls
        # Register python_type if available
        if hasattr(type_cls, "python_type") and type_cls.python_type is not None:
            self._python_types[type_cls.python_type] = type_cls

    def register_class(
        self,
        code: str,
        cls: type,
        serialize: Callable[[Any], str] | None = None,
        parse: Callable[[str], Any] | None = None,
    ) -> None:
        """
        Register a custom extension type with X_ prefix.

        If serialize/parse are not provided, the class must implement:
        - as_typed_text(self) -> str: instance method for serialization
        - from_typed_text(s: str) -> cls: static method for parsing

        Args:
            code: Type code (will be prefixed with X_)
            cls: Python class (required for auto-detection)
            serialize: Function to convert value to string (optional if class has as_typed_text)
            parse: Function to convert string to value (optional if class has from_typed_text)

        Raises:
            ValueError: If serialize/parse not provided and class lacks required methods
        """
        # Auto-detect serialize from class method
        if serialize is None:
            if hasattr(cls, "as_typed_text"):

                def serialize(v: Any) -> str:
                    result: str = v.as_typed_text()
                    return result

            else:
                raise ValueError(
                    f"Class {cls.__name__} must have as_typed_text() method "
                    "or provide serialize parameter"
                )

        # Auto-detect parse from class method
        if parse is None:
            if hasattr(cls, "from_typed_text"):
                parse = cls.from_typed_text
            else:
                raise ValueError(
                    f"Class {cls.__name__} must have from_typed_text() static method "
                    "or provide parse parameter"
                )

        ext_type = _ExtensionType(code, cls, serialize, parse)
        # Register in unified dictionaries
        self._types[ext_type.name] = ext_type
        self._codes[ext_type.code] = ext_type
        self._python_types[cls] = ext_type

    def unregister_class(self, code: str) -> None:
        """
        Remove a previously registered custom extension type.

        Args:
            code: Type code without ~ prefix
        """
        full_code = f"{CUSTOM_PREFIX}{code}"
        if full_code in self._codes:
            ext_type = self._codes.pop(full_code)
            # Remove from _types by name
            if ext_type.name in self._types:
                del self._types[ext_type.name]
            # Remove from _python_types if cls was registered
            if (
                ext_type.python_type is not None
                and ext_type.python_type in self._python_types
            ):
                del self._python_types[ext_type.python_type]

    def register_struct(
        self, code: str, schema: "list[str] | dict[str, str] | str"
    ) -> None:
        """
        Register a struct schema for schema-based hydration.

        Args:
            code: Struct code (will be prefixed with @)
            schema: Type schema - either:
                - list: positional types ['T', 'L', 'N'] or homogeneous ['N']
                - dict: keyed types {'name': 'T', 'balance': 'N'}
                - str: ordered types with explicit field order:
                    - "x:R,y:R" (named fields → output dict)
                    - "R,R" (anonymous fields → output list)

        Examples:
            register_struct('ROW', ['T', 'L', 'N'])      # positional list
            register_struct('PRICES', ['N'])             # homogeneous list
            register_struct('CUSTOMER', {'name': 'T', 'balance': 'N'})  # dict
            register_struct('POINT', 'x:R,y:R')          # string → dict output
            register_struct('COORDS', 'R,R')             # string → list output
        """
        self._structs[code] = schema
        struct_type = _StructType(code, schema, self)
        self._codes[struct_type.code] = struct_type
        self._types[struct_type.name] = struct_type

    def unregister_struct(self, code: str) -> None:
        """
        Remove a previously registered struct schema.

        Args:
            code: Struct code without @ prefix
        """
        if code in self._structs:
            del self._structs[code]
        full_code = f"{STRUCT_PREFIX}{code}"
        if full_code in self._codes:
            struct_type = self._codes.pop(full_code)
            if struct_type.name in self._types:
                del self._types[struct_type.name]

    def struct_from_model(
        self,
        model_class: type,
        *,
        include_nested: bool = False,
    ) -> dict[str, str]:
        """
        Generate a TYTX struct schema from a Pydantic model.

        Extracts:
        - Type mappings (str -> T, int -> L, Decimal -> N, etc.)
        - Field constraints as metadata (min_length -> min, pattern -> reg, etc.)
        - Literal types as enum metadata
        - Nested Pydantic models as @STRUCT references

        Args:
            model_class: Pydantic BaseModel subclass
            include_nested: If True, recursively register nested Pydantic models
                as separate structs (default False - just generate references)

        Returns:
            Dict schema with TYTX type codes and metadata, e.g.:
            {'name': 'T[min:1, max:100]', 'email': 'T[reg:"^[^@]+@[^@]+$"]'}

        Raises:
            ImportError: If pydantic is not installed
            TypeError: If model_class is not a Pydantic BaseModel subclass

        Examples:
            from pydantic import BaseModel, Field

            class Customer(BaseModel):
                name: str = Field(min_length=1, max_length=100)
                email: str = Field(pattern=r'^[^@]+@[^@]+$')

            schema = registry.struct_from_model(Customer)
            # → {'name': 'T[min:1, max:100]', 'email': 'T[reg:"^[^@]+@[^@]+$"]'}

            # Then register:
            registry.register_struct('CUSTOMER', schema)
        """
        try:
            from pydantic import BaseModel
        except ImportError as e:
            raise ImportError(
                "pydantic is required for struct_from_model. "
                "Install with: pip install genro-tytx[pydantic]"
            ) from e

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

            registry.register_struct_from_model('CUSTOMER', Customer)
            # Registers: {'name': 'T[min:1, lbl:"Customer Name"]', 'balance': 'N[min:0]'}
        """
        schema = self.struct_from_model(model_class, include_nested=include_nested)
        self.register_struct(code, schema)

    def _model_to_schema(
        self,
        model_class: Any,
        include_nested: bool,
        _registered: set[type] | None = None,
    ) -> dict[str, str]:
        """
        Convert a Pydantic model to a TYTX dict schema.

        Args:
            model_class: Pydantic BaseModel subclass
            include_nested: If True, recursively register nested models
            _registered: Internal set to track already registered models (avoid infinite recursion)

        Returns:
            Dict schema mapping field names to TYTX type codes with metadata
        """
        if _registered is None:
            _registered = set()

        schema: dict[str, str] = {}

        # model_class is validated as BaseModel in register_struct_from_model
        for field_name, field_info in model_class.model_fields.items():
            annotation = field_info.annotation
            type_code = self._python_type_to_tytx_code(
                annotation, include_nested, _registered
            )
            # Extract metadata from field_info
            metadata = self._extract_field_metadata(field_info, annotation)
            if metadata:
                type_code = f"{type_code}[{metadata}]"
            schema[field_name] = type_code

        return schema

    def _extract_field_metadata(self, field_info: Any, annotation: Any) -> str:
        """
        Extract TYTX metadata from Pydantic FieldInfo.

        Maps Pydantic constraints to TYTX metadata facets:
        - min_length -> min (for strings)
        - max_length -> max (for strings)
        - pattern -> reg
        - ge (>=) -> min (for numbers)
        - le (<=) -> max (for numbers)
        - gt (>) -> min+1 (for numbers)
        - lt (<) -> max-1 (for numbers)
        - title -> lbl
        - description -> hint
        - default -> def (if not None and not PydanticUndefined)
        - Literal[...] -> enum

        Returns:
            Metadata string (without brackets) or empty string
        """
        import typing

        from .metadata_parser import format_metadata

        metadata: dict[str, str] = {}

        # Extract constraints from field_info.metadata (Pydantic v2)
        # In Pydantic v2, constraints are stored as annotated_types objects
        if hasattr(field_info, "metadata") and field_info.metadata:
            for constraint in field_info.metadata:
                constraint_type = type(constraint).__name__

                # String constraints
                if constraint_type == "MinLen":
                    metadata["min"] = str(constraint.min_length)
                elif constraint_type == "MaxLen":
                    metadata["max"] = str(constraint.max_length)
                elif constraint_type == "Pattern":
                    metadata["reg"] = constraint.pattern

                # Numeric constraints
                elif constraint_type == "Ge":
                    metadata["min"] = str(constraint.ge)
                elif constraint_type == "Le":
                    metadata["max"] = str(constraint.le)
                elif constraint_type == "Gt":
                    # gt means > value, so min is value + 1 for integers
                    metadata["min"] = str(constraint.gt + 1)
                elif constraint_type == "Lt":
                    # lt means < value, so max is value - 1 for integers
                    metadata["max"] = str(constraint.lt - 1)

                # Pydantic general metadata (includes pattern for strings)
                elif (
                    constraint_type == "_PydanticGeneralMetadata"
                    and hasattr(constraint, "pattern")
                    and constraint.pattern is not None
                ):
                    metadata["reg"] = constraint.pattern

        # UI metadata (these are direct attributes on FieldInfo)
        if hasattr(field_info, "title") and field_info.title is not None:
            metadata["lbl"] = field_info.title
        if hasattr(field_info, "description") and field_info.description is not None:
            metadata["hint"] = field_info.description

        # Default value (skip PydanticUndefined and None)
        if hasattr(field_info, "default"):
            default = field_info.default
            # Check for PydanticUndefined
            try:
                from pydantic_core import PydanticUndefined

                if default is not PydanticUndefined and default is not None:
                    metadata["def"] = str(default)
            except ImportError:
                if default is not None:
                    metadata["def"] = str(default)

        # Handle Literal type for enum
        origin = typing.get_origin(annotation)
        if origin is typing.Literal:
            args = typing.get_args(annotation)
            if args:
                metadata["enum"] = "|".join(str(a) for a in args)

        return format_metadata(metadata)

    def _python_type_to_tytx_code(
        self,
        python_type: type | None,
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
                return self._python_type_to_tytx_code(
                    non_none_args[0], include_nested, _registered
                )
            # Multiple types - use first one
            if non_none_args:
                return self._python_type_to_tytx_code(
                    non_none_args[0], include_nested, _registered
                )
            return "T"

        # Handle list[X] -> #X
        if origin is list:
            if args:
                inner_code = self._python_type_to_tytx_code(
                    args[0], include_nested, _registered
                )
                return f"#{inner_code}"
            return "#T"  # list without type arg

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
                    nested_schema = self._model_to_schema(
                        python_type, include_nested, _registered
                    )
                    # Only register if not already registered
                    if struct_code not in self._structs:
                        self.register_struct(struct_code, nested_schema)

                return f"@{struct_code}"
        except ImportError:
            pass

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

        # Handle actual type (not generic)
        if isinstance(python_type, type):
            return type_mapping.get(python_type, "T")

        # Fallback
        return "T"

    def get_struct(self, code: str) -> list[str] | dict[str, str] | str | None:
        """
        Get a struct schema by code.

        Args:
            code: Struct code without @ prefix

        Returns:
            Schema (list, dict, or str) or None if not found
        """
        return self._structs.get(code)

    def get(self, name_or_code: str) -> type[DataType] | _ExtensionType | _StructType | None:
        """
        Retrieve a type by name or code.
        """
        if name_or_code in self._types:
            return self._types[name_or_code]
        if name_or_code in self._codes:
            return self._codes[name_or_code]
        return None

    def get_for_value(self, value: Any) -> type[DataType] | _ExtensionType | None:
        """
        Get the type class for a Python value.
        """
        return self._python_types.get(type(value))

    def is_typed(self, text: str) -> bool:
        """
        Check if a string contains a TYTX type suffix.
        """
        if "::" not in text:
            return False
        _, type_part = text.rsplit("::", 1)
        return self.get(type_part) is not None

    def from_text(
        self,
        text: str,
        type_code: str | None = None,
        local_structs: dict[str, list[str] | dict[str, str] | str] | None = None,
    ) -> Any:
        """
        Parse a string to a Python value.

        Args:
            text: The string to parse. May contain embedded type (value::type).
                Supports typed arrays with # prefix: "[1,2,3]::#L".
                Supports struct schemas with @ prefix: '{"a":1}::@CODE'.
                Supports custom types with ~ prefix: 'uuid::~UUID'.
            type_code: Optional explicit type code. If provided, uses this type.
            local_structs: Optional dict of local struct definitions that take
                precedence over registry during hydration. Used by XTYTX for
                lstruct entries.

        Returns:
            Parsed Python value, or original string if no type found.
        """
        # If explicit type provided, use it
        if type_code is not None:
            type_cls = self.get(type_code)
            if type_cls:
                return _get_type_instance(type_cls).parse(text)
            return text

        # Check for embedded type
        if "::" not in text:
            return text

        # Split only on the last occurrence to handle values containing '::'
        val_part, type_part = text.rsplit("::", 1)

        # Handle # prefix for typed arrays (each element #i is of type X)
        # Supports both ::#L (built-in) and ::#@ROW (struct)
        if type_part.startswith(ARRAY_PREFIX):
            base_type_code = type_part[len(ARRAY_PREFIX) :]
            # Check if it's a struct reference (#@STRUCT)
            if base_type_code.startswith(STRUCT_PREFIX):
                struct_code = base_type_code[len(STRUCT_PREFIX) :]
                struct_type = self._get_struct_type(struct_code, local_structs)
                if struct_type:
                    return self._parse_struct_array(val_part, struct_type)
                return text
            # Regular typed array (#L, #N, etc.)
            base_type = self.get(base_type_code)
            if base_type:
                return self._parse_typed_array(val_part, base_type)
            return text

        # Handle @ prefix (struct) - check local_structs first, then registry
        if type_part.startswith(STRUCT_PREFIX):
            struct_code = type_part[len(STRUCT_PREFIX) :]
            struct_type = self._get_struct_type(struct_code, local_structs)
            if struct_type:
                return struct_type.parse(val_part)
            return text

        # Handle ~ prefix (custom extension type)
        if type_part.startswith(CUSTOM_PREFIX):
            ext_type = self.get(type_part)
            if ext_type and isinstance(ext_type, _ExtensionType):
                return ext_type.parse(val_part)
            return text

        # Regular scalar type (built-in)
        type_cls = self.get(type_part)
        if type_cls:
            return _get_type_instance(type_cls).parse(val_part)

        return text

    def _get_struct_type(
        self,
        code: str,
        local_structs: dict[str, list[str] | dict[str, str] | str] | None = None,
    ) -> _StructType | None:
        """
        Get a struct type by code, checking local_structs first.

        Args:
            code: Struct code without @ prefix
            local_structs: Optional dict of local struct definitions

        Returns:
            _StructType instance or None if not found
        """
        # Check local_structs first (higher precedence)
        if local_structs and code in local_structs:
            # Create temporary _StructType for local schema
            return _StructType(code, local_structs[code], self)

        # Fall back to registry
        full_code = f"{STRUCT_PREFIX}{code}"
        struct_type = self.get(full_code)
        if struct_type and isinstance(struct_type, _StructType):
            return struct_type
        return None

    def _parse_typed_array(
        self, json_str: str, type_cls: "type[DataType] | _ExtensionType | _StructType"
    ) -> list[Any]:
        """
        Parse a typed array, applying the type to all leaf values.

        Args:
            json_str: JSON array string like "[1,2,3]" or "[[1,2],[3,4]]"
            type_cls: Type class or extension type to apply to all leaf values

        Returns:
            List with all leaf values parsed using the type class
        """
        import json

        data = json.loads(json_str)
        type_instance = _get_type_instance(type_cls)

        def apply_type(item: Any) -> Any:
            if isinstance(item, list):
                return [apply_type(i) for i in item]
            # Convert to string and parse with type
            return type_instance.parse(str(item))

        result = apply_type(data)
        # data was parsed from JSON array, so result is always a list
        return result if isinstance(result, list) else [result]

    def _parse_struct_array(self, json_str: str, struct_type: _StructType) -> list[Any]:
        """
        Parse an array of structs, applying the struct schema to each element.

        Args:
            json_str: JSON array string like '[["A",1],["B",2]]'
            struct_type: _StructType instance to apply to each element

        Returns:
            List with each element parsed using the struct schema
        """
        import json

        data = json.loads(json_str)
        return [struct_type._apply_schema(item) for item in data]

    def _get_type_code_for_value(self, value: Any) -> str | None:
        """Get the type code for a Python value."""
        # Import here to avoid circular imports
        from datetime import date, datetime, time
        from decimal import Decimal

        # Check built-in types (order matters: bool before int, datetime before date)
        if isinstance(value, bool):
            return "B"
        if isinstance(value, int):
            return "L"  # L = Long integer
        if isinstance(value, float):
            return "R"  # R = Real number
        if isinstance(value, Decimal):
            return "N"  # N = Numeric
        if isinstance(value, datetime):
            return "DHZ"  # DHZ = Date Hour Zulu (timezone-aware)
        if isinstance(value, date):
            return "D"  # D = Date
        if isinstance(value, time):
            return "H"  # H = Hour
        if isinstance(value, (dict, list)):
            return "JS"  # JS = JavaScript object
        if isinstance(value, str):
            return None  # Strings don't get typed

        # Check custom types (registered via register_class)
        type_cls = self._python_types.get(type(value))
        if type_cls is not None:
            return type_cls.code

        return None

    def as_text(
        self,
        value: Any,
        format: str | bool | None = None,  # noqa: A002
        locale: str | None = None,
    ) -> str:
        """
        Serialize a Python object to a string (without type suffix).

        Args:
            value: Python value to serialize.
            format: Controls output format:
                - None: ISO/technical output (default)
                - True: use type's default format with locale
                - str: use specific format string with locale
            locale: Locale string (e.g., "it-IT"). If None and format is provided,
                uses system locale.

        Returns:
            String representation of value.
        """
        if isinstance(value, str):
            return value

        code = self._get_type_code_for_value(value)
        if code:
            type_cls = self.get(code)
            if type_cls:
                type_instance = _get_type_instance(type_cls)
                if format is not None and hasattr(type_instance, "format"):
                    return type_instance.format(value, format, locale)
                return type_instance.serialize(value)

        return str(value)

    def as_typed_text(self, value: Any, compact_array: bool = False) -> str:
        """
        Serialize a Python object to a typed string (value::type).

        Args:
            value: Python value to serialize.
            compact_array: If True and value is a homogeneous array, produce
                compact format "[1,2,3]::#L" instead of typing each element.
                If array is not homogeneous, falls back to element-by-element typing.

        Returns:
            String in format "value::type", or plain string if no type.
        """
        if isinstance(value, str):
            # Already typed or plain string - return as-is
            return value

        # Handle compact array format
        if compact_array and isinstance(value, list):
            result = self._try_compact_array(value)
            if result is not None:
                return result
            # Fallback: type each element individually
            return self._serialize_array_elements(value)

        code = self._get_type_code_for_value(value)
        if code:
            type_cls = self.get(code)
            if type_cls:
                return _get_type_instance(type_cls).serialize(value) + "::" + code

        return str(value)

    def _get_leaf_type_code(self, value: Any) -> str | None:
        """Get type code for a leaf value (non-list)."""
        if isinstance(value, list):
            return None  # Not a leaf
        return self._get_type_code_for_value(value)

    def _collect_leaf_types(self, value: Any) -> set[str | None]:
        """Collect all unique type codes from leaf values in a nested structure."""
        if isinstance(value, list):
            result: set[str | None] = set()
            for item in value:
                result.update(self._collect_leaf_types(item))
            return result
        return {self._get_leaf_type_code(value)}

    def _serialize_leaf(
        self, value: Any, type_cls: "type[DataType] | _ExtensionType | _StructType"
    ) -> Any:
        """Serialize a leaf value using the given type class."""
        if isinstance(value, list):
            return [self._serialize_leaf(item, type_cls) for item in value]
        return _get_type_instance(type_cls).serialize(value)

    def _try_compact_array(self, value: list[Any]) -> str | None:
        """
        Try to serialize array in compact format.

        Returns compact string if successful, None if array is not homogeneous.
        """
        import json

        if not value:
            # Empty array - no type to infer
            return "[]"

        leaf_types = self._collect_leaf_types(value)

        # If there are any None (strings), array is not fully typed - fallback
        if None in leaf_types:
            return None

        if len(leaf_types) != 1:
            # Not homogeneous (multiple types)
            return None

        type_code = leaf_types.pop()
        # After filtering None above, type_code is guaranteed to be str
        if type_code is None:
            return None
        type_cls = self.get(type_code)
        if not type_cls:
            return None

        # Serialize all leaf values with # prefix for typed arrays
        serialized = self._serialize_leaf(value, type_cls)
        return json.dumps(serialized, separators=(",", ":")) + "::" + ARRAY_PREFIX + type_code

    def _serialize_array_elements(self, value: list[Any]) -> str:
        """Serialize array with each element typed individually."""
        import json

        def serialize_item(item: Any) -> Any:
            if isinstance(item, list):
                return [serialize_item(i) for i in item]
            return self.as_typed_text(item)

        return json.dumps([serialize_item(i) for i in value], separators=(",", ":"))


# Global registry instance
registry = TypeRegistry()

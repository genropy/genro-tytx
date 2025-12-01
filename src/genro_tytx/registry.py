from collections.abc import Callable
from typing import Any

from .base import DataType

# Symbol prefix for custom extension types (tilde = eXtension)
CUSTOM_PREFIX = "~"
# Symbol prefix for typed arrays (hash = each element #i)
ARRAY_PREFIX = "#"
# Symbol prefix for struct schema types (at = @schema)
STRUCT_PREFIX = "@"

# Legacy prefixes for backwards compatibility
X_PREFIX = "X_"
Y_PREFIX = "Y_"
Z_PREFIX = "Z_"


class _ExtensionType:
    """
    Wrapper for custom extension types registered via register_class.
    """

    def __init__(
        self,
        code: str,
        cls: type | None,
        serialize: Callable[[Any], str],
        parse: Callable[[str], Any],
    ) -> None:
        self.code = f"{CUSTOM_PREFIX}{code}"
        self.name = f"custom_{code.lower()}"
        self.cls = cls
        self._serialize = serialize
        self._parse = parse
        # For compatibility with DataType interface
        self.python_type = cls

    def parse(self, value: str) -> Any:
        return self._parse(value)

    def serialize(self, value: Any) -> str:
        return self._serialize(value)


def _parse_string_schema(schema_str: str) -> tuple[list[tuple[str, str]], bool]:
    """
    Parse a string schema definition.

    Args:
        schema_str: Schema string like "x:R,y:R" (named) or "R,R" (anonymous)

    Returns:
        Tuple of (fields, has_names) where:
        - fields: list of (name, type_code) tuples. For anonymous, name is ""
        - has_names: True if schema has field names (output dict), False (output list)
    """
    fields: list[tuple[str, str]] = []
    has_names = False

    for part in schema_str.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            name, type_code = part.split(":", 1)
            fields.append((name.strip(), type_code.strip()))
            has_names = True
        else:
            fields.append(("", part.strip()))

    return fields, has_names


class _StructType:
    """
    Wrapper for struct schema types registered via register_struct.

    Supports three schema formats:
    - list: positional types ['T', 'L', 'N'] or homogeneous ['N']
    - dict: keyed types {'name': 'T', 'balance': 'N'}
    - str: ordered types "x:R,y:R" (named → dict) or "R,R" (anonymous → list)
    """

    code: str
    name: str
    python_type: None
    schema: "list[str] | dict[str, str] | str"
    _registry: "TypeRegistry"
    _string_fields: "list[tuple[str, str]] | None"
    _string_has_names: bool

    def __init__(
        self,
        code: str,
        schema: "list[str] | dict[str, str] | str",
        registry: "TypeRegistry",
    ) -> None:
        self.code = f"{STRUCT_PREFIX}{code}"
        self.name = f"struct_{code.lower()}"
        self._registry = registry
        self.python_type = None
        self.schema = schema

        # Parse string schema to internal representation
        if isinstance(schema, str):
            fields, has_names = _parse_string_schema(schema)
            self._string_fields = fields
            self._string_has_names = has_names
        else:
            self._string_fields = None
            self._string_has_names = False

    def parse(self, value: str) -> Any:
        """Parse JSON string using schema."""
        import json

        data = json.loads(value)
        return self._apply_schema(data)

    def serialize(self, value: Any) -> str:
        """Serialize value to JSON string."""
        import json

        return json.dumps(value, separators=(",", ":"))

    def _apply_schema(self, data: Any) -> Any:
        """Apply schema to hydrate data."""
        # String schema: use parsed fields
        if self._string_fields is not None:
            return self._apply_string_schema(data)
        # Dict schema
        if isinstance(self.schema, dict):
            return self._apply_dict_schema(data)
        # List schema
        return self._apply_list_schema(data)

    def _apply_string_schema(self, data: Any) -> Any:
        """Apply string schema to data (list input).

        Always treats data as a single record. For batch processing
        (array of records), use ::#@STRUCT syntax instead.
        """
        if not isinstance(data, list):
            return data
        return self._apply_string_schema_single(data)

    def _apply_string_schema_single(self, data: list[Any]) -> Any:
        """Apply string schema to a single list."""
        # Type narrowing: this method is only called when _string_fields is set
        assert self._string_fields is not None
        result_list = []
        for i, (_name, type_code) in enumerate(self._string_fields):
            if i < len(data):
                result_list.append(self._hydrate_value(data[i], type_code))
            else:
                result_list.append(None)

        # If schema has names, return dict; otherwise return list
        if self._string_has_names:
            return {
                name: value
                for (name, _), value in zip(
                    self._string_fields, result_list, strict=False
                )
            }
        return result_list

    def _apply_dict_schema(self, data: Any) -> Any:
        """Apply dict schema to data."""
        if not isinstance(data, dict):
            return data
        result = dict(data)
        # Type narrowing: this method is only called when schema is a dict
        assert isinstance(self.schema, dict)
        for key, type_code in self.schema.items():
            if key in result:
                result[key] = self._hydrate_value(result[key], type_code)
        return result

    def _apply_list_schema(self, data: Any) -> Any:
        """Apply list schema to data."""
        if not isinstance(data, list):
            return data
        # Type narrowing: this method is only called when schema is a list
        assert isinstance(self.schema, list)
        if len(self.schema) == 1:
            # Homogeneous: apply single type to all elements
            type_code = self.schema[0]
            return [self._apply_homogeneous(item, type_code) for item in data]
        else:
            # Positional: apply type at index i to data[i]
            # If data is array of arrays, apply positionally to each sub-array
            if data and isinstance(data[0], list):
                return [self._apply_positional(item) for item in data]
            return self._apply_positional(data)

    def _apply_homogeneous(self, item: Any, type_code: str) -> Any:
        """Apply homogeneous type recursively."""
        if isinstance(item, list):
            return [self._apply_homogeneous(i, type_code) for i in item]
        return self._hydrate_value(item, type_code)

    def _apply_positional(self, data: list[Any]) -> list[Any]:
        """Apply positional schema to a single list."""
        # Type narrowing: this method is only called when schema is a list
        assert isinstance(self.schema, list)
        result = []
        for i, item in enumerate(data):
            if i < len(self.schema):
                result.append(self._hydrate_value(item, self.schema[i]))
            else:
                result.append(item)
        return result

    def _hydrate_value(self, value: Any, type_code: str) -> Any:
        """Hydrate a single value using type code."""
        # Check if it's a struct reference (recursive)
        if type_code.startswith(STRUCT_PREFIX):
            struct_type = self._registry.get(type_code)
            if struct_type and isinstance(struct_type, _StructType):
                return struct_type._apply_schema(value)
            return value

        # Regular type
        type_cls = self._registry.get(type_code)
        if type_cls:
            type_instance = _get_type_instance(type_cls)
            if not isinstance(value, str):
                value = str(value)
            return type_instance.parse(value)

        return value


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

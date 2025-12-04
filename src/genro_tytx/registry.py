import hashlib
import json
from collections.abc import Callable
from typing import Any

from .base import DataType
from .extension import CUSTOM_PREFIX
from .extension import ExtensionType as _ExtensionType
from .struct import STRUCT_PREFIX, FieldMetadata, FieldValue, MetadataDict, StructType

# Internal alias for type hints
_StructType = StructType

# Symbol prefix for typed arrays (hash = each element #i)
ARRAY_PREFIX = "#"

# Re-export for backwards compatibility
__all_prefixes__ = [
    "CUSTOM_PREFIX",
    "ARRAY_PREFIX",
    "STRUCT_PREFIX",
    "X_PREFIX",
    "Y_PREFIX",
    "Z_PREFIX",
]


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
        # Struct schemas registry: code -> parsed schema (dict or list)
        self._structs: dict[str, dict[str, Any] | list[Any]] = {}
        # Struct metadata registry: code -> field_name -> metadata hash
        self._struct_metadata: dict[str, dict[str, str]] = {}
        # Metadata content registry: hash -> metadata content (deduplicated)
        self._metadata_content: dict[str, FieldMetadata] = {}

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
        self,
        code: str,
        schema: str | dict[str, Any] | list[Any],
        metadata: MetadataDict | None = None,
    ) -> None:
        """
        Register a struct schema for schema-based hydration.

        Args:
            code: Struct code (will be prefixed with @)
            schema: Schema definition as JSON string (PREFERRED) or dict/list:
                JSON string (recommended):
                    '{"name": "T", "age": "L"}' → produces dict
                    '["T", "L", "N"]' → produces list
                Legacy dict/list also accepted for backward compatibility.

                Type codes:
                - "": passthrough (no conversion, JSON-native types)
                - "@CODE": reference to another struct
                - Nested object: inline nested struct

            metadata: Optional field metadata (validation, UI hints).
                Maps field names to FieldMetadata dicts:
                {"name": {"validate": {"min": 1}, "ui": {"label": "Name"}}}

        Examples:
            # Dict output (JSON string - recommended)
            register_struct('CUSTOMER', '{"name": "T", "balance": "N"}')

            # With metadata
            register_struct(
                'CUSTOMER',
                schema='{"name": "", "balance": "N"}',
                metadata={
                    "name": {"validate": {"min": 1, "max": 200}, "ui": {"label": "Customer Name"}},
                    "balance": {"validate": {"min": 0}}
                }
            )

            # List output
            register_struct('POINT', '["R", "R"]')

            # Homogeneous list (single type for all elements)
            register_struct('PRICES', '["N"]')

            # Passthrough for JSON-native types ("")
            register_struct('MIXED', '{"name": "", "active": "", "balance": "N"}')

            # Nested struct reference
            register_struct('ORDER', '{"customer": "@CUSTOMER", "total": "N"}')

            # Inline nested struct
            register_struct('ORDER', '{"customer": {"name": "T"}, "total": "N"}')
        """
        # Parse schema if it's a JSON string
        parsed_schema = (
            self._parse_schema_json(schema) if isinstance(schema, str) else schema
        )

        self._structs[code] = parsed_schema
        struct_type = _StructType(
            code, schema, self
        )  # Pass original (str or dict/list)
        self._codes[struct_type.code] = struct_type
        self._types[struct_type.name] = struct_type

        # Process and store metadata if provided
        if metadata:
            self._register_struct_metadata(code, metadata)

    def _parse_schema_json(self, schema: str) -> dict[str, Any] | list[Any]:
        """
        Parse JSON schema string.

        Args:
            schema: Valid JSON string

        Returns:
            Parsed dict or list

        Raises:
            ValueError: If not valid JSON
        """
        try:
            parsed = json.loads(schema)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON schema: {e}") from e

        if not isinstance(parsed, (dict, list)):
            raise ValueError(
                f"Schema must be JSON object or array, got {type(parsed).__name__}"
            )

        return parsed

    def _register_struct_metadata(self, code: str, metadata: MetadataDict) -> None:
        """
        Register metadata for a struct, with hash-based deduplication.

        Args:
            code: Struct code (without @ prefix)
            metadata: Dict mapping field names to FieldMetadata
        """
        field_hashes: dict[str, str] = {}

        for field_name, field_meta in metadata.items():
            if not field_meta:
                continue
            # Compute hash of metadata content
            meta_hash = self._compute_metadata_hash(field_meta)
            field_hashes[field_name] = meta_hash
            # Store content if not already present (deduplication)
            if meta_hash not in self._metadata_content:
                self._metadata_content[meta_hash] = field_meta

        if field_hashes:
            self._struct_metadata[code] = field_hashes

    def _compute_metadata_hash(self, metadata: FieldMetadata) -> str:
        """
        Compute a stable hash for metadata content.

        Args:
            metadata: FieldMetadata dict

        Returns:
            Short hash string (first 8 chars of SHA256)
        """
        # Sort keys for stable serialization
        serialized = json.dumps(metadata, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode()).hexdigest()[:8]

    def get_struct_metadata(
        self, code: str, field_name: str | None = None
    ) -> MetadataDict | FieldMetadata | None:
        """
        Get metadata for a struct or specific field.

        Args:
            code: Struct code (without @ prefix)
            field_name: Optional field name. If None, returns all field metadata.

        Returns:
            - If field_name is None: dict of all fields with metadata
            - If field_name is provided: FieldMetadata for that field or None
        """
        if code not in self._struct_metadata:
            return None

        field_hashes = self._struct_metadata[code]

        if field_name is not None:
            # Return specific field metadata
            meta_hash = field_hashes.get(field_name)
            if meta_hash is None:
                return None
            return self._metadata_content.get(meta_hash)

        # Return all field metadata
        result: MetadataDict = {}
        for fname, meta_hash in field_hashes.items():
            content = self._metadata_content.get(meta_hash)
            if content:
                result[fname] = content
        return result

    def unregister_struct(self, code: str) -> None:
        """
        Remove a previously registered struct schema.

        Args:
            code: Struct code without @ prefix
        """
        if code in self._structs:
            del self._structs[code]
        if code in self._struct_metadata:
            del self._struct_metadata[code]
        full_code = f"{STRUCT_PREFIX}{code}"
        if full_code in self._codes:
            struct_type = self._codes.pop(full_code)
            if struct_type.name in self._types:
                del self._types[struct_type.name]

    def get_struct(self, code: str) -> dict[str, Any] | list[Any] | None:
        """
        Get a struct schema by code.

        Args:
            code: Struct code without @ prefix

        Returns:
            Schema (dict or list) or None if not found
        """
        return self._structs.get(code)

    def get(
        self, name_or_code: str
    ) -> type[DataType] | _ExtensionType | _StructType | None:
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
        local_structs: (
            dict[str, list[FieldValue] | dict[str, FieldValue]] | None
        ) = None,
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
            # Empty string returns empty string
            if text == "":
                return text
            # Try JSON parse
            try:
                return json.loads(f"[{text}]")[0]
            except json.JSONDecodeError:
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
        local_structs: (
            dict[str, list[FieldValue] | dict[str, FieldValue]] | None
        ) = None,
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

        # Liste e dict → JSON
        if isinstance(value, (list, dict)):
            return json.dumps(value)

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

        # Handle lists - always use ::TYTX with typed elements
        if isinstance(value, list):
            return self._serialize_array_elements(value)

        # Handle dicts - always use ::TYTX with typed values
        if isinstance(value, dict):
            return self._serialize_dict_values(value)

        code = self._get_type_code_for_value(value)
        if code:
            type_cls = self.get(code)
            if type_cls:
                return _get_type_instance(type_cls).serialize(value) + "::" + code

        return str(value)

    def _has_typed_objects(self, value: Any) -> bool:
        """Check if value contains any non-JSON-serializable typed objects."""
        from datetime import date, datetime, time
        from decimal import Decimal

        typed_classes = (date, datetime, time, Decimal)

        def check_item(item: Any) -> bool:
            if isinstance(item, list):
                return any(check_item(i) for i in item)
            if isinstance(item, dict):
                return any(check_item(v) for v in item.values())
            return isinstance(item, typed_classes)

        return check_item(value)

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
        assert type_code is not None  # guaranteed by None check above
        type_cls = self.get(type_code)
        if not type_cls:
            return None

        # Serialize all leaf values with # prefix for typed arrays
        serialized = self._serialize_leaf(value, type_cls)
        return (
            json.dumps(serialized, separators=(",", ":"))
            + "::"
            + ARRAY_PREFIX
            + type_code
        )

    def _serialize_array_elements(self, value: list[Any]) -> str:
        """Serialize array with each element typed individually, suffixed with ::TYTX."""
        import json

        def serialize_item(item: Any) -> Any:
            if isinstance(item, list):
                return [serialize_item(i) for i in item]
            return self.as_typed_text(item)

        return (
            json.dumps([serialize_item(i) for i in value], separators=(",", ":"))
            + "::TYTX"
        )

    def _serialize_dict_values(self, value: dict[str, Any]) -> str:
        """Serialize dict with each value typed individually, suffixed with ::TYTX."""
        import json

        def serialize_value(v: Any) -> Any:
            if isinstance(v, list):
                return [serialize_value(i) for i in v]
            if isinstance(v, dict):
                return {k: serialize_value(val) for k, val in v.items()}
            return self.as_typed_text(v)

        result = {k: serialize_value(v) for k, v in value.items()}
        return json.dumps(result, separators=(",", ":")) + "::TYTX"


# Global registry instance
registry = TypeRegistry()

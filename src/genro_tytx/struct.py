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
Struct types for TYTX.

This module provides:
- StructType: Schema-based data structures for type hydration
- Field metadata types (FieldMetadata, FieldValidate, FieldUI)

Schema is pure type information only. Metadata (validation, UI hints) is
stored separately and accessed via TypeRegistry.get_struct_metadata().

TYTX is a transport format, not a validator. For validation, use JSON Schema
via schema_registry (from genro_tytx.xtytx).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypedDict

if TYPE_CHECKING:
    from .base import DataType

# Symbol prefix for struct schema types (at = @schema)
STRUCT_PREFIX = "@"


class FieldValidate(TypedDict, total=False):
    """Validation constraints for a struct field."""

    min: int | float  # Minimum value or length
    max: int | float  # Maximum value or length
    length: int  # Exact length
    pattern: str  # Regex pattern
    enum: list[str]  # Allowed values
    required: bool  # Field is required
    default: Any  # Default value if missing


class FieldUI(TypedDict, total=False):
    """UI presentation hints for a struct field."""

    label: str  # Display label
    placeholder: str  # Input placeholder text
    hint: str  # Help text / tooltip
    readonly: bool | str  # Read-only (bool or condition)
    hidden: bool | str  # Hidden (bool or condition)
    format: str  # Display format
    width: int | str  # Field width
    rows: int  # Textarea rows


class FieldMetadata(TypedDict, total=False):
    """Metadata for a struct field (validation + UI)."""

    validate: FieldValidate  # Validation constraints
    ui: FieldUI  # UI presentation hints


# Type alias for schema field value (pure types only):
# - str: type code like "T", "N", "@CUSTOMER", "" (passthrough)
# - None: passthrough (no conversion)
# - dict: inline nested struct
# - list: inline nested list struct
FieldValue = str | None | dict[str, Any] | list[Any]

# Type alias for metadata dict
MetadataDict = dict[str, FieldMetadata]


class StructType:
    """
    Wrapper for struct schema types registered via register_struct.

    Supports two schema formats:
    - list: positional types ["T", "L", "N"] or homogeneous ["N"]
    - dict: keyed types {"name": "T", "balance": "N"}

    Type codes:
    - None or "": passthrough (no conversion, keep JSON-native value)
    - str: TYTX type code ("T", "N", "D", etc.)
    - str starting with "@": reference to another struct
    - dict: inline nested struct
    - list: inline nested list struct
    """

    code: str
    name: str
    python_type: None
    schema: list[FieldValue] | dict[str, FieldValue]
    _registry: Any  # TypeRegistry - avoid circular import

    def __init__(
        self,
        code: str,
        schema: list[FieldValue] | dict[str, FieldValue],
        registry: Any,  # TypeRegistry
    ) -> None:
        self.code = f"{STRUCT_PREFIX}{code}"
        self.name = f"struct_{code.lower()}"
        self._registry = registry
        self.python_type = None
        self.schema = schema

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
        if isinstance(self.schema, dict):
            return self._apply_dict_schema(data)
        return self._apply_list_schema(data)

    def _apply_dict_schema(self, data: Any) -> Any:
        """Apply dict schema to data."""
        if not isinstance(data, dict):
            raise TypeError(f"Expected dict for struct {self.code}, got {type(data).__name__}")
        result = dict(data)
        assert isinstance(self.schema, dict)
        for key, field_type in self.schema.items():  # pragma: no branch
            if key in result:
                result[key] = self._hydrate_field(result[key], field_type)
        return result

    def _apply_list_schema(self, data: Any) -> Any:
        """Apply list schema to data."""
        if not isinstance(data, list):
            raise TypeError(f"Expected list for struct {self.code}, got {type(data).__name__}")
        assert isinstance(self.schema, list)
        if len(self.schema) == 1:
            # Homogeneous: apply single type to all elements
            field_type = self.schema[0]
            return [self._apply_homogeneous(item, field_type) for item in data]
        else:
            # Positional: apply type at index i to data[i]
            # If data is array of arrays, apply positionally to each sub-array
            if data and isinstance(data[0], list):
                return [self._apply_positional(item) for item in data]
            return self._apply_positional(data)

    def _apply_homogeneous(self, item: Any, field_type: FieldValue) -> Any:
        """Apply homogeneous type recursively."""
        # Check for struct reference or inline struct first
        if isinstance(field_type, str) and field_type.startswith(STRUCT_PREFIX):
            return self._hydrate_field(item, field_type)
        if isinstance(field_type, (dict, list)):
            # Inline struct
            return self._hydrate_field(item, field_type)
        # For scalar types, recurse into nested lists
        if isinstance(item, list):
            return [self._apply_homogeneous(i, field_type) for i in item]
        return self._hydrate_field(item, field_type)

    def _apply_positional(self, data: list[Any]) -> list[Any]:
        """Apply positional schema to a single list."""
        assert isinstance(self.schema, list)
        result = []
        for i, item in enumerate(data):
            if i < len(self.schema):
                field_type = self.schema[i]
                result.append(self._hydrate_field(item, field_type))
            else:
                result.append(item)
        return result

    def _hydrate_field(self, value: Any, field_type: FieldValue) -> Any:
        """Hydrate a single value using field type.

        Args:
            value: The value to hydrate
            field_type: Type specification:
                - None or "": passthrough
                - str: type code or @STRUCT reference
                - dict: inline nested struct schema
                - list: inline nested list schema
        """
        # None or "" = passthrough (no conversion)
        if field_type is None or field_type == "":
            return value

        # Inline nested dict struct
        if isinstance(field_type, dict):
            inline_struct = StructType("_inline", field_type, self._registry)
            return inline_struct._apply_schema(value)

        # Inline nested list struct
        if isinstance(field_type, list):
            inline_struct = StructType("_inline", field_type, self._registry)
            return inline_struct._apply_schema(value)

        # String type code
        if isinstance(field_type, str):
            # Struct reference (@CODE)
            if field_type.startswith(STRUCT_PREFIX):
                struct_type = self._registry.get(field_type)
                if struct_type and isinstance(struct_type, StructType):
                    return struct_type._apply_schema(value)
                return value

            # Regular type
            type_cls = self._registry.get(field_type)
            if type_cls:
                type_instance = _get_type_instance(type_cls)
                if not isinstance(value, str):
                    value = str(value)
                return type_instance.parse(value)

        return value


def _get_type_instance(
    type_or_instance: type[DataType] | Any,
) -> Any:
    """Get a type instance from either a DataType class or wrapper instance."""
    # Check if it's already an instance (StructType, ExtensionType)
    if hasattr(type_or_instance, "parse") and not isinstance(type_or_instance, type):
        return type_or_instance
    # It's a class, instantiate it
    return type_or_instance()


__all__ = [
    "STRUCT_PREFIX",
    "StructType",
    # Metadata types
    "FieldMetadata",
    "FieldUI",
    "FieldValidate",
    "FieldValue",
    "MetadataDict",
]

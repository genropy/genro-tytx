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
- Field type definitions (FieldDef, FieldValidate, FieldUI)

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


class FieldDef(TypedDict, total=False):
    """Extended field definition with type and metadata."""

    type: str  # Required: TYTX type code
    validate: FieldValidate  # Validation constraints
    ui: FieldUI  # UI presentation hints


# Type alias for field value: string (simple) or FieldDef (extended)
FieldValue = str | FieldDef


def get_field_type(field: FieldValue) -> str:
    """
    Extract the type code from a field definition.

    Args:
        field: Either a string type code or a FieldDef object

    Returns:
        The TYTX type code

    Examples:
        get_field_type("T") -> "T"
        get_field_type({"type": "T", "validate": {"min": 1}}) -> "T"
    """
    if isinstance(field, str):
        return field
    return field.get("type", "T")


def get_field_validate(field: FieldValue) -> FieldValidate | None:
    """Extract validation constraints from a field definition."""
    if isinstance(field, str):
        return None
    return field.get("validate")


def get_field_ui(field: FieldValue) -> FieldUI | None:
    """Extract UI hints from a field definition."""
    if isinstance(field, str):
        return None
    return field.get("ui")


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


class StructType:
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
    schema: list[FieldValue] | dict[str, FieldValue] | str
    _registry: Any  # TypeRegistry - avoid circular import
    _string_fields: list[tuple[str, str]] | None
    _string_has_names: bool

    def __init__(
        self,
        code: str,
        schema: list[FieldValue] | dict[str, FieldValue] | str,
        registry: Any,  # TypeRegistry
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
            raise TypeError(
                f"Expected list for struct {self.code}, got {type(data).__name__}"
            )
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
            raise TypeError(
                f"Expected dict for struct {self.code}, got {type(data).__name__}"
            )
        result = dict(data)
        # Type narrowing: this method is only called when schema is a dict
        assert isinstance(self.schema, dict)
        for key, field_def in self.schema.items():
            type_code = get_field_type(field_def)
            if key in result:
                result[key] = self._hydrate_value(result[key], type_code)
        return result

    def _apply_list_schema(self, data: Any) -> Any:
        """Apply list schema to data."""
        if not isinstance(data, list):
            raise TypeError(
                f"Expected list for struct {self.code}, got {type(data).__name__}"
            )
        # Type narrowing: this method is only called when schema is a list
        assert isinstance(self.schema, list)
        if len(self.schema) == 1:
            # Homogeneous: apply single type to all elements
            field_def = self.schema[0]
            type_code = get_field_type(field_def)
            return [self._apply_homogeneous(item, type_code) for item in data]
        else:
            # Positional: apply type at index i to data[i]
            # If data is array of arrays, apply positionally to each sub-array
            if data and isinstance(data[0], list):
                return [self._apply_positional(item) for item in data]
            return self._apply_positional(data)

    def _apply_homogeneous(self, item: Any, type_code: str) -> Any:
        """Apply homogeneous type recursively."""
        # Struct references should be hydrated as a single value, even if the payload is a list
        if type_code.startswith(STRUCT_PREFIX):
            return self._hydrate_value(item, type_code)
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
                field_def = self.schema[i]
                type_code = get_field_type(field_def)
                result.append(self._hydrate_value(item, type_code))
            else:
                result.append(item)
        return result

    def _hydrate_value(self, value: Any, type_code: str) -> Any:
        """Hydrate a single value using type code."""
        # Check if it's a struct reference (recursive)
        if type_code.startswith(STRUCT_PREFIX):
            struct_type = self._registry.get(type_code)
            if struct_type and isinstance(struct_type, StructType):
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
    type_or_instance: type[DataType] | Any,
) -> Any:
    """Get a type instance from either a DataType class or wrapper instance."""
    # Check if it's already an instance (StructType, ExtensionType)
    if hasattr(type_or_instance, "parse") and not isinstance(type_or_instance, type):
        return type_or_instance
    # It's a class, instantiate it
    return type_or_instance()


# For backwards compatibility, alias _StructType
_StructType = StructType

__all__ = [
    "STRUCT_PREFIX",
    "StructType",
    "_StructType",
    "_parse_string_schema",
    # Struct v2 types
    "FieldDef",
    "FieldUI",
    "FieldValidate",
    "FieldValue",
    "get_field_type",
    "get_field_ui",
    "get_field_validate",
]

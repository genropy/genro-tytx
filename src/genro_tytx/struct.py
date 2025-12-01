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
Struct types and validation system for TYTX.

This module provides:
- _StructType: Schema-based data structures
- ValidationRegistry: Named validation rules with boolean expressions
- STANDARD_VALIDATIONS: Pre-defined common validations (email, cf, iban, etc.)

Validation Expression Syntax:
    validation:name           # Single validation
    validation:a&b            # AND - all must pass
    validation:a|b            # OR - at least one must pass
    validation:!a             # NOT - must NOT pass
    validation:!a&b|c         # Combined: (!a AND b) OR c

Operator Precedence:
    ! (NOT)  - highest (1)
    & (AND)  - medium (2)
    | (OR)   - lowest (3)
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, TypedDict

if TYPE_CHECKING:
    from .base import DataType

# Symbol prefix for struct schema types (at = @schema)
STRUCT_PREFIX = "@"


class ValidationDef(TypedDict, total=False):
    """Definition of a named validation rule."""

    pattern: str  # Regex pattern to match
    len: int  # Exact length constraint
    min: int | float  # Minimum value/length
    max: int | float  # Maximum value/length
    message: str  # Human-readable error message
    code: str  # Machine-readable error code


class ValidationError(Exception):
    """Raised when validation fails."""

    def __init__(
        self,
        message: str,
        validation_name: str | None = None,
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.validation_name = validation_name
        self.code = code


class ValidationRegistry:
    """
    Registry for named validation rules.

    Validations are referenced by name in type metadata:
        T[validation:email]
        T[validation:latin&uppercase]
        T[validation:cf|piva]
    """

    def __init__(self) -> None:
        self._validations: dict[str, ValidationDef] = {}
        self._compiled_patterns: dict[str, re.Pattern[str]] = {}

    def register(self, name: str, definition: ValidationDef) -> None:
        """
        Register a named validation.

        Args:
            name: Validation name (e.g., 'email', 'cf', 'latin')
            definition: Validation definition dict with pattern, message, etc.

        Example:
            registry.register('email', {
                'pattern': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                'message': 'Invalid email address'
            })
        """
        self._validations[name] = definition
        # Pre-compile pattern if present
        if "pattern" in definition:
            self._compiled_patterns[name] = re.compile(definition["pattern"])

    def unregister(self, name: str) -> None:
        """Remove a validation by name."""
        self._validations.pop(name, None)
        self._compiled_patterns.pop(name, None)

    def get(self, name: str) -> ValidationDef | None:
        """Get validation definition by name."""
        return self._validations.get(name)

    def validate(
        self,
        value: str,
        name: str,
        *,
        local_validations: dict[str, ValidationDef] | None = None,
        global_validations: dict[str, ValidationDef] | None = None,
    ) -> bool:
        """
        Validate a value against a named validation.

        Resolution order:
        1. local_validations (XTYTX lvalidation)
        2. global_validations (XTYTX gvalidation)
        3. registry (pre-registered)

        Args:
            value: String value to validate
            name: Validation name
            local_validations: Document-local validations (highest priority)
            global_validations: Global validations from XTYTX envelope

        Returns:
            True if valid, False otherwise

        Raises:
            KeyError: If validation name not found in any scope
        """
        # Resolve validation definition
        definition = None
        use_cache = True
        if local_validations and name in local_validations:
            definition = local_validations[name]
            use_cache = False  # Don't use cache for local validations
        elif global_validations and name in global_validations:
            definition = global_validations[name]
            use_cache = False  # Don't use cache for global validations
        elif name in self._validations:
            definition = self._validations[name]

        if definition is None:
            raise KeyError(f"Validation '{name}' not found")

        return self._check_definition(value, definition, name, use_cache=use_cache)

    def _check_definition(
        self, value: str, definition: ValidationDef, name: str, *, use_cache: bool = True
    ) -> bool:
        """Check value against a validation definition."""
        # Check pattern
        if "pattern" in definition:
            pattern = None
            if use_cache:
                pattern = self._compiled_patterns.get(name)
            if pattern is None:
                pattern = re.compile(definition["pattern"])
            if not pattern.match(value):
                return False

        # Check exact length
        if "len" in definition and len(value) != definition["len"]:
            return False

        # Check min length (for strings)
        if "min" in definition and len(value) < definition["min"]:
            return False

        # Check max length (for strings)
        return not ("max" in definition and len(value) > definition["max"])

    def validate_expression(
        self,
        value: str,
        expression: str,
        *,
        local_validations: dict[str, ValidationDef] | None = None,
        global_validations: dict[str, ValidationDef] | None = None,
    ) -> bool:
        """
        Validate a value against a boolean expression of validations.

        Supports:
        - Single: "email"
        - AND: "latin&uppercase" (all must pass)
        - OR: "cf|piva" (at least one must pass)
        - NOT: "!numeric" (must NOT pass)
        - Combined: "!numeric&latin" (NOT has highest precedence)

        Precedence: ! > & > |

        Args:
            value: String value to validate
            expression: Validation expression (e.g., "latin&cf|latin&piva")
            local_validations: Document-local validations
            global_validations: Global validations from XTYTX envelope

        Returns:
            True if expression evaluates to True, False otherwise
        """
        # Parse and evaluate expression
        return self._eval_expression(
            value,
            expression,
            local_validations=local_validations,
            global_validations=global_validations,
        )

    def _eval_expression(
        self,
        value: str,
        expr: str,
        *,
        local_validations: dict[str, ValidationDef] | None = None,
        global_validations: dict[str, ValidationDef] | None = None,
    ) -> bool:
        """
        Evaluate a validation expression.

        Uses recursive descent parsing with precedence:
        - OR (|) is lowest precedence, evaluated last
        - AND (&) is medium precedence
        - NOT (!) is highest precedence, evaluated first
        """
        # Split by OR first (lowest precedence)
        or_parts = self._split_by_operator(expr, "|")
        if len(or_parts) > 1:
            # OR: at least one must be true
            return any(
                self._eval_expression(
                    value,
                    part,
                    local_validations=local_validations,
                    global_validations=global_validations,
                )
                for part in or_parts
            )

        # Split by AND (medium precedence)
        and_parts = self._split_by_operator(expr, "&")
        if len(and_parts) > 1:
            # AND: all must be true
            return all(
                self._eval_expression(
                    value,
                    part,
                    local_validations=local_validations,
                    global_validations=global_validations,
                )
                for part in and_parts
            )

        # Handle NOT (highest precedence)
        expr = expr.strip()
        if expr.startswith("!"):
            name = expr[1:].strip()
            return not self.validate(
                value,
                name,
                local_validations=local_validations,
                global_validations=global_validations,
            )

        # Single validation name
        return self.validate(
            value,
            expr.strip(),
            local_validations=local_validations,
            global_validations=global_validations,
        )

    def _split_by_operator(self, expr: str, op: str) -> list[str]:
        """Split expression by operator, respecting any future grouping."""
        # Simple split for now (no parentheses support)
        return [p.strip() for p in expr.split(op) if p.strip()]

    def list_validations(self) -> list[str]:
        """Return list of all registered validation names."""
        return list(self._validations.keys())


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
    schema: list[str] | dict[str, str] | str
    _registry: Any  # TypeRegistry - avoid circular import
    _string_fields: list[tuple[str, str]] | None
    _string_has_names: bool

    def __init__(
        self,
        code: str,
        schema: list[str] | dict[str, str] | str,
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


# =============================================================================
# Standard Validations
# =============================================================================

STANDARD_VALIDATIONS: dict[str, ValidationDef] = {
    # Internet & Communication
    "email": {
        "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        "message": "Invalid email address",
    },
    "url": {
        "pattern": r"^https?://[^\s/$.?#].[^\s]*$",
        "message": "Invalid URL",
    },
    "domain": {
        "pattern": r"^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$",
        "message": "Invalid domain name",
    },
    "ipv4": {
        "pattern": r"^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$",
        "message": "Invalid IPv4 address",
    },
    "phone": {
        "pattern": r"^\+?[1-9]\d{1,14}$",
        "message": "Invalid phone number",
    },
    # Identifiers
    "uuid": {
        "pattern": r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        "message": "Invalid UUID v4",
    },
    "uuid_any": {
        "pattern": r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        "message": "Invalid UUID",
    },
    "slug": {
        "pattern": r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        "message": "Invalid slug (use lowercase, numbers, hyphens)",
    },
    # European Standards
    "iban": {
        "pattern": r"^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$",
        "message": "Invalid IBAN",
    },
    "bic": {
        "pattern": r"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$",
        "message": "Invalid BIC/SWIFT code",
    },
    "vat_eu": {
        "pattern": r"^[A-Z]{2}[0-9A-Z]{2,12}$",
        "message": "Invalid EU VAT number",
    },
    # Text Constraints
    "latin": {
        "pattern": r"^[\x00-\x7F]+$",
        "message": "Only ASCII/Latin characters allowed",
    },
    "latin_ext": {
        "pattern": r"^[\x00-\xFF]+$",
        "message": "Only Latin characters allowed",
    },
    "uppercase": {
        "pattern": r"^[A-Z]+$",
        "message": "Must be uppercase letters only",
    },
    "lowercase": {
        "pattern": r"^[a-z]+$",
        "message": "Must be lowercase letters only",
    },
    "alphanumeric": {
        "pattern": r"^[a-zA-Z0-9]+$",
        "message": "Only letters and numbers allowed",
    },
    "no_spaces": {
        "pattern": r"^\S+$",
        "message": "Spaces not allowed",
    },
    "single_line": {
        "pattern": r"^[^\r\n]+$",
        "message": "Must be single line",
    },
    # Numeric Formats
    "positive_int": {
        "pattern": r"^[1-9][0-9]*$",
        "message": "Must be a positive integer",
    },
    "non_negative_int": {
        "pattern": r"^(0|[1-9][0-9]*)$",
        "message": "Must be zero or positive integer",
    },
    "decimal": {
        "pattern": r"^-?[0-9]+(\.[0-9]+)?$",
        "message": "Must be a decimal number",
    },
    "percentage": {
        "pattern": r"^(100(\.0+)?|[0-9]{1,2}(\.[0-9]+)?)$",
        "min": 0,
        "max": 100,
        "message": "Must be a percentage (0-100)",
    },
    # Date & Time Formats
    "iso_date": {
        "pattern": r"^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$",
        "message": "Invalid date format (use YYYY-MM-DD)",
    },
    "iso_datetime": {
        "pattern": r"^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](Z|[+-][0-9]{2}:[0-9]{2})?$",
        "message": "Invalid datetime format (use ISO 8601)",
    },
    "time": {
        "pattern": r"^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$",
        "message": "Invalid time format (use HH:MM or HH:MM:SS)",
    },
    "year": {
        "pattern": r"^[0-9]{4}$",
        "len": 4,
        "message": "Invalid year (use YYYY)",
    },
    # Security
    "password_strong": {
        "pattern": r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$",
        "min": 8,
        "message": "Password must have 8+ chars, uppercase, lowercase, digit, special char",
    },
    "hex": {
        "pattern": r"^[0-9a-fA-F]+$",
        "message": "Must be hexadecimal",
    },
    "base64": {
        "pattern": r"^[A-Za-z0-9+/]+=*$",
        "message": "Must be valid Base64",
    },
}


def create_validation_registry(include_standard: bool = True) -> ValidationRegistry:
    """
    Create a new ValidationRegistry, optionally with standard validations.

    Args:
        include_standard: If True, pre-register all STANDARD_VALIDATIONS

    Returns:
        New ValidationRegistry instance
    """
    registry = ValidationRegistry()
    if include_standard:
        for name, definition in STANDARD_VALIDATIONS.items():
            registry.register(name, definition)
    return registry


# Global validation registry instance (with standard validations)
validation_registry = create_validation_registry(include_standard=True)


# For backwards compatibility, alias _StructType
_StructType = StructType

__all__ = [
    "STANDARD_VALIDATIONS",
    "STRUCT_PREFIX",
    "StructType",
    "ValidationDef",
    "ValidationError",
    "ValidationRegistry",
    "_StructType",
    "_parse_string_schema",
    "create_validation_registry",
    "validation_registry",
]

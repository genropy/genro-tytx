"""
JSON Schema / OpenAPI utilities for TYTX Protocol.

Provides bidirectional conversion between TYTX struct definitions
and JSON Schema / OpenAPI schemas.

Functions:
    struct_from_jsonschema(schema, name=None, registry=None) - Convert JSON Schema to TYTX struct
    struct_to_jsonschema(struct, name=None, registry=None) - Convert TYTX struct to JSON Schema

Type Mapping (JSON Schema → TYTX):
    integer                         → L
    number                          → R
    number + format: decimal        → N
    boolean                         → B
    string                          → T
    string + format: date           → D
    string + format: date-time      → DHZ
    string + format: time           → H
    array + items                   → #X or #@STRUCT
    object + properties             → @STRUCT (nested)

Field Format (inline FieldDef for self-contained schemas):
    Simple field (no constraints):
        "name": "T"

    Field with constraints:
        "name": {
            "type": "T",
            "validate": {"min": 1, "max": 100, "required": true},
            "ui": {"label": "Name", "placeholder": "..."}
        }

NOTE: For registry-based operations with separate schema/metadata, use:
- registry.struct_from_model() → returns (schema, metadata) tuple
- registry.register_struct(code, schema, metadata) → stores separately

Constraint Mapping (JSON Schema → TYTX validate):
    JSON Schema         TYTX validate key
    minLength           min (for strings)
    maxLength           max (for strings)
    minimum             min (for numbers)
    maximum             max (for numbers)
    pattern             pattern
    enum                enum
    required (in parent) required

UI Mapping (JSON Schema → TYTX ui):
    JSON Schema         TYTX ui key
    title               label
    description         hint

Usage:
    from genro_tytx import struct_from_jsonschema, struct_to_jsonschema

    # JSON Schema → TYTX (inline FieldDef format)
    schema = {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "name": {"type": "string", "minLength": 1},
            "price": {"type": "number", "format": "decimal"}
        },
        "required": ["id", "name"]
    }
    struct = struct_from_jsonschema(schema)
    # → {
    #     "id": {"type": "L", "validate": {"required": True}},
    #     "name": {"type": "T", "validate": {"min": 1, "required": True}},
    #     "price": "N"
    # }

    # TYTX → JSON Schema
    struct = {"id": "L", "name": {"type": "T", "validate": {"min": 1}}, "price": "N"}
    schema = struct_to_jsonschema(struct)
    # → {"type": "object", "properties": {...}}

Copyright: Softwell S.r.l. (2025)
License: Apache License 2.0
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .registry import TypeRegistry

# JSON Schema type/format → TYTX code mapping
_JSONSCHEMA_TO_TYTX: dict[tuple[str, str | None], str] = {
    # Basic types
    ("integer", None): "L",
    ("number", None): "R",
    ("number", "decimal"): "N",
    ("number", "float"): "R",
    ("number", "double"): "R",
    ("boolean", None): "B",
    ("string", None): "T",
    # Date/time formats
    ("string", "date"): "D",
    ("string", "date-time"): "DHZ",
    ("string", "time"): "H",
    # Other string formats (still strings in TYTX)
    ("string", "email"): "T",
    ("string", "uri"): "T",
    ("string", "uuid"): "T",
}

# TYTX code → JSON Schema type/format mapping
_TYTX_TO_JSONSCHEMA: dict[str, dict[str, Any]] = {
    "L": {"type": "integer"},
    "R": {"type": "number"},
    "N": {"type": "number", "format": "decimal"},
    "B": {"type": "boolean"},
    "T": {"type": "string"},
    "S": {"type": "string"},  # Alias for T
    "D": {"type": "string", "format": "date"},
    "DH": {"type": "string", "format": "date-time"},
    "DHZ": {"type": "string", "format": "date-time"},
    "H": {"type": "string", "format": "time"},
    "JS": {"type": "object"},
}


def _resolve_ref(
    ref: str,
    root_schema: dict[str, Any],
) -> dict[str, Any]:
    """
    Resolve a JSON Schema $ref to its definition.

    Only supports local references (#/definitions/... or #/$defs/...).

    Args:
        ref: The $ref string (e.g., "#/definitions/Address")
        root_schema: The root schema containing definitions

    Returns:
        The resolved schema definition.

    Raises:
        ValueError: If the reference cannot be resolved.
    """
    if not ref.startswith("#/"):
        raise ValueError(f"Only local $ref supported, got: {ref}")

    parts = ref[2:].split("/")  # Remove "#/" and split

    current = root_schema
    for part in parts:
        if part not in current:
            raise ValueError(f"Cannot resolve $ref: {ref}")
        current = current[part]

    return current


def _jsonschema_type_to_tytx(
    prop_schema: dict[str, Any],
    prop_name: str,
    root_schema: dict[str, Any],
    nested_structs: dict[str, dict[str, Any]],
    parent_name: str,
    is_required: bool = False,
) -> str | dict[str, Any]:
    """
    Convert a JSON Schema property definition to TYTX v2 field definition.

    Args:
        prop_schema: The property schema
        prop_name: Property name (used for generating nested struct names)
        root_schema: Root schema (for resolving $ref)
        nested_structs: Dict to collect nested struct definitions
        parent_name: Parent struct name (for naming nested structs)
        is_required: Whether this field is required

    Returns:
        Simple type code string or inline FieldDef dict.
    """
    # Handle $ref
    if "$ref" in prop_schema:
        resolved = _resolve_ref(prop_schema["$ref"], root_schema)
        ref_name = prop_schema["$ref"].split("/")[-1]
        # Process the referenced schema as a nested struct
        if resolved.get("type") == "object" and "properties" in resolved:
            nested_struct = _convert_object_schema(resolved, ref_name, root_schema, nested_structs)
            nested_structs[ref_name] = nested_struct
            ref_type = f"@{ref_name}"
            if is_required:
                return {"type": ref_type, "validate": {"required": True}}
            return ref_type
        # Otherwise convert directly
        return _jsonschema_type_to_tytx(
            resolved, prop_name, root_schema, nested_structs, parent_name, is_required
        )

    # Handle oneOf/anyOf (take first option)
    if "oneOf" in prop_schema:
        return _jsonschema_type_to_tytx(
            prop_schema["oneOf"][0],
            prop_name,
            root_schema,
            nested_structs,
            parent_name,
            is_required,
        )
    if "anyOf" in prop_schema:
        # Filter out null types for Optional handling
        non_null = [s for s in prop_schema["anyOf"] if s.get("type") != "null"]
        if non_null:
            return _jsonschema_type_to_tytx(
                non_null[0],
                prop_name,
                root_schema,
                nested_structs,
                parent_name,
                is_required,
            )

    schema_type = prop_schema.get("type")
    schema_format = prop_schema.get("format")

    # Handle array type
    if schema_type == "array":
        items = prop_schema.get("items", {})
        item_field = _jsonschema_type_to_tytx(
            items, prop_name, root_schema, nested_structs, parent_name, False
        )
        # Extract the type code from item_field
        item_type = item_field["type"] if isinstance(item_field, dict) else item_field
        array_type = f"#{item_type}"
        if is_required:
            return {"type": array_type, "validate": {"required": True}}
        return array_type

    # Handle nested object
    if schema_type == "object" and "properties" in prop_schema:
        # Generate a name for the nested struct
        nested_name = f"{parent_name}_{prop_name}".upper()
        nested_struct = _convert_object_schema(
            prop_schema, nested_name, root_schema, nested_structs
        )
        nested_structs[nested_name] = nested_struct
        ref_type = f"@{nested_name}"
        if is_required:
            return {"type": ref_type, "validate": {"required": True}}
        return ref_type

    # Handle basic types
    key: tuple[str, str | None] = (schema_type or "", schema_format)
    if key in _JSONSCHEMA_TO_TYTX:
        return _build_field_def(prop_schema, _JSONSCHEMA_TO_TYTX[key], is_required)

    # Fallback: try without format
    key_no_format: tuple[str, str | None] = (schema_type or "", None)
    if key_no_format in _JSONSCHEMA_TO_TYTX:
        return _build_field_def(prop_schema, _JSONSCHEMA_TO_TYTX[key_no_format], is_required)

    # Default to string
    return _build_field_def(prop_schema, "T", is_required)


def _build_field_def(
    prop_schema: dict[str, Any],
    base_type: str,
    is_required: bool = False,
) -> str | dict[str, Any]:
    """
    Build TYTX v2 field definition from JSON Schema constraints.

    Args:
        prop_schema: The property schema with constraints
        base_type: The base TYTX type code
        is_required: Whether the field is required

    Returns:
        Simple type code string if no constraints, or inline FieldDef dict.
    """
    validate: dict[str, Any] = {}
    ui: dict[str, Any] = {}

    # String constraints
    if "minLength" in prop_schema:
        validate["min"] = prop_schema["minLength"]
    if "maxLength" in prop_schema:
        validate["max"] = prop_schema["maxLength"]
    if "pattern" in prop_schema:
        validate["pattern"] = prop_schema["pattern"]

    # Number constraints
    if "minimum" in prop_schema:
        validate["min"] = prop_schema["minimum"]
    if "maximum" in prop_schema:
        validate["max"] = prop_schema["maximum"]
    if "exclusiveMinimum" in prop_schema:
        validate["min"] = prop_schema["exclusiveMinimum"]
        validate["minExclusive"] = True
    if "exclusiveMaximum" in prop_schema:
        validate["max"] = prop_schema["exclusiveMaximum"]
        validate["maxExclusive"] = True

    # Enum
    if "enum" in prop_schema:
        validate["enum"] = prop_schema["enum"]

    # Default
    if "default" in prop_schema:
        validate["default"] = prop_schema["default"]

    # Required
    if is_required:
        validate["required"] = True

    # UI hints from title/description
    if "title" in prop_schema:
        ui["label"] = prop_schema["title"]
    if "description" in prop_schema:
        ui["hint"] = prop_schema["description"]

    # Return simple type or inline FieldDef
    if validate or ui:
        field_def: dict[str, Any] = {"type": base_type}
        if validate:
            field_def["validate"] = validate
        if ui:
            field_def["ui"] = ui
        return field_def

    return base_type


def _convert_object_schema(
    schema: dict[str, Any],
    name: str,
    root_schema: dict[str, Any],
    nested_structs: dict[str, dict[str, Any]],
) -> dict[str, str | dict[str, Any]]:
    """
    Convert a JSON Schema object to TYTX v2 struct dict.

    Args:
        schema: The object schema
        name: Name for this struct
        root_schema: Root schema (for resolving $ref)
        nested_structs: Dict to collect nested struct definitions

    Returns:
        TYTX struct definition dict (inline FieldDef format).
    """
    properties = schema.get("properties", {})
    required_fields = set(schema.get("required", []))
    struct: dict[str, str | dict[str, Any]] = {}

    for prop_name, prop_schema in properties.items():
        is_required = prop_name in required_fields
        tytx_field = _jsonschema_type_to_tytx(
            prop_schema, prop_name, root_schema, nested_structs, name, is_required
        )
        struct[prop_name] = tytx_field

    return struct


def struct_from_jsonschema(
    schema: dict[str, Any],
    name: str | None = None,
    registry: TypeRegistry | None = None,
    register_nested: bool = True,
) -> dict[str, str | dict[str, Any]]:
    """
    Convert JSON Schema to TYTX v2 struct definition.

    Supports:
    - Basic types (integer, number, boolean, string)
    - Format hints (date, date-time, time, decimal)
    - Arrays with typed items
    - Nested objects (converted to nested @STRUCT references)
    - $ref references (local only: #/definitions/... or #/$defs/...)
    - Constraints → validate section (minLength, maxLength, pattern, enum, etc.)
    - UI hints → ui section (title, description)

    Args:
        schema: JSON Schema object (must have type: "object")
        name: Optional name for the root struct (used for nested naming)
        registry: Optional TypeRegistry to register nested structs
        register_nested: If True, register nested structs in registry

    Returns:
        TYTX struct definition dict (inline FieldDef format).

    Raises:
        ValueError: If schema is not an object type.

    Example:
        >>> schema = {
        ...     "type": "object",
        ...     "properties": {
        ...         "id": {"type": "integer"},
        ...         "name": {"type": "string", "minLength": 1, "title": "Name"},
        ...         "price": {"type": "number", "format": "decimal"}
        ...     },
        ...     "required": ["id", "name"]
        ... }
        >>> struct_from_jsonschema(schema)
        {
            'id': {'type': 'L', 'validate': {'required': True}},
            'name': {'type': 'T', 'validate': {'min': 1, 'required': True}, 'ui': {'label': 'Name'}},
            'price': 'N'
        }
    """
    if schema.get("type") != "object":
        raise ValueError("JSON Schema must have type: 'object'")

    root_name = name or "ROOT"
    nested_structs: dict[str, dict[str, Any]] = {}

    struct = _convert_object_schema(schema, root_name, schema, nested_structs)

    # Register nested structs if requested
    if register_nested and registry is not None:
        for struct_name, struct_def in nested_structs.items():
            registry.register_struct(struct_name, struct_def)

    return struct


def _tytx_field_to_jsonschema(
    field: str | dict[str, Any],
    definitions: dict[str, Any],
    registry: TypeRegistry | None = None,
    required_fields: set[str] | None = None,
    field_name: str | None = None,
) -> dict[str, Any]:
    """
    Convert TYTX v2 field definition to JSON Schema property definition.

    Args:
        field: TYTX field (simple type code or inline FieldDef dict)
        definitions: Dict to collect $ref definitions
        registry: Optional TypeRegistry to look up struct definitions
        required_fields: Set to collect required field names
        field_name: Field name (for required tracking)

    Returns:
        JSON Schema property definition.
    """
    # Handle inline FieldDef dict
    if isinstance(field, dict):
        type_code = field.get("type", "T")
        validate = field.get("validate", {})
        ui = field.get("ui", {})

        # Get base schema for the type
        result = _type_code_to_jsonschema(type_code, definitions, registry)

        # Apply validate constraints
        if "min" in validate:
            if result.get("type") == "string":
                result["minLength"] = validate["min"]
            else:
                result["minimum"] = validate["min"]
        if "max" in validate:
            if result.get("type") == "string":
                result["maxLength"] = validate["max"]
            else:
                result["maximum"] = validate["max"]
        if "length" in validate:
            result["minLength"] = validate["length"]
            result["maxLength"] = validate["length"]
        if "pattern" in validate:
            result["pattern"] = validate["pattern"]
        if "enum" in validate:
            result["enum"] = validate["enum"]
        if "default" in validate:
            result["default"] = validate["default"]
        if validate.get("required") and required_fields is not None and field_name:
            required_fields.add(field_name)

        # Apply ui hints
        if "label" in ui:
            result["title"] = ui["label"]
        if "hint" in ui:
            result["description"] = ui["hint"]

        return result

    # Simple type code string
    return _type_code_to_jsonschema(field, definitions, registry)


def _type_code_to_jsonschema(
    type_code: str,
    definitions: dict[str, Any],
    registry: TypeRegistry | None = None,
) -> dict[str, Any]:
    """
    Convert TYTX type code to JSON Schema.

    Args:
        type_code: TYTX type code (e.g., "L", "@ADDRESS", "#L")
        definitions: Dict to collect $ref definitions
        registry: Optional TypeRegistry

    Returns:
        JSON Schema property definition.
    """
    # Handle array type (#X)
    if type_code.startswith("#"):
        inner_type = type_code[1:]
        items_schema = _type_code_to_jsonschema(inner_type, definitions, registry)
        return {"type": "array", "items": items_schema}

    # Handle struct reference (@STRUCT)
    if type_code.startswith("@"):
        struct_name = type_code[1:]
        # Add to definitions if we have a registry
        if registry is not None and struct_name not in definitions:
            struct_def = registry.get_struct(struct_name)
            if struct_def is not None:
                definitions[struct_name] = _struct_to_schema_object(
                    struct_def, definitions, registry
                )
        return {"$ref": f"#/definitions/{struct_name}"}

    # Basic type conversion
    if type_code in _TYTX_TO_JSONSCHEMA:
        return _TYTX_TO_JSONSCHEMA[type_code].copy()

    # Default to string
    return {"type": "string"}


def _struct_to_schema_object(
    struct: dict[str, Any] | list[Any] | str,
    definitions: dict[str, Any],
    registry: TypeRegistry | None = None,
) -> dict[str, Any]:
    """
    Convert TYTX v2 struct to JSON Schema object definition.

    Args:
        struct: TYTX struct definition (dict with inline FieldDef, list, or string)
        definitions: Dict to collect $ref definitions
        registry: Optional TypeRegistry to look up nested structs

    Returns:
        JSON Schema object definition.
    """
    if isinstance(struct, dict):
        properties: dict[str, Any] = {}
        required_fields: set[str] = set()

        for prop_name, field in struct.items():
            properties[prop_name] = _tytx_field_to_jsonschema(
                field, definitions, registry, required_fields, prop_name
            )

        result: dict[str, Any] = {"type": "object", "properties": properties}
        if required_fields:
            result["required"] = sorted(required_fields)
        return result

    if isinstance(struct, list):
        # Positional or homogeneous list schema
        if len(struct) == 1:
            # Homogeneous array
            item_schema = _tytx_field_to_jsonschema(struct[0], definitions, registry)
            return {"type": "array", "items": item_schema}
        # Positional (tuple-like)
        items_list = [_tytx_field_to_jsonschema(t, definitions, registry) for t in struct]
        return {
            "type": "array",
            "items": items_list,
            "minItems": len(struct),
            "maxItems": len(struct),
        }

    if isinstance(struct, str):
        # String schema (e.g., "name:T,qty:L")
        if ":" in struct:
            # Named fields
            properties = {}
            for field_str in struct.split(","):
                field_str = field_str.strip()
                if ":" in field_str:
                    name, type_code = field_str.split(":", 1)
                    properties[name.strip()] = _tytx_field_to_jsonschema(
                        type_code.strip(), definitions, registry
                    )
            return {"type": "object", "properties": properties}
        # Anonymous fields (e.g., "T,L,N")
        items_list = [
            _tytx_field_to_jsonschema(t.strip(), definitions, registry) for t in struct.split(",")
        ]
        return {
            "type": "array",
            "items": items_list,
            "minItems": len(items_list),
            "maxItems": len(items_list),
        }

    return {"type": "object"}


def struct_to_jsonschema(
    struct: dict[str, str | dict[str, Any]] | list[str] | str,
    name: str | None = None,
    registry: TypeRegistry | None = None,
    include_definitions: bool = True,
) -> dict[str, Any]:
    """
    Convert TYTX v2 struct to JSON Schema.

    Supports:
    - Dict structs → object with properties
    - List structs → array (positional or homogeneous)
    - String structs → object or array based on format
    - Nested @STRUCT references → $ref
    - Inline FieldDef validate section → JSON Schema constraints
    - Inline FieldDef ui section → title/description

    Args:
        struct: TYTX struct definition (dict with inline FieldDef, list, or string)
        name: Optional name for the root schema
        registry: Optional TypeRegistry to look up nested struct definitions
        include_definitions: If True, include definitions for nested structs

    Returns:
        JSON Schema object.

    Example:
        >>> struct = {
        ...     "id": {"type": "L", "validate": {"required": True}},
        ...     "name": {"type": "T", "validate": {"min": 1}, "ui": {"label": "Name"}},
        ...     "price": "N"
        ... }
        >>> struct_to_jsonschema(struct)
        {
            'type': 'object',
            'properties': {
                'id': {'type': 'integer'},
                'name': {'type': 'string', 'minLength': 1, 'title': 'Name'},
                'price': {'type': 'number', 'format': 'decimal'}
            },
            'required': ['id']
        }
    """
    definitions: dict[str, Any] = {}
    schema = _struct_to_schema_object(struct, definitions, registry)

    # Add schema metadata
    if name:
        schema["title"] = name

    # Add definitions if present and requested
    if include_definitions and definitions:
        schema["definitions"] = definitions

    return schema


__all__ = [
    "struct_from_jsonschema",
    "struct_to_jsonschema",
]

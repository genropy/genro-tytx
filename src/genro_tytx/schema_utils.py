"""
JSON Schema / OpenAPI utilities for TYTX Protocol.

Provides bidirectional conversion between TYTX struct definitions and
JSON Schema / OpenAPI schemas.

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
    string + format: date-time      → DH (or DHZ if timezone present)
    string + format: time           → H
    array + items                   → #X or #@STRUCT
    object + properties             → @STRUCT (nested)

Metadata Mapping:
    JSON Schema         TYTX facet
    minLength           min (for strings)
    maxLength           max (for strings)
    minimum             min (for numbers)
    maximum             max (for numbers)
    pattern             reg
    enum                enum

Usage:
    from genro_tytx import struct_from_jsonschema, struct_to_jsonschema

    # JSON Schema → TYTX
    schema = {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "name": {"type": "string"},
            "price": {"type": "number", "format": "decimal"}
        }
    }
    struct = struct_from_jsonschema(schema)
    # → {"id": "L", "name": "T", "price": "N"}

    # TYTX → JSON Schema
    struct = {"id": "L", "name": "T", "price": "N"}
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
    ("string", "date-time"): "DH",
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
) -> str:
    """
    Convert a JSON Schema property definition to TYTX type code.

    Args:
        prop_schema: The property schema
        prop_name: Property name (used for generating nested struct names)
        root_schema: Root schema (for resolving $ref)
        nested_structs: Dict to collect nested struct definitions
        parent_name: Parent struct name (for naming nested structs)

    Returns:
        TYTX type code string.
    """
    # Handle $ref
    if "$ref" in prop_schema:
        resolved = _resolve_ref(prop_schema["$ref"], root_schema)
        ref_name = prop_schema["$ref"].split("/")[-1]
        # Process the referenced schema as a nested struct
        if resolved.get("type") == "object" and "properties" in resolved:
            nested_struct = _convert_object_schema(
                resolved, ref_name, root_schema, nested_structs
            )
            nested_structs[ref_name] = nested_struct
            return f"@{ref_name}"
        # Otherwise convert directly
        return _jsonschema_type_to_tytx(
            resolved, prop_name, root_schema, nested_structs, parent_name
        )

    # Handle oneOf/anyOf (take first option)
    if "oneOf" in prop_schema:
        return _jsonschema_type_to_tytx(
            prop_schema["oneOf"][0], prop_name, root_schema, nested_structs, parent_name
        )
    if "anyOf" in prop_schema:
        # Filter out null types for Optional handling
        non_null = [s for s in prop_schema["anyOf"] if s.get("type") != "null"]
        if non_null:
            return _jsonschema_type_to_tytx(
                non_null[0], prop_name, root_schema, nested_structs, parent_name
            )

    schema_type = prop_schema.get("type")
    schema_format = prop_schema.get("format")

    # Handle array type
    if schema_type == "array":
        items = prop_schema.get("items", {})
        item_type = _jsonschema_type_to_tytx(
            items, prop_name, root_schema, nested_structs, parent_name
        )
        return f"#{item_type}"

    # Handle nested object
    if schema_type == "object" and "properties" in prop_schema:
        # Generate a name for the nested struct
        nested_name = f"{parent_name}_{prop_name}".upper()
        nested_struct = _convert_object_schema(
            prop_schema, nested_name, root_schema, nested_structs
        )
        nested_structs[nested_name] = nested_struct
        return f"@{nested_name}"

    # Handle basic types
    key: tuple[str, str | None] = (schema_type or "", schema_format)
    if key in _JSONSCHEMA_TO_TYTX:
        return _add_metadata(prop_schema, _JSONSCHEMA_TO_TYTX[key])

    # Fallback: try without format
    key_no_format: tuple[str, str | None] = (schema_type or "", None)
    if key_no_format in _JSONSCHEMA_TO_TYTX:
        return _add_metadata(prop_schema, _JSONSCHEMA_TO_TYTX[key_no_format])

    # Default to string
    return _add_metadata(prop_schema, "T")


def _add_metadata(prop_schema: dict[str, Any], base_type: str) -> str:
    """
    Add TYTX metadata facets from JSON Schema constraints.

    Args:
        prop_schema: The property schema with constraints
        base_type: The base TYTX type code

    Returns:
        TYTX type code with metadata if present.
    """
    facets = []

    # String constraints
    if "minLength" in prop_schema:
        facets.append(f"min:{prop_schema['minLength']}")
    if "maxLength" in prop_schema:
        facets.append(f"max:{prop_schema['maxLength']}")
    if "pattern" in prop_schema:
        # Quote the pattern
        pattern = prop_schema["pattern"].replace('"', '\\"')
        facets.append(f'reg:"{pattern}"')

    # Number constraints
    if "minimum" in prop_schema:
        facets.append(f"min:{prop_schema['minimum']}")
    if "maximum" in prop_schema:
        facets.append(f"max:{prop_schema['maximum']}")

    # Enum
    if "enum" in prop_schema:
        enum_values = "|".join(str(v) for v in prop_schema["enum"])
        facets.append(f"enum:{enum_values}")

    # Title/description as UI hints
    if "title" in prop_schema:
        title = prop_schema["title"].replace('"', '\\"')
        facets.append(f'lbl:"{title}"')
    if "description" in prop_schema:
        desc = prop_schema["description"].replace('"', '\\"')
        facets.append(f'hint:"{desc}"')

    if facets:
        return f"{base_type}[{','.join(facets)}]"
    return base_type


def _convert_object_schema(
    schema: dict[str, Any],
    name: str,
    root_schema: dict[str, Any],
    nested_structs: dict[str, dict[str, Any]],
) -> dict[str, str]:
    """
    Convert a JSON Schema object to TYTX struct dict.

    Args:
        schema: The object schema
        name: Name for this struct
        root_schema: Root schema (for resolving $ref)
        nested_structs: Dict to collect nested struct definitions

    Returns:
        TYTX struct definition dict.
    """
    properties = schema.get("properties", {})
    struct: dict[str, str] = {}

    for prop_name, prop_schema in properties.items():
        tytx_type = _jsonschema_type_to_tytx(
            prop_schema, prop_name, root_schema, nested_structs, name
        )
        struct[prop_name] = tytx_type

    return struct


def struct_from_jsonschema(
    schema: dict[str, Any],
    name: str | None = None,
    registry: TypeRegistry | None = None,
    register_nested: bool = True,
) -> dict[str, str]:
    """
    Convert JSON Schema to TYTX struct definition.

    Supports:
    - Basic types (integer, number, boolean, string)
    - Format hints (date, date-time, time, decimal)
    - Arrays with typed items
    - Nested objects (converted to nested @STRUCT references)
    - $ref references (local only: #/definitions/... or #/$defs/...)
    - Constraints → metadata (minLength, maxLength, pattern, enum, etc.)

    Args:
        schema: JSON Schema object (must have type: "object")
        name: Optional name for the root struct (used for nested naming)
        registry: Optional TypeRegistry to register nested structs
        register_nested: If True, register nested structs in registry

    Returns:
        TYTX struct definition dict.

    Raises:
        ValueError: If schema is not an object type.

    Example:
        >>> schema = {
        ...     "type": "object",
        ...     "properties": {
        ...         "id": {"type": "integer"},
        ...         "name": {"type": "string", "minLength": 1},
        ...         "price": {"type": "number", "format": "decimal"}
        ...     }
        ... }
        >>> struct_from_jsonschema(schema)
        {'id': 'L', 'name': 'T[min:1]', 'price': 'N'}
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


def _tytx_type_to_jsonschema(
    tytx_type: str,
    definitions: dict[str, Any],
    registry: TypeRegistry | None = None,
) -> dict[str, Any]:
    """
    Convert TYTX type code to JSON Schema property definition.

    Args:
        tytx_type: TYTX type code (e.g., "L", "T[min:1]", "@ADDRESS", "#L")
        definitions: Dict to collect $ref definitions
        registry: Optional TypeRegistry to look up struct definitions

    Returns:
        JSON Schema property definition.
    """
    # Parse metadata if present
    base_type = tytx_type
    metadata: dict[str, Any] = {}

    if "[" in tytx_type:
        bracket_idx = tytx_type.index("[")
        base_type = tytx_type[:bracket_idx]
        # Parse metadata - simplified parsing
        meta_str = tytx_type[bracket_idx + 1 : -1]
        metadata = _parse_metadata_to_jsonschema(meta_str)

    # Handle array type (#X)
    if base_type.startswith("#"):
        inner_type = base_type[1:]
        items_schema = _tytx_type_to_jsonschema(inner_type, definitions, registry)
        return {"type": "array", "items": items_schema, **metadata}

    # Handle struct reference (@STRUCT)
    if base_type.startswith("@"):
        struct_name = base_type[1:]
        # Add to definitions if we have a registry
        if registry is not None and struct_name not in definitions:
            struct_def = registry.get_struct(struct_name)
            if struct_def is not None:
                definitions[struct_name] = _struct_to_schema_object(
                    struct_def, definitions, registry
                )
        return {"$ref": f"#/definitions/{struct_name}"}

    # Basic type conversion
    if base_type in _TYTX_TO_JSONSCHEMA:
        result = _TYTX_TO_JSONSCHEMA[base_type].copy()
        result.update(metadata)
        return result

    # Default to string
    return {"type": "string", **metadata}


def _parse_metadata_to_jsonschema(meta_str: str) -> dict[str, Any]:
    """
    Parse TYTX metadata string to JSON Schema constraints.

    Args:
        meta_str: Metadata string (e.g., "min:1,max:100,reg:\"^[A-Z]+$\"")

    Returns:
        JSON Schema constraints dict.
    """
    result: dict[str, Any] = {}

    # Simple parsing - split by comma but respect quoted values
    parts = []
    current = ""
    in_quotes = False

    for char in meta_str:
        if char == '"' and (not current or current[-1] != "\\"):
            in_quotes = not in_quotes
            current += char
        elif char == "," and not in_quotes:
            if current.strip():
                parts.append(current.strip())
            current = ""
        else:
            current += char

    if current.strip():
        parts.append(current.strip())

    for part in parts:
        if ":" not in part:
            continue

        key, value = part.split(":", 1)
        key = key.strip()
        value = value.strip()

        # Remove quotes
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1].replace('\\"', '"')

        if key == "min":
            # Could be minLength or minimum depending on type
            try:
                result["minimum"] = int(value)
            except ValueError:
                try:
                    result["minimum"] = float(value)
                except ValueError:
                    result["minLength"] = int(value) if value.isdigit() else 0
        elif key == "max":
            try:
                result["maximum"] = int(value)
            except ValueError:
                try:
                    result["maximum"] = float(value)
                except ValueError:
                    result["maxLength"] = int(value) if value.isdigit() else 0
        elif key == "len":
            length = int(value)
            result["minLength"] = length
            result["maxLength"] = length
        elif key == "reg":
            result["pattern"] = value
        elif key == "enum":
            result["enum"] = value.split("|")
        elif key == "lbl":
            result["title"] = value
        elif key == "hint":
            result["description"] = value

    return result


def _struct_to_schema_object(
    struct: dict[str, str] | list[str] | str,
    definitions: dict[str, Any],
    registry: TypeRegistry | None = None,
) -> dict[str, Any]:
    """
    Convert TYTX struct to JSON Schema object definition.

    Args:
        struct: TYTX struct definition
        definitions: Dict to collect $ref definitions
        registry: Optional TypeRegistry to look up nested structs

    Returns:
        JSON Schema object definition.
    """
    if isinstance(struct, dict):
        properties = {}
        for prop_name, prop_type in struct.items():
            properties[prop_name] = _tytx_type_to_jsonschema(
                prop_type, definitions, registry
            )
        return {"type": "object", "properties": properties}

    if isinstance(struct, list):
        # Positional or homogeneous list schema
        if len(struct) == 1:
            # Homogeneous array
            item_schema = _tytx_type_to_jsonschema(struct[0], definitions, registry)
            return {"type": "array", "items": item_schema}
        # Positional (tuple-like)
        items_list = [
            _tytx_type_to_jsonschema(t, definitions, registry) for t in struct
        ]
        return {"type": "array", "items": items_list, "minItems": len(struct), "maxItems": len(struct)}

    if isinstance(struct, str):
        # String schema (e.g., "name:T,qty:L")
        if ":" in struct:
            # Named fields
            properties = {}
            for field in struct.split(","):
                field = field.strip()
                if ":" in field:
                    name, type_code = field.split(":", 1)
                    properties[name.strip()] = _tytx_type_to_jsonschema(
                        type_code.strip(), definitions, registry
                    )
            return {"type": "object", "properties": properties}
        # Anonymous fields (e.g., "T,L,N")
        items_list = [
            _tytx_type_to_jsonschema(t.strip(), definitions, registry)
            for t in struct.split(",")
        ]
        return {"type": "array", "items": items_list, "minItems": len(items_list), "maxItems": len(items_list)}

    return {"type": "object"}


def struct_to_jsonschema(
    struct: dict[str, str] | list[str] | str,
    name: str | None = None,
    registry: TypeRegistry | None = None,
    include_definitions: bool = True,
) -> dict[str, Any]:
    """
    Convert TYTX struct to JSON Schema.

    Supports:
    - Dict structs → object with properties
    - List structs → array (positional or homogeneous)
    - String structs → object or array based on format
    - Nested @STRUCT references → $ref
    - Metadata → JSON Schema constraints

    Args:
        struct: TYTX struct definition (dict, list, or string)
        name: Optional name for the root schema
        registry: Optional TypeRegistry to look up nested struct definitions
        include_definitions: If True, include definitions for nested structs

    Returns:
        JSON Schema object.

    Example:
        >>> struct = {"id": "L", "name": "T[min:1]", "price": "N"}
        >>> struct_to_jsonschema(struct)
        {
            'type': 'object',
            'properties': {
                'id': {'type': 'integer'},
                'name': {'type': 'string', 'minLength': 1},
                'price': {'type': 'number', 'format': 'decimal'}
            }
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

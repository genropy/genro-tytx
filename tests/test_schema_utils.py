"""
Tests for JSON Schema / OpenAPI utilities.

Tests cover:
- struct_from_jsonschema: JSON Schema → TYTX struct conversion
- struct_to_jsonschema: TYTX struct → JSON Schema conversion
- Type mapping (basic types, date/time formats)
- Nested objects and arrays
- $ref resolution
- Metadata/constraint mapping
- Round-trip conversion
"""

import pytest

from genro_tytx import registry
from genro_tytx.schema_utils import struct_from_jsonschema, struct_to_jsonschema


class TestStructFromJsonschema:
    """Tests for struct_from_jsonschema()."""

    def test_basic_types(self):
        """Convert basic JSON Schema types to TYTX."""
        schema = {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "count": {"type": "number"},
                "active": {"type": "boolean"},
                "name": {"type": "string"},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct == {
            "id": "L",
            "count": "R",
            "active": "B",
            "name": "T",
        }

    def test_number_formats(self):
        """Convert number formats (decimal, float, double)."""
        schema = {
            "type": "object",
            "properties": {
                "price": {"type": "number", "format": "decimal"},
                "rate": {"type": "number", "format": "float"},
                "value": {"type": "number", "format": "double"},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["price"] == "N"
        assert struct["rate"] == "R"
        assert struct["value"] == "R"

    def test_string_date_formats(self):
        """Convert string formats (date, date-time, time)."""
        schema = {
            "type": "object",
            "properties": {
                "birth_date": {"type": "string", "format": "date"},
                "created_at": {"type": "string", "format": "date-time"},
                "start_time": {"type": "string", "format": "time"},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct == {
            "birth_date": "D",
            "created_at": "DHZ",  # DHZ is canonical for timezone-aware datetime
            "start_time": "H",
        }

    def test_string_other_formats(self):
        """String formats without special TYTX mapping stay as T."""
        schema = {
            "type": "object",
            "properties": {
                "email": {"type": "string", "format": "email"},
                "website": {"type": "string", "format": "uri"},
                "uuid": {"type": "string", "format": "uuid"},
            },
        }
        struct = struct_from_jsonschema(schema)
        # All map to T (text)
        assert struct["email"] == "T"
        assert struct["website"] == "T"
        assert struct["uuid"] == "T"

    def test_array_of_basic_type(self):
        """Convert array with basic item type."""
        schema = {
            "type": "object",
            "properties": {
                "tags": {"type": "array", "items": {"type": "string"}},
                "scores": {"type": "array", "items": {"type": "integer"}},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["tags"] == "#T"
        assert struct["scores"] == "#L"

    def test_nested_object(self):
        """Convert nested object to @STRUCT reference."""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "address": {
                    "type": "object",
                    "properties": {
                        "street": {"type": "string"},
                        "city": {"type": "string"},
                    },
                },
            },
        }
        struct = struct_from_jsonschema(schema, name="CUSTOMER")
        assert struct["name"] == "T"
        assert struct["address"] == "@CUSTOMER_ADDRESS"

    def test_nested_object_registered(self):
        """Nested structs are registered when registry provided."""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "address": {
                    "type": "object",
                    "properties": {
                        "street": {"type": "string"},
                        "city": {"type": "string"},
                    },
                },
            },
        }
        # Clear any previous registration
        try:
            registry.unregister_struct("TEST_ADDRESS")
        except KeyError:
            pass

        struct = struct_from_jsonschema(
            schema, name="TEST", registry=registry, register_nested=True
        )

        assert struct["address"] == "@TEST_ADDRESS"
        # Nested struct should be registered
        nested = registry.get_struct("TEST_ADDRESS")
        assert nested is not None
        assert nested["street"] == "T"
        assert nested["city"] == "T"

        # Cleanup
        registry.unregister_struct("TEST_ADDRESS")

    def test_array_of_objects(self):
        """Convert array of objects to #@STRUCT."""
        schema = {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "qty": {"type": "integer"},
                        },
                    },
                },
            },
        }
        struct = struct_from_jsonschema(schema, name="ORDER")
        assert struct["items"] == "#@ORDER_ITEMS"

    def test_ref_resolution(self):
        """Resolve $ref to definitions."""
        schema = {
            "type": "object",
            "properties": {
                "billing": {"$ref": "#/definitions/Address"},
                "shipping": {"$ref": "#/definitions/Address"},
            },
            "definitions": {
                "Address": {
                    "type": "object",
                    "properties": {
                        "street": {"type": "string"},
                        "city": {"type": "string"},
                    },
                }
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["billing"] == "@Address"
        assert struct["shipping"] == "@Address"

    def test_constraints_to_metadata(self):
        """Convert JSON Schema constraints to TYTX v2 FieldDef."""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 100},
                "code": {"type": "string", "pattern": "^[A-Z]{3}$"},
                "status": {"type": "string", "enum": ["active", "inactive"]},
                "age": {"type": "integer", "minimum": 0, "maximum": 150},
            },
        }
        struct = struct_from_jsonschema(schema)
        # v2 format: FieldDef with validate section
        assert struct["name"]["type"] == "T"
        assert struct["name"]["validate"]["min"] == 1
        assert struct["name"]["validate"]["max"] == 100
        assert struct["code"]["type"] == "T"
        assert struct["code"]["validate"]["pattern"] == "^[A-Z]{3}$"
        assert struct["status"]["type"] == "T"
        assert struct["status"]["validate"]["enum"] == ["active", "inactive"]
        assert struct["age"]["type"] == "L"
        assert struct["age"]["validate"]["min"] == 0
        assert struct["age"]["validate"]["max"] == 150

    def test_title_description_to_metadata(self):
        """Convert title/description to ui section."""
        schema = {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "title": "Customer Name",
                    "description": "Enter full name",
                },
            },
        }
        struct = struct_from_jsonschema(schema)
        # v2 format: FieldDef with ui section
        assert struct["name"]["type"] == "T"
        assert struct["name"]["ui"]["label"] == "Customer Name"
        assert struct["name"]["ui"]["hint"] == "Enter full name"

    def test_anyof_nullable(self):
        """Handle anyOf with null (Optional types)."""
        schema = {
            "type": "object",
            "properties": {
                "middle_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["middle_name"] == "T"

    def test_non_object_raises(self):
        """Raise error for non-object schema."""
        schema = {"type": "array", "items": {"type": "string"}}
        with pytest.raises(ValueError, match="must have type: 'object'"):
            struct_from_jsonschema(schema)


class TestStructToJsonschema:
    """Tests for struct_to_jsonschema()."""

    def test_basic_types(self):
        """Convert basic TYTX types to JSON Schema."""
        struct = {
            "id": "L",
            "count": "R",
            "active": "B",
            "name": "T",
        }
        schema = struct_to_jsonschema(struct)
        assert schema["type"] == "object"
        assert schema["properties"]["id"] == {"type": "integer"}
        assert schema["properties"]["count"] == {"type": "number"}
        assert schema["properties"]["active"] == {"type": "boolean"}
        assert schema["properties"]["name"] == {"type": "string"}

    def test_decimal_type(self):
        """Convert Decimal type with format."""
        struct = {"price": "N"}
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["price"] == {
            "type": "number",
            "format": "decimal",
        }

    def test_date_time_types(self):
        """Convert date/time types."""
        struct = {
            "birth_date": "D",
            "created_at": "DH",
            "created_tz": "DHZ",
            "start_time": "H",
        }
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["birth_date"] == {
            "type": "string",
            "format": "date",
        }
        assert schema["properties"]["created_at"] == {
            "type": "string",
            "format": "date-time",
        }
        assert schema["properties"]["created_tz"] == {
            "type": "string",
            "format": "date-time",
        }
        assert schema["properties"]["start_time"] == {
            "type": "string",
            "format": "time",
        }

    def test_array_type(self):
        """Convert array types."""
        struct = {
            "tags": "#T",
            "scores": "#L",
            "prices": "#N",
        }
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["tags"] == {
            "type": "array",
            "items": {"type": "string"},
        }
        assert schema["properties"]["scores"] == {
            "type": "array",
            "items": {"type": "integer"},
        }
        assert schema["properties"]["prices"] == {
            "type": "array",
            "items": {"type": "number", "format": "decimal"},
        }

    def test_struct_reference(self):
        """Convert @STRUCT references to $ref."""
        struct = {"address": "@ADDRESS"}
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["address"] == {"$ref": "#/definitions/ADDRESS"}

    def test_struct_reference_with_registry(self):
        """Resolve @STRUCT from registry and add definitions."""
        # Register a struct
        registry.register_struct("ADDR_TEST", {"street": "T", "city": "T"})

        struct = {"address": "@ADDR_TEST"}
        schema = struct_to_jsonschema(struct, registry=registry)

        assert schema["properties"]["address"] == {"$ref": "#/definitions/ADDR_TEST"}
        assert "definitions" in schema
        assert "ADDR_TEST" in schema["definitions"]
        assert schema["definitions"]["ADDR_TEST"]["properties"]["street"] == {"type": "string"}

        # Cleanup
        registry.unregister_struct("ADDR_TEST")

    def test_metadata_to_constraints(self):
        """Convert TYTX v2 FieldDef to JSON Schema constraints."""
        struct = {
            "name": {"type": "T", "validate": {"min": 1, "max": 100}},
            "code": {"type": "T", "validate": {"pattern": "^[A-Z]+$"}},
            "status": {"type": "T", "validate": {"enum": ["active", "inactive"]}},
        }
        schema = struct_to_jsonschema(struct)

        # v2 format: validate section converts to JSON Schema constraints
        name_prop = schema["properties"]["name"]
        assert name_prop.get("minLength") == 1
        assert name_prop.get("maxLength") == 100

        code_prop = schema["properties"]["code"]
        assert code_prop.get("pattern") == "^[A-Z]+$"

        status_prop = schema["properties"]["status"]
        assert status_prop.get("enum") == ["active", "inactive"]

    def test_list_struct_homogeneous(self):
        """Convert homogeneous list struct."""
        struct = ["N"]  # List of decimals
        schema = struct_to_jsonschema(struct)
        assert schema["type"] == "array"
        assert schema["items"] == {"type": "number", "format": "decimal"}

    def test_list_struct_positional(self):
        """Convert positional list struct."""
        struct = ["T", "L", "N"]  # [name, qty, price]
        schema = struct_to_jsonschema(struct)
        assert schema["type"] == "array"
        assert len(schema["items"]) == 3
        assert schema["minItems"] == 3
        assert schema["maxItems"] == 3

    def test_string_struct_named(self):
        """Convert named string struct."""
        struct = "name:T,qty:L,price:N"
        schema = struct_to_jsonschema(struct)
        assert schema["type"] == "object"
        assert "properties" in schema
        assert schema["properties"]["name"] == {"type": "string"}
        assert schema["properties"]["qty"] == {"type": "integer"}
        assert schema["properties"]["price"] == {"type": "number", "format": "decimal"}

    def test_string_struct_anonymous(self):
        """Convert anonymous string struct."""
        struct = "T,L,N"
        schema = struct_to_jsonschema(struct)
        assert schema["type"] == "array"
        assert len(schema["items"]) == 3

    def test_string_struct_mixed_named_anonymous(self):
        """String struct with mixed named and anonymous fields skips unnamed."""
        # Edge case: string has ":" but some fields don't have it
        struct = "name:T,L"  # "name:T" is named, "L" has no colon
        schema = struct_to_jsonschema(struct)
        # The "L" without colon will be skipped in the loop
        assert schema["type"] == "object"
        assert "name" in schema["properties"]
        # Only "name" is present, "L" is skipped

    def test_with_title(self):
        """Include title in schema."""
        struct = {"id": "L"}
        schema = struct_to_jsonschema(struct, name="Order")
        assert schema.get("title") == "Order"


class TestRoundTrip:
    """Test round-trip conversions."""

    def test_basic_roundtrip(self):
        """JSON Schema → TYTX → JSON Schema preserves types."""
        original = {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "string"},
                "price": {"type": "number", "format": "decimal"},
                "created": {"type": "string", "format": "date"},
            },
        }
        struct = struct_from_jsonschema(original)
        result = struct_to_jsonschema(struct)

        # Types should match
        assert result["properties"]["id"]["type"] == "integer"
        assert result["properties"]["name"]["type"] == "string"
        assert result["properties"]["price"]["type"] == "number"
        assert result["properties"]["price"]["format"] == "decimal"
        assert result["properties"]["created"]["type"] == "string"
        assert result["properties"]["created"]["format"] == "date"

    def test_tytx_roundtrip(self):
        """TYTX → JSON Schema → TYTX preserves types."""
        original = {
            "id": "L",
            "name": "T",
            "price": "N",
            "date": "D",
            "tags": "#T",
        }
        schema = struct_to_jsonschema(original)
        result = struct_from_jsonschema(schema)

        assert result["id"] == "L"
        assert result["name"] == "T"
        assert result["price"] == "N"
        assert result["date"] == "D"
        assert result["tags"] == "#T"


class TestRefResolution:
    """Tests for $ref resolution edge cases."""

    def test_ref_non_local_raises(self):
        """Non-local $ref raises ValueError."""
        schema = {
            "type": "object",
            "properties": {
                "ext": {"$ref": "https://example.com/schema.json#/Address"},
            },
        }
        with pytest.raises(ValueError, match="Only local \\$ref supported"):
            struct_from_jsonschema(schema)

    def test_ref_unresolvable_raises(self):
        """Unresolvable $ref raises ValueError."""
        schema = {
            "type": "object",
            "properties": {
                "missing": {"$ref": "#/definitions/NotFound"},
            },
            "definitions": {},
        }
        with pytest.raises(ValueError, match="Cannot resolve \\$ref"):
            struct_from_jsonschema(schema)

    def test_ref_to_non_object(self):
        """$ref to non-object type converts directly."""
        schema = {
            "type": "object",
            "properties": {
                "amount": {"$ref": "#/definitions/Money"},
            },
            "definitions": {
                "Money": {"type": "number", "format": "decimal"},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["amount"] == "N"

    def test_ref_required_field(self):
        """Required $ref field gets required flag."""
        schema = {
            "type": "object",
            "properties": {
                "address": {"$ref": "#/definitions/Address"},
            },
            "definitions": {
                "Address": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                },
            },
            "required": ["address"],
        }
        struct = struct_from_jsonschema(schema)
        assert struct["address"]["type"] == "@Address"
        assert struct["address"]["validate"]["required"] is True


class TestOneOfAnyOf:
    """Tests for oneOf/anyOf handling."""

    def test_oneof_takes_first(self):
        """oneOf takes first option."""
        schema = {
            "type": "object",
            "properties": {
                "value": {
                    "oneOf": [
                        {"type": "integer"},
                        {"type": "string"},
                    ]
                },
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["value"] == "L"  # First option is integer

    def test_anyof_all_null(self):
        """anyOf with only null types defaults to string."""
        schema = {
            "type": "object",
            "properties": {
                "empty": {
                    "anyOf": [{"type": "null"}]
                },
            },
        }
        struct = struct_from_jsonschema(schema)
        # When all are null, falls through to default "T"
        assert struct["empty"] == "T"


class TestRequiredFields:
    """Tests for required field handling."""

    def test_array_required(self):
        """Required array field gets required flag."""
        schema = {
            "type": "object",
            "properties": {
                "items": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["items"],
        }
        struct = struct_from_jsonschema(schema)
        assert struct["items"]["type"] == "#T"
        assert struct["items"]["validate"]["required"] is True

    def test_nested_object_required(self):
        """Required nested object gets required flag."""
        schema = {
            "type": "object",
            "properties": {
                "address": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                },
            },
            "required": ["address"],
        }
        struct = struct_from_jsonschema(schema, name="PERSON")
        assert struct["address"]["type"] == "@PERSON_ADDRESS"
        assert struct["address"]["validate"]["required"] is True


class TestExclusiveConstraints:
    """Tests for exclusive min/max constraints."""

    def test_exclusive_minimum(self):
        """exclusiveMinimum converts to minExclusive."""
        schema = {
            "type": "object",
            "properties": {
                "price": {"type": "number", "exclusiveMinimum": 0},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["price"]["type"] == "R"
        assert struct["price"]["validate"]["min"] == 0
        assert struct["price"]["validate"]["minExclusive"] is True

    def test_exclusive_maximum(self):
        """exclusiveMaximum converts to maxExclusive."""
        schema = {
            "type": "object",
            "properties": {
                "discount": {"type": "number", "exclusiveMaximum": 100},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["discount"]["type"] == "R"
        assert struct["discount"]["validate"]["max"] == 100
        assert struct["discount"]["validate"]["maxExclusive"] is True


class TestDefaultValues:
    """Tests for default value handling."""

    def test_default_value_from_jsonschema(self):
        """Default value from JSON Schema."""
        schema = {
            "type": "object",
            "properties": {
                "status": {"type": "string", "default": "pending"},
                "count": {"type": "integer", "default": 0},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["status"]["validate"]["default"] == "pending"
        assert struct["count"]["validate"]["default"] == 0

    def test_default_value_to_jsonschema(self):
        """Default value to JSON Schema."""
        struct = {
            "status": {"type": "T", "validate": {"default": "active"}},
        }
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["status"]["default"] == "active"


class TestTytxToJsonSchemaConstraints:
    """Tests for TYTX → JSON Schema constraint conversion."""

    def test_numeric_min_max(self):
        """Numeric min/max become minimum/maximum."""
        struct = {
            "age": {"type": "L", "validate": {"min": 0, "max": 150}},
        }
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["age"]["minimum"] == 0
        assert schema["properties"]["age"]["maximum"] == 150

    def test_length_constraint(self):
        """length constraint becomes minLength + maxLength."""
        struct = {
            "code": {"type": "T", "validate": {"length": 5}},
        }
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["code"]["minLength"] == 5
        assert schema["properties"]["code"]["maxLength"] == 5

    def test_required_field_in_output(self):
        """Required fields appear in JSON Schema required array."""
        struct = {
            "name": {"type": "T", "validate": {"required": True}},
            "note": "T",
        }
        schema = struct_to_jsonschema(struct)
        assert "required" in schema
        assert "name" in schema["required"]
        assert "note" not in schema["required"]

    def test_ui_to_title_description(self):
        """UI hints become title/description."""
        struct = {
            "email": {
                "type": "T",
                "ui": {"label": "Email Address", "hint": "Your email"},
            },
        }
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["email"]["title"] == "Email Address"
        assert schema["properties"]["email"]["description"] == "Your email"


class TestUnknownTypeCodes:
    """Tests for unknown type code handling."""

    def test_unknown_tytx_code_defaults_to_string(self):
        """Unknown TYTX code defaults to string."""
        struct = {"custom": "UNKNOWN_CODE"}
        schema = struct_to_jsonschema(struct)
        assert schema["properties"]["custom"] == {"type": "string"}

    def test_struct_reference_not_in_registry(self):
        """@STRUCT not in registry still produces $ref."""
        struct = {"data": "@MISSING_STRUCT"}
        schema = struct_to_jsonschema(struct, registry=registry)
        # Should still produce $ref even if not found in registry
        assert schema["properties"]["data"] == {"$ref": "#/definitions/MISSING_STRUCT"}


class TestFallbackBehavior:
    """Tests for fallback behavior in edge cases."""

    def test_type_with_unknown_format_fallback(self):
        """Type with unknown format falls back to base type."""
        schema = {
            "type": "object",
            "properties": {
                "custom": {"type": "string", "format": "custom-format-xyz"},
            },
        }
        struct = struct_from_jsonschema(schema)
        # Falls back to string (T) since custom-format-xyz is unknown
        assert struct["custom"] == "T"

    def test_required_basic_field(self):
        """Required basic field (no other constraints) gets required flag."""
        schema = {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
            },
            "required": ["id"],
        }
        struct = struct_from_jsonschema(schema)
        # Should have required flag
        assert struct["id"]["type"] == "L"
        assert struct["id"]["validate"]["required"] is True


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_properties(self):
        """Handle schema with no properties."""
        schema = {"type": "object", "properties": {}}
        struct = struct_from_jsonschema(schema)
        assert struct == {}

    def test_unknown_type(self):
        """Unknown types default to string."""
        schema = {
            "type": "object",
            "properties": {
                "unknown": {"type": "unknown_type"},
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["unknown"] == "T"

    def test_deeply_nested(self):
        """Handle deeply nested structures."""
        schema = {
            "type": "object",
            "properties": {
                "level1": {
                    "type": "object",
                    "properties": {
                        "level2": {
                            "type": "object",
                            "properties": {
                                "value": {"type": "integer"},
                            },
                        },
                    },
                },
            },
        }
        struct = struct_from_jsonschema(schema, name="DEEP")
        assert struct["level1"] == "@DEEP_LEVEL1"

    def test_array_of_arrays(self):
        """Handle nested arrays."""
        schema = {
            "type": "object",
            "properties": {
                "matrix": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "integer"},
                    },
                },
            },
        }
        struct = struct_from_jsonschema(schema)
        assert struct["matrix"] == "##L"

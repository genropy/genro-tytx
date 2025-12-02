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
XTYTX envelope processing for TYTX Protocol.

This module provides transport-agnostic logic for processing XTYTX envelopes.
XTYTX is the extended envelope format that includes:
- gstruct: Global TYTX struct definitions (registered globally) - for type hydration
- lstruct: Local TYTX struct definitions (document-specific) - for type hydration
- gschema: Global JSON Schema definitions (registered globally) - for validation
- lschema: Local JSON Schema definitions (document-specific) - for validation
- data: The actual TYTX payload

TYTX is a transport format, not a validator. Validation is delegated to JSON Schema.

This module is used by both json_utils.py and msgpack_utils.py to ensure
consistent behavior across different transport formats.

Usage:
    from genro_tytx.xtytx import XtytxResult, process_envelope

    # Process an XTYTX envelope (dict already parsed from JSON/MessagePack)
    result = process_envelope(envelope_dict)

    # Access the data
    data = result.data

    # Use JSON Schemas for validation (client-side)
    schema = result.global_schemas.get("CUSTOMER")
    # Use jsonschema library: jsonschema.validate(data, schema)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .registry import registry

# JSON Schema type alias
JsonSchema = dict[str, Any]


class SchemaRegistry:
    """
    Registry for JSON Schema definitions.

    JSON Schemas are used for client-side validation. TYTX core does not
    perform validation - it only handles type hydration.
    """

    def __init__(self) -> None:
        self._schemas: dict[str, JsonSchema] = {}

    def register(self, name: str, schema: JsonSchema) -> None:
        """
        Register a JSON Schema by name.

        Args:
            name: Schema name (typically matches struct code, e.g., 'CUSTOMER')
            schema: JSON Schema dict
        """
        self._schemas[name] = schema

    def unregister(self, name: str) -> None:
        """Remove a schema by name."""
        self._schemas.pop(name, None)

    def get(self, name: str) -> JsonSchema | None:
        """Get schema by name."""
        return self._schemas.get(name)

    def list_schemas(self) -> list[str]:
        """Return list of all registered schema names."""
        return list(self._schemas.keys())


# Global schema registry instance
schema_registry = SchemaRegistry()


@dataclass
class XtytxResult:
    """
    Result of processing an XTYTX envelope.

    Attributes:
        data: The hydrated data from the envelope (or None if empty)
        global_schemas: gschema entries from envelope (already registered globally)
        local_schemas: lschema entries from envelope (for document-specific use)
    """

    data: Any
    global_schemas: dict[str, JsonSchema] | None = None
    local_schemas: dict[str, JsonSchema] | None = None


def process_envelope(
    envelope: dict[str, Any],
    hydrate_func: Any,
    tytx_prefix: str = "TYTX://",
) -> XtytxResult:
    """
    Process XTYTX envelope (transport-agnostic).

    Processing steps:
    1. Register gschema entries globally (overwrites existing)
    2. Register gstruct entries globally (overwrites existing)
    3. Build local_structs context from lstruct
    4. Build local_schemas context from lschema
    5. Decode data using hydrate_func with local struct contexts
    6. Return XtytxResult with data and schema contexts

    Args:
        envelope: Parsed XTYTX envelope dict with gstruct, lstruct,
            gschema, lschema, data fields.
        hydrate_func: Function to hydrate parsed data. Signature:
            hydrate_func(parsed_data, local_structs=None) -> hydrated_data
        tytx_prefix: Prefix to strip from data field (default "TYTX://")

    Returns:
        XtytxResult with hydrated data and schema contexts.

    Raises:
        KeyError: If required struct fields (gstruct, lstruct, data) are missing.
    """
    # Required fields
    gstruct = envelope["gstruct"]
    lstruct = envelope["lstruct"]
    data = envelope["data"]

    # Optional JSON Schema fields
    gschema: dict[str, JsonSchema] | None = envelope.get("gschema")
    lschema: dict[str, JsonSchema] | None = envelope.get("lschema")

    # Register gschema entries globally (overwrites existing)
    if gschema:
        for name, schema in gschema.items():
            schema_registry.register(name, schema)

    # Register gstruct entries globally (overwrites existing)
    for code, schema in gstruct.items():
        registry.register_struct(code, schema)

    # If data is empty, return None with schema contexts
    if not data:
        return XtytxResult(
            data=None,
            global_schemas=gschema,
            local_schemas=lschema,
        )

    # Strip TYTX:// prefix from data if present (for string data)
    if isinstance(data, str) and data.startswith(tytx_prefix):
        data = data[len(tytx_prefix) :]

    # Hydrate data with lstruct as local context
    local_structs = lstruct if lstruct else None
    hydrated = hydrate_func(data, local_structs=local_structs)

    return XtytxResult(
        data=hydrated,
        global_schemas=gschema,
        local_schemas=lschema,
    )


__all__ = [
    "JsonSchema",
    "SchemaRegistry",
    "XtytxResult",
    "process_envelope",
    "schema_registry",
]

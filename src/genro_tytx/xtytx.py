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
- gstruct: Global struct definitions (registered globally)
- lstruct: Local struct definitions (document-specific)
- gvalidation: Global validation definitions (registered globally)
- lvalidation: Local validation definitions (document-specific)
- data: The actual TYTX payload

This module is used by both json_utils.py and msgpack_utils.py to ensure
consistent behavior across different transport formats.

Usage:
    from genro_tytx.xtytx import XtytxResult, process_envelope

    # Process an XTYTX envelope (dict already parsed from JSON/MessagePack)
    result = process_envelope(envelope_dict)

    # Access the data
    data = result.data

    # Use validations for later validation
    validation_registry.validate(
        value,
        "my_validation",
        local_validations=result.local_validations,
        global_validations=result.global_validations,
    )
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from .registry import registry
from .struct import validation_registry

if TYPE_CHECKING:
    from .struct import ValidationDef


@dataclass
class XtytxResult:
    """
    Result of processing an XTYTX envelope.

    Attributes:
        data: The hydrated data from the envelope (or None if empty)
        global_validations: gvalidation entries from envelope (already registered globally)
        local_validations: lvalidation entries from envelope (for document-specific use)
    """

    data: Any
    global_validations: dict[str, ValidationDef] | None = None
    local_validations: dict[str, ValidationDef] | None = None


def process_envelope(
    envelope: dict[str, Any],
    hydrate_func: Any,
    tytx_prefix: str = "TYTX://",
) -> XtytxResult:
    """
    Process XTYTX envelope (transport-agnostic).

    Processing steps:
    1. Register gstruct entries globally (overwrites existing)
    2. Register gvalidation entries globally (overwrites existing)
    3. Build local_structs context from lstruct
    4. Build local_validations context from lvalidation
    5. Decode data using hydrate_func with local contexts
    6. Return XtytxResult with data and validation contexts

    Args:
        envelope: Parsed XTYTX envelope dict with gstruct, lstruct,
            gvalidation, lvalidation, data fields.
        hydrate_func: Function to hydrate parsed data. Signature:
            hydrate_func(parsed_data, local_structs=None) -> hydrated_data
        tytx_prefix: Prefix to strip from data field (default "TYTX://")

    Returns:
        XtytxResult with hydrated data and validation contexts.

    Raises:
        KeyError: If required struct fields (gstruct, lstruct, data) are missing.
    """
    # Required fields
    gstruct = envelope["gstruct"]
    lstruct = envelope["lstruct"]
    data = envelope["data"]

    # Optional validation fields
    gvalidation: dict[str, ValidationDef] | None = envelope.get("gvalidation")
    lvalidation: dict[str, ValidationDef] | None = envelope.get("lvalidation")

    # Register gstruct entries globally (overwrites existing)
    for code, schema in gstruct.items():
        registry.register_struct(code, schema)

    # Register gvalidation entries globally (overwrites existing)
    if gvalidation:
        for name, definition in gvalidation.items():
            validation_registry.register(name, definition)

    # If data is empty, return None with validation contexts
    if not data:
        return XtytxResult(
            data=None,
            global_validations=gvalidation,
            local_validations=lvalidation,
        )

    # Strip TYTX:// prefix from data if present (for string data)
    if isinstance(data, str) and data.startswith(tytx_prefix):
        data = data[len(tytx_prefix) :]

    # Hydrate data with lstruct as local context
    local_structs = lstruct if lstruct else None
    hydrated = hydrate_func(data, local_structs=local_structs)

    return XtytxResult(
        data=hydrated,
        global_validations=gvalidation,
        local_validations=lvalidation,
    )


__all__ = [
    "XtytxResult",
    "process_envelope",
]

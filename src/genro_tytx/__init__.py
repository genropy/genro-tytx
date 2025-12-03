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
TYTX (Typed Text) - A protocol for exchanging typed data over text-based formats.

Public API:
    # Text conversion
    from_text("100::N")       → Decimal("100")
    from_text("[1,2,3]::L")   → [1, 2, 3]  # typed arrays
    as_text(Decimal("100"))   → "100"
    as_typed_text(Decimal("100")) → "100::N"
    as_typed_text([1,2,3], compact_array=True) → '["1","2","3"]::L'

    # JSON conversion
    as_json(data)             → standard JSON (for external systems)
    as_typed_json(data)       → JSON with ::type (TYTX format)
    from_json(json_str)       → dict with hydrated values

    # XML conversion
    as_xml(data)              → standard XML (for external systems)
    as_typed_xml(data)        → XML with ::type (TYTX format)
    from_xml(xml_str)         → dict with attrs/value structure

Type codes:
    L  - int (long)           DHZ - datetime (timezone-aware, canonical)
    R  - float (real)         DH  - datetime (naive, deprecated)
    N  - Decimal (numeric)    H   - time
    B  - bool                 D   - date
    T  - str (text)           JS  - JSON object
"""

from .base import DataType
from .builtin import (
    BoolType,
    DateTimeType,
    DateType,
    DecimalType,
    FloatType,
    IntType,
    JsonType,
    NaiveDateTimeType,
    NoneType,
    StrType,
    TimeType,
)
from .extension import ExtensionType
from .http_async_utils import (
    fetch_typed_async,
    fetch_typed_request_async,
    fetch_xtytx_async,
)
from .http_utils import (
    build_xtytx_envelope,
    fetch_typed,
    fetch_typed_request,
    fetch_xtytx,
)
from .json_utils import (
    TYTX_PREFIX,
    XTYTX_PREFIX,
    as_json,
    as_typed_json,
    detect_tytx_mode,
    from_json,
    hydrate_dict,
    is_tytx_payload,
)
from .middleware.asgi import TytxASGIMiddleware
from .middleware.wsgi import TytxWSGIMiddleware
from .registry import TypeRegistry, registry
from .schema_utils import struct_from_jsonschema, struct_to_jsonschema
from .struct import (
    FieldDef,
    FieldUI,
    FieldValidate,
    FieldValue,
    StructType,
    get_field_type,
    get_field_ui,
    get_field_validate,
)
from .utils import (
    model_to_schema,
    python_type_to_tytx_code,
    schema_to_model,
    tytx_code_to_python_type,
)
from .xml_utils import (
    as_typed_xml,
    as_xml,
    from_xml,
)
from .xtytx import (
    JsonSchema,
    SchemaRegistry,
    XtytxResult,
    process_envelope,
    schema_registry,
)

# Public API functions
from_text = registry.from_text
as_text = registry.as_text
as_typed_text = registry.as_typed_text

__version__ = "0.5.0"
__all__ = [
    "__version__",
    # Protocol constants
    "TYTX_PREFIX",
    "XTYTX_PREFIX",
    # Text API
    "from_text",
    "as_text",
    "as_typed_text",
    # JSON API
    "as_json",
    "as_typed_json",
    "from_json",
    "hydrate_dict",
    # Detection helpers
    "is_tytx_payload",
    "detect_tytx_mode",
    # HTTP helpers
    "fetch_typed",
    "fetch_typed_request",
    "fetch_xtytx",
    "build_xtytx_envelope",
    "fetch_typed_async",
    "fetch_typed_request_async",
    "fetch_xtytx_async",
    # XML API
    "as_xml",
    "as_typed_xml",
    "from_xml",
    # Registry
    "registry",
    "TypeRegistry",
    "DataType",
    # Struct & Extension types
    "StructType",
    "ExtensionType",
    # JSON Schema Registry (for validation)
    "JsonSchema",
    "SchemaRegistry",
    "schema_registry",
    # Struct v2 field types
    "FieldDef",
    "FieldUI",
    "FieldValidate",
    "FieldValue",
    "get_field_type",
    "get_field_ui",
    "get_field_validate",
    # XTYTX envelope
    "XtytxResult",
    "process_envelope",
    # JSON Schema utilities
    "struct_from_jsonschema",
    "struct_to_jsonschema",
    # Pydantic utilities
    "model_to_schema",
    "schema_to_model",
    "python_type_to_tytx_code",
    "tytx_code_to_python_type",
    # Type classes
    "BoolType",
    "DateTimeType",
    "DateType",
    "DecimalType",
    "FloatType",
    "IntType",
    "JsonType",
    "NaiveDateTimeType",
    "NoneType",
    "StrType",
    "TimeType",
    # Middleware
    "TytxASGIMiddleware",
    "TytxWSGIMiddleware",
]

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
    from_text("100::D")       → Decimal("100")
    as_text(Decimal("100"))   → "100"
    as_typed_text(Decimal("100")) → "100::D"

    # JSON conversion
    as_json(data)             → standard JSON (for external systems)
    as_typed_json(data)       → JSON with ::type (TYTX format)
    from_json(json_str)       → dict with hydrated values

    # XML conversion
    as_xml(data)              → standard XML (for external systems)
    as_typed_xml(data)        → XML with ::type (TYTX format)
    from_xml(xml_str)         → dict with attrs/value structure
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
    StrType,
    TimeType,
)
from .json_utils import (
    as_json,
    as_typed_json,
    from_json,
)
from .registry import TypeRegistry, registry
from .xml_utils import (
    as_typed_xml,
    as_xml,
    from_xml,
)

# Public API functions
from_text = registry.from_text
as_text = registry.as_text
as_typed_text = registry.as_typed_text

__version__ = "0.2.0"
__all__ = [
    "__version__",
    # Text API
    "from_text",
    "as_text",
    "as_typed_text",
    # JSON API
    "as_json",
    "as_typed_json",
    "from_json",
    # XML API
    "as_xml",
    "as_typed_xml",
    "from_xml",
    # Registry
    "registry",
    "TypeRegistry",
    "DataType",
    # Type classes
    "BoolType",
    "DateTimeType",
    "DateType",
    "DecimalType",
    "FloatType",
    "IntType",
    "JsonType",
    "StrType",
    "TimeType",
]

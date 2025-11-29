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
    ListType,
    StrType,
)
from .registry import TypeRegistry, registry

# Helper functions (public API)
parse = registry.parse
serialize = registry.serialize

__version__ = "0.1.0"
__all__ = [
    "__version__",
    "parse",
    "serialize",
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
    "ListType",
    "StrType",
]

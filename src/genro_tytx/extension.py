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
Extension types for TYTX.

This module provides _ExtensionType for custom user-defined types
registered via register_class().

Extension types use the ~ prefix (e.g., ::~UUID, ::~INV).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

# Symbol prefix for custom extension types (tilde = eXtension)
CUSTOM_PREFIX = "~"

# Legacy prefixes for backwards compatibility
X_PREFIX = "X_"
Y_PREFIX = "Y_"
Z_PREFIX = "Z_"


class ExtensionType:
    """
    Wrapper for custom extension types registered via register_class.

    Extension types allow users to define their own serialization/parsing
    for custom Python classes.

    Example:
        class Invoice:
            def __init__(self, number: str, amount: Decimal):
                self.number = number
                self.amount = amount

            def as_typed_text(self) -> str:
                return f"{self.number}|{self.amount}"

            @staticmethod
            def from_typed_text(s: str) -> "Invoice":
                number, amount = s.split("|")
                return Invoice(number, Decimal(amount))

        registry.register_class("INV", Invoice)
        # Now "INV001|100.50::~INV" works
    """

    def __init__(
        self,
        code: str,
        cls: type | None,
        serialize: Callable[[Any], str],
        parse: Callable[[str], Any],
    ) -> None:
        self.code = f"{CUSTOM_PREFIX}{code}"
        self.name = f"custom_{code.lower()}"
        self.cls = cls
        self._serialize = serialize
        self._parse = parse
        # For compatibility with DataType interface
        self.python_type = cls

    def parse(self, value: str) -> Any:
        """Parse string to Python value."""
        return self._parse(value)

    def serialize(self, value: Any) -> str:
        """Serialize Python value to string."""
        return self._serialize(value)


# For backwards compatibility
_ExtensionType = ExtensionType

__all__ = [
    "CUSTOM_PREFIX",
    "ExtensionType",
    "X_PREFIX",
    "Y_PREFIX",
    "Z_PREFIX",
    "_ExtensionType",
]

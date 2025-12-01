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
Pydantic integration for TYTX.

This module provides a TytxModel base class that automatically serializes
to/from TYTX-typed JSON and MessagePack, preserving Decimal precision and date types.

Usage:
    pip install genro-tytx[pydantic]

    from decimal import Decimal
    from datetime import date
    from genro_tytx.pydantic import TytxModel

    class Order(TytxModel):
        price: Decimal
        date: date

    order = Order(price=Decimal("99.99"), date=date(2025, 1, 15))

    # Serialize to TYTX JSON (preserves types)
    json_str = order.model_dump_json()
    # '{"price": "99.99::N", "date": "2025-01-15::D"}'

    # Deserialize from TYTX JSON
    restored = Order.model_validate_tytx(json_str)
    # restored.price is Decimal("99.99"), not float!

    # MessagePack support (requires: pip install genro-tytx[msgpack])
    packed = order.model_dump_msgpack()
    restored = Order.model_validate_tytx_msgpack(packed)
"""

from __future__ import annotations

from typing import Any, TypeVar

# Lazy import check
_pydantic_available: bool | None = None


def _check_pydantic() -> None:
    """Check if pydantic is available, raise ImportError if not."""
    global _pydantic_available
    if _pydantic_available is None:
        try:
            import pydantic  # noqa: F401

            _pydantic_available = True
        except ImportError:
            _pydantic_available = False

    if not _pydantic_available:
        raise ImportError(
            "pydantic is required for TytxModel. Install it with: pip install genro-tytx[pydantic]"
        )


def _hydrate_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively hydrate typed values in a dict."""
    from .registry import registry

    result: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, dict):
            result[k] = _hydrate_dict(v)
        elif isinstance(v, list):
            result[k] = _hydrate_list(v)
        elif isinstance(v, str):
            result[k] = registry.from_text(v)
        else:
            result[k] = v
    return result


def _hydrate_list(data: list[Any]) -> list[Any]:
    """Recursively hydrate typed values in a list."""
    from .registry import registry

    result: list[Any] = []
    for item in data:
        if isinstance(item, dict):
            result.append(_hydrate_dict(item))
        elif isinstance(item, list):
            result.append(_hydrate_list(item))
        elif isinstance(item, str):
            result.append(registry.from_text(item))
        else:
            result.append(item)
    return result


def _get_tytx_model_class() -> type:
    """Get TytxModel class with lazy pydantic import."""
    _check_pydantic()

    from pydantic import BaseModel

    from .json_utils import as_typed_json, from_json

    _T = TypeVar("_T", bound="TytxModel")

    class TytxModel(BaseModel):
        """
        Pydantic BaseModel with automatic TYTX serialization.

        Features:
        - model_dump_json() returns TYTX-typed JSON (e.g., "99.99::N")
        - model_validate_tytx() accepts TYTX JSON or typed dicts
        - Preserves Decimal precision (no float conversion!)
        - Preserves date/datetime types

        Example:
            class Invoice(TytxModel):
                total: Decimal
                due_date: date

            inv = Invoice(total=Decimal("1234.56"), due_date=date(2025, 1, 15))
            json_str = inv.model_dump_json()
            # '{"total": "1234.56::N", "due_date": "2025-01-15::D"}'
        """

        def model_dump_json(
            self,
            *,
            indent: int | None = None,
            **kwargs: Any,
        ) -> str:
            """
            Serialize to TYTX-typed JSON string.

            All Decimal values become "value::N", dates become "value::D", etc.
            This preserves type information for round-trip serialization.

            Accepts all standard pydantic model_dump_json kwargs.
            """
            # Use mode="python" to preserve Decimal/date types
            # mode="json" would convert them to float/str before we can tag them
            data = self.model_dump(mode="python", **kwargs)
            return as_typed_json(data, indent=indent)

        @classmethod
        def model_validate_tytx(
            cls: type[_T],
            data: str | bytes | bytearray | dict[str, Any],
            *,
            strict: bool | None = None,
            context: Any = None,
        ) -> _T:
            """
            Validate from TYTX-typed JSON or dict.

            Accepts:
            - JSON string with TYTX types: '{"price": "99.99::N"}'
            - Dict with TYTX-typed values: {"price": "99.99::N"}
            - Regular dict (falls back to standard validation)

            Returns:
                Validated model instance with proper Python types.
            """
            if isinstance(data, (str, bytes, bytearray)):
                # Parse JSON and hydrate types
                json_str = (
                    data.decode() if isinstance(data, (bytes, bytearray)) else data
                )
                result = from_json(json_str)
                # Handle XtytxResult (extract data) or plain dict
                from .xtytx import XtytxResult

                data = result.data if isinstance(result, XtytxResult) else result
            elif isinstance(data, dict):
                # Hydrate typed values in dict
                data = _hydrate_dict(data)

            return cls.model_validate(data, strict=strict, context=context)

        def model_dump_msgpack(self, **kwargs: Any) -> bytes:
            """
            Serialize to TYTX-typed MessagePack bytes.

            Requires msgpack: pip install genro-tytx[msgpack]

            All Decimal values, dates, etc. are preserved using TYTX ExtType(42).

            Args:
                **kwargs: Additional arguments passed to model_dump().

            Returns:
                MessagePack bytes with TYTX types preserved.

            Raises:
                ImportError: If msgpack is not installed.
            """
            from .msgpack_utils import packb

            data = self.model_dump(mode="python", **kwargs)
            return packb(data)

        @classmethod
        def model_validate_tytx_msgpack(
            cls: type[_T],
            data: bytes,
            *,
            strict: bool | None = None,
            context: Any = None,
        ) -> _T:
            """
            Validate from TYTX-typed MessagePack bytes.

            Requires msgpack: pip install genro-tytx[msgpack]

            Args:
                data: MessagePack bytes with TYTX types.
                strict: Whether to enforce strict validation.
                context: Optional context for validation.

            Returns:
                Validated model instance with proper Python types.

            Raises:
                ImportError: If msgpack is not installed.
            """
            from .msgpack_utils import unpackb

            unpacked = unpackb(data)
            return cls.model_validate(unpacked, strict=strict, context=context)

    return TytxModel


# Lazy class accessor - ruff F822 requires we define the name
# We use __getattr__ for lazy loading but must declare TytxModel for __all__
def __getattr__(name: str) -> Any:
    """Lazy import for TytxModel."""
    if name == "TytxModel":
        return _get_tytx_model_class()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    """Include TytxModel in dir() output."""
    return ["TytxModel"]


# Note: TytxModel is lazily loaded via __getattr__
# ruff: noqa: F822
__all__ = ["TytxModel"]

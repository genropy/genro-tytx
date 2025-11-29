from typing import Any

from .base import DataType


class TypeRegistry:
    """
    Registry for pluggable data types.
    """

    def __init__(self) -> None:
        self._types: dict[str, type[DataType]] = {}
        self._codes: dict[str, type[DataType]] = {}
        self._aliases: dict[str, type[DataType]] = {}

    def register(self, type_cls: type[DataType]) -> None:
        """
        Register a new data type.
        """
        self._types[type_cls.name] = type_cls
        self._codes[type_cls.code] = type_cls
        for alias in type_cls.aliases:
            self._aliases[alias] = type_cls

    def get(self, name_or_code: str) -> type[DataType] | None:
        """
        Retrieve a type by name, code, or alias.
        """
        if name_or_code in self._types:
            return self._types[name_or_code]
        if name_or_code in self._codes:
            return self._codes[name_or_code]
        if name_or_code in self._aliases:
            return self._aliases[name_or_code]
        return None

    def parse(self, value_string: str) -> Any:
        """
        Parses `value::type` strings using registered types.
        If no type separator is found, returns the string as-is.
        """
        if "::" not in value_string:
            return value_string

        # Split only on the last occurrence to handle values containing '::'
        val_part, type_part = value_string.rsplit("::", 1)

        type_cls = self.get(type_part)
        if type_cls:
            return type_cls().parse(val_part)

        return value_string

    def _serialize_with_type(self, value: Any, code: str) -> str:
        """Helper to serialize value with a type code."""
        type_cls = self.get(code)
        if type_cls is None:
            return str(value)
        return type_cls().serialize(value) + "::" + code

    def serialize(self, value: Any) -> str:
        """
        Serialize a Python object to a `value::type` string.
        """
        # Import here to avoid circular imports
        from datetime import date, datetime
        from decimal import Decimal

        # Check built-in types first (optimization)
        # Note: bool must be checked before int (bool is subclass of int)
        if isinstance(value, bool):
            return self._serialize_with_type(value, "B")
        if isinstance(value, int):
            return self._serialize_with_type(value, "I")
        if isinstance(value, float):
            return self._serialize_with_type(value, "F")
        if isinstance(value, str):
            # Already typed or plain string - return as-is
            return value
        if isinstance(value, Decimal):
            return self._serialize_with_type(value, "D")
        if isinstance(value, datetime):
            return self._serialize_with_type(value, "dt")
        if isinstance(value, date):
            return self._serialize_with_type(value, "d")
        if isinstance(value, (dict, list)):
            return self._serialize_with_type(value, "J")

        return str(value)


# Global registry instance
registry = TypeRegistry()

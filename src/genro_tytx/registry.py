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
        self._python_types: dict[type, type[DataType]] = {}

    def register(self, type_cls: type[DataType]) -> None:
        """
        Register a new data type.
        """
        self._types[type_cls.name] = type_cls
        self._codes[type_cls.code] = type_cls
        for alias in type_cls.aliases:
            self._aliases[alias] = type_cls
        # Register python_type if available
        if hasattr(type_cls, "python_type") and type_cls.python_type is not None:
            self._python_types[type_cls.python_type] = type_cls

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

    def get_for_value(self, value: Any) -> type[DataType] | None:
        """
        Get the type class for a Python value.
        """
        return self._python_types.get(type(value))

    def is_typed(self, text: str) -> bool:
        """
        Check if a string contains a TYTX type suffix.
        """
        if "::" not in text:
            return False
        _, type_part = text.rsplit("::", 1)
        return self.get(type_part) is not None

    def fromText(self, text: str, type_code: str | None = None) -> Any:
        """
        Parse a string to a Python value.

        Args:
            text: The string to parse. May contain embedded type (value::type).
            type_code: Optional explicit type code. If provided, uses this type.

        Returns:
            Parsed Python value, or original string if no type found.
        """
        # If explicit type provided, use it
        if type_code is not None:
            type_cls = self.get(type_code)
            if type_cls:
                return type_cls().parse(text)
            return text

        # Check for embedded type
        if "::" not in text:
            return text

        # Split only on the last occurrence to handle values containing '::'
        val_part, type_part = text.rsplit("::", 1)

        type_cls = self.get(type_part)
        if type_cls:
            return type_cls().parse(val_part)

        return text

    def _get_type_code_for_value(self, value: Any) -> str | None:
        """Get the type code for a Python value."""
        # Import here to avoid circular imports
        from datetime import date, datetime
        from decimal import Decimal

        # Check built-in types (order matters: bool before int)
        if isinstance(value, bool):
            return "B"
        if isinstance(value, int):
            return "I"
        if isinstance(value, float):
            return "F"
        if isinstance(value, Decimal):
            return "D"
        if isinstance(value, datetime):
            return "dt"
        if isinstance(value, date):
            return "d"
        if isinstance(value, (dict, list)):
            return "J"
        if isinstance(value, str):
            return None  # Strings don't get typed
        return None

    def asText(
        self,
        value: Any,
        format: str | bool | None = None,  # noqa: A002
        locale: str | None = None,
    ) -> str:
        """
        Serialize a Python object to a string (without type suffix).

        Args:
            value: Python value to serialize.
            format: Controls output format:
                - None: ISO/technical output (default)
                - True: use type's default format with locale
                - str: use specific format string with locale
            locale: Locale string (e.g., "it-IT"). If None and format is provided,
                uses system locale.

        Returns:
            String representation of value.
        """
        if isinstance(value, str):
            return value

        code = self._get_type_code_for_value(value)
        if code:
            type_cls = self.get(code)
            if type_cls:
                if format is not None:
                    return type_cls().format(value, format, locale)
                return type_cls().serialize(value)

        return str(value)

    def asTypedText(self, value: Any) -> str:
        """
        Serialize a Python object to a typed string (value::type).

        Args:
            value: Python value to serialize.

        Returns:
            String in format "value::type", or plain string if no type.
        """
        if isinstance(value, str):
            # Already typed or plain string - return as-is
            return value

        code = self._get_type_code_for_value(value)
        if code:
            type_cls = self.get(code)
            if type_cls:
                return type_cls().serialize(value) + "::" + code

        return str(value)

    # Legacy aliases (for backwards compatibility during transition)
    def parse(self, value_string: str) -> Any:
        """Legacy alias for fromText()."""
        return self.fromText(value_string)

    def serialize(self, value: Any) -> str:
        """Legacy alias for asTypedText()."""
        return self.asTypedText(value)


# Global registry instance
registry = TypeRegistry()

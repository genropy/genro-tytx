from typing import Any

from .base import DataType


class TypeRegistry:
    """
    Registry for pluggable data types.
    """

    def __init__(self) -> None:
        self._types: dict[str, type[DataType]] = {}
        self._codes: dict[str, type[DataType]] = {}
        self._python_types: dict[type, type[DataType]] = {}

    def register(self, type_cls: type[DataType]) -> None:
        """
        Register a new data type.
        """
        self._types[type_cls.name] = type_cls
        self._codes[type_cls.code] = type_cls
        # Register python_type if available
        if hasattr(type_cls, "python_type") and type_cls.python_type is not None:
            self._python_types[type_cls.python_type] = type_cls

    def get(self, name_or_code: str) -> type[DataType] | None:
        """
        Retrieve a type by name or code.
        """
        if name_or_code in self._types:
            return self._types[name_or_code]
        if name_or_code in self._codes:
            return self._codes[name_or_code]
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

    def from_text(self, text: str, type_code: str | None = None) -> Any:
        """
        Parse a string to a Python value.

        Args:
            text: The string to parse. May contain embedded type (value::type).
                Supports typed arrays: "[1,2,3]::L" applies type to all leaf values.
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
            # Check if it's a typed array: starts with '['
            if val_part.startswith("["):
                return self._parse_typed_array(val_part, type_cls)
            return type_cls().parse(val_part)

        return text

    def _parse_typed_array(self, json_str: str, type_cls: type[DataType]) -> list[Any]:
        """
        Parse a typed array, applying the type to all leaf values.

        Args:
            json_str: JSON array string like "[1,2,3]" or "[[1,2],[3,4]]"
            type_cls: Type class to apply to all leaf values

        Returns:
            List with all leaf values parsed using the type class
        """
        import json

        data = json.loads(json_str)

        def apply_type(item: Any) -> Any:
            if isinstance(item, list):
                return [apply_type(i) for i in item]
            # Convert to string and parse with type
            return type_cls().parse(str(item))

        result = apply_type(data)
        # data was parsed from JSON array, so result is always a list
        return result if isinstance(result, list) else [result]

    def _get_type_code_for_value(self, value: Any) -> str | None:
        """Get the type code for a Python value."""
        # Import here to avoid circular imports
        from datetime import date, datetime, time
        from decimal import Decimal

        # Check built-in types (order matters: bool before int, datetime before date)
        if isinstance(value, bool):
            return "B"
        if isinstance(value, int):
            return "L"  # L = Long integer
        if isinstance(value, float):
            return "R"  # R = Real number
        if isinstance(value, Decimal):
            return "N"  # N = Numeric
        if isinstance(value, datetime):
            return "DHZ"  # DHZ = Date Hour Zulu (timezone-aware)
        if isinstance(value, date):
            return "D"  # D = Date
        if isinstance(value, time):
            return "H"  # H = Hour
        if isinstance(value, (dict, list)):
            return "JS"  # JS = JavaScript object
        if isinstance(value, str):
            return None  # Strings don't get typed
        return None

    def as_text(
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

    def as_typed_text(self, value: Any, compact_array: bool = False) -> str:
        """
        Serialize a Python object to a typed string (value::type).

        Args:
            value: Python value to serialize.
            compact_array: If True and value is a homogeneous array, produce
                compact format "[1,2,3]::L" instead of typing each element.
                If array is not homogeneous, falls back to element-by-element typing.

        Returns:
            String in format "value::type", or plain string if no type.
        """
        if isinstance(value, str):
            # Already typed or plain string - return as-is
            return value

        # Handle compact array format
        if compact_array and isinstance(value, list):
            result = self._try_compact_array(value)
            if result is not None:
                return result
            # Fallback: type each element individually
            return self._serialize_array_elements(value)

        code = self._get_type_code_for_value(value)
        if code:
            type_cls = self.get(code)
            if type_cls:
                return type_cls().serialize(value) + "::" + code

        return str(value)

    def _get_leaf_type_code(self, value: Any) -> str | None:
        """Get type code for a leaf value (non-list)."""
        if isinstance(value, list):
            return None  # Not a leaf
        return self._get_type_code_for_value(value)

    def _collect_leaf_types(self, value: Any) -> set[str | None]:
        """Collect all unique type codes from leaf values in a nested structure."""
        if isinstance(value, list):
            result: set[str | None] = set()
            for item in value:
                result.update(self._collect_leaf_types(item))
            return result
        return {self._get_leaf_type_code(value)}

    def _serialize_leaf(self, value: Any, type_cls: type[DataType]) -> Any:
        """Serialize a leaf value using the given type class."""
        if isinstance(value, list):
            return [self._serialize_leaf(item, type_cls) for item in value]
        return type_cls().serialize(value)

    def _try_compact_array(self, value: list[Any]) -> str | None:
        """
        Try to serialize array in compact format.

        Returns compact string if successful, None if array is not homogeneous.
        """
        import json

        if not value:
            # Empty array - no type to infer
            return "[]"

        leaf_types = self._collect_leaf_types(value)

        # If there are any None (strings), array is not fully typed - fallback
        if None in leaf_types:
            return None

        if len(leaf_types) != 1:
            # Not homogeneous (multiple types)
            return None

        type_code = leaf_types.pop()
        # After filtering None above, type_code is guaranteed to be str
        if type_code is None:
            return None
        type_cls = self.get(type_code)
        if not type_cls:
            return None

        # Serialize all leaf values
        serialized = self._serialize_leaf(value, type_cls)
        return json.dumps(serialized, separators=(",", ":")) + "::" + type_code

    def _serialize_array_elements(self, value: list[Any]) -> str:
        """Serialize array with each element typed individually."""
        import json

        def serialize_item(item: Any) -> Any:
            if isinstance(item, list):
                return [serialize_item(i) for i in item]
            return self.as_typed_text(item)

        return json.dumps([serialize_item(i) for i in value], separators=(",", ":"))


# Global registry instance
registry = TypeRegistry()

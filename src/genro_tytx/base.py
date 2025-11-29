from abc import ABC, abstractmethod
from typing import Any, ClassVar, cast


class DataType(ABC):
    """
    Abstract base class for pluggable data types.

    Class Attributes:
        name: Human-readable name of the type (e.g., "integer", "decimal")
        code: Short code used in TYTX syntax (e.g., "I", "N", "D")
        aliases: Alternative codes/names that map to this type
        python_type: The Python type this DataType handles (e.g., int, Decimal)
        sql_type: SQL type for database schema generation (e.g., "INTEGER", "DECIMAL")
        align: Display alignment - "L" (left), "R" (right), "C" (center)
        empty: Value to use when parsing empty string (e.g., 0, None, "")
    """

    # Required attributes
    name: ClassVar[str]
    code: ClassVar[str]

    # Optional attributes with defaults
    aliases: ClassVar[list[str]] = []
    python_type: ClassVar[type | None] = None
    js_type: ClassVar[str] = "string"
    sql_type: ClassVar[str] = "VARCHAR"
    align: ClassVar[str] = "L"
    empty: ClassVar[Any] = None
    default_format: ClassVar[str | None] = None

    @abstractmethod
    def parse(self, value: str) -> Any:
        """
        Convert string representation to python object.
        """
        pass

    @abstractmethod
    def serialize(self, value: Any) -> str:
        """
        Convert python object to string representation.
        """
        pass

    def format(
        self, value: Any, fmt: str | bool | None = None, locale: str | None = None
    ) -> str:
        """
        Format python object to localized string representation.

        Default implementation returns serialize(). Override in subclasses
        for locale-specific formatting (dates, numbers, etc.).

        Args:
            value: Python value to format.
            fmt: Format string, True for default format, or None for serialize().
                - None: returns serialize() (ISO/technical output)
                - True: uses type's default_format with locale
                - str: uses specific format string with locale
            locale: Locale string (e.g., "it-IT"). If None, uses system locale.

        Returns:
            Formatted string representation.
        """
        if fmt is None:
            return self.serialize(value)
        if fmt is True:
            fmt = self.default_format
        if fmt is None:
            return self.serialize(value)
        return self._format_with_locale(value, cast(str, fmt), locale)

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:  # noqa: ARG002
        """
        Apply format string with locale. Override in subclasses.

        Default implementation ignores fmt and locale, returns serialize().
        """
        return self.serialize(value)

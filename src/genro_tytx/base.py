from abc import ABC, abstractmethod
from typing import Any, ClassVar


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
    sql_type: ClassVar[str] = "VARCHAR"
    align: ClassVar[str] = "L"
    empty: ClassVar[Any] = None

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

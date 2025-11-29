from abc import ABC, abstractmethod
from typing import Any, ClassVar


class DataType(ABC):
    """
    Abstract base class for pluggable data types.
    """

    name: ClassVar[str]
    code: ClassVar[str]
    aliases: ClassVar[list[str]] = []

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

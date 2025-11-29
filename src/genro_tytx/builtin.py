import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from .base import DataType
from .registry import registry


class IntType(DataType):
    name = "int"
    code = "I"
    aliases = ["integer", "long"]

    def parse(self, value: str) -> int:
        return int(value)

    def serialize(self, value: Any) -> str:
        return str(value)


class FloatType(DataType):
    name = "float"
    code = "F"
    aliases = ["double", "real"]

    def parse(self, value: str) -> float:
        return float(value)

    def serialize(self, value: Any) -> str:
        return str(value)


class BoolType(DataType):
    name = "bool"
    code = "B"
    aliases = ["boolean"]

    def parse(self, value: str) -> bool:
        return value.lower() in ("true", "1", "yes", "t", "on")

    def serialize(self, value: Any) -> str:
        return "true" if value else "false"


class StrType(DataType):
    name = "str"
    code = "S"
    aliases = ["string", "text"]

    def parse(self, value: str) -> str:
        return value

    def serialize(self, value: Any) -> str:
        return str(value)


class JsonType(DataType):
    name = "json"
    code = "J"
    aliases = []

    def parse(self, value: str) -> Any:
        return json.loads(value)

    def serialize(self, value: Any) -> str:
        return json.dumps(value)


class ListType(DataType):
    name = "list"
    code = "L"
    aliases = ["array"]

    def parse(self, value: str) -> list[str]:
        return value.split(",") if value else []

    def serialize(self, value: Any) -> str:
        if isinstance(value, list):
            return ",".join(str(v) for v in value)
        return str(value)


class DecimalType(DataType):
    name = "decimal"
    code = "D"
    aliases = ["dec", "money"]

    def parse(self, value: str) -> Decimal:
        return Decimal(value)

    def serialize(self, value: Any) -> str:
        return str(value)

class DateType(DataType):
    name = "date"
    code = "d"
    aliases = []

    def parse(self, value: str) -> date:
        return date.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        return str(value.isoformat())


class DateTimeType(DataType):
    name = "datetime"
    code = "dt"
    aliases = []

    def parse(self, value: str) -> datetime:
        return datetime.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        return str(value.isoformat())


# Register built-in types
def register_builtins() -> None:
    registry.register(IntType)
    registry.register(FloatType)
    registry.register(BoolType)
    registry.register(StrType)
    registry.register(JsonType)
    registry.register(ListType)
    registry.register(DecimalType)
    registry.register(DateType)
    registry.register(DateTimeType)


register_builtins()

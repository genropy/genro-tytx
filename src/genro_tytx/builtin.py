import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from .base import DataType
from .registry import registry


class IntType(DataType):
    """Integer type - whole numbers."""

    name = "int"
    code = "I"
    aliases = ["integer", "long", "INT", "INTEGER", "LONG", "LONGINT"]
    python_type = int
    sql_type = "INTEGER"
    align = "R"
    empty = 0

    def parse(self, value: str) -> int:
        return int(value)

    def serialize(self, value: Any) -> str:
        return str(value)


class FloatType(DataType):
    """Floating point type - decimal numbers with limited precision."""

    name = "float"
    code = "F"
    aliases = ["double", "real", "FLOAT", "REAL", "R"]
    python_type = float
    sql_type = "REAL"
    align = "R"
    empty = 0.0

    def parse(self, value: str) -> float:
        return float(value)

    def serialize(self, value: Any) -> str:
        return str(value)


class BoolType(DataType):
    """Boolean type - true/false values."""

    name = "bool"
    code = "B"
    aliases = ["boolean", "BOOL", "BOOLEAN"]
    python_type = bool
    sql_type = "BOOLEAN"
    align = "L"
    empty = False

    def parse(self, value: str) -> bool:
        return value.lower() in ("true", "1", "yes", "t", "on", "y")

    def serialize(self, value: Any) -> str:
        return "true" if value else "false"


class StrType(DataType):
    """String/text type."""

    name = "str"
    code = "S"
    aliases = ["string", "text", "T", "TEXT", "A", "P"]
    python_type = str
    sql_type = "VARCHAR"
    align = "L"
    empty = ""

    def parse(self, value: str) -> str:
        return value

    def serialize(self, value: Any) -> str:
        return str(value)


class JsonType(DataType):
    """JSON type - serialized dict/list structures."""

    name = "json"
    code = "J"
    aliases = ["JS"]
    python_type = dict  # Primary type, also handles list
    sql_type = "JSON"
    align = "L"
    empty = None

    def parse(self, value: str) -> Any:
        return json.loads(value)

    def serialize(self, value: Any) -> str:
        return json.dumps(value)


class ListType(DataType):
    """Comma-separated list type."""

    name = "list"
    code = "L"
    aliases = ["array"]
    python_type = list
    sql_type = "VARCHAR"
    align = "L"
    empty = []  # noqa: RUF012

    def parse(self, value: str) -> list[str]:
        return value.split(",") if value else []

    def serialize(self, value: Any) -> str:
        if isinstance(value, list):
            return ",".join(str(v) for v in value)
        return str(value)


class DecimalType(DataType):
    """Decimal type - exact decimal numbers (for money, etc.)."""

    name = "decimal"
    code = "D"
    aliases = ["dec", "numeric", "N", "NUMERIC", "DECIMAL"]
    python_type = Decimal
    sql_type = "DECIMAL"
    align = "R"
    empty = Decimal("0")

    def parse(self, value: str) -> Decimal:
        return Decimal(value)

    def serialize(self, value: Any) -> str:
        return str(value)


class DateType(DataType):
    """Date type - calendar date without time."""

    name = "date"
    code = "d"
    aliases = ["DATE", "D"]
    python_type = date
    sql_type = "DATE"
    align = "L"
    empty = None

    def parse(self, value: str) -> date:
        return date.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        return str(value.isoformat())


class DateTimeType(DataType):
    """DateTime type - date with time."""

    name = "datetime"
    code = "dt"
    aliases = ["DATETIME", "DT", "DH", "DHZ", "timestamp"]
    python_type = datetime
    sql_type = "TIMESTAMP"
    align = "L"
    empty = None

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

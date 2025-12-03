import contextlib
import json
import locale as locale_module
import logging
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from .base import DataType
from .registry import registry

logger = logging.getLogger(__name__)


def _set_locale(locale: str | None) -> str | None:
    """Set locale temporarily and return the previous locale."""
    if locale is None:
        return None
    # Use LC_TIME instead of LC_ALL to avoid issues with composite locales
    prev = locale_module.getlocale(locale_module.LC_TIME)
    try:
        # Convert "it-IT" format to "it_IT.UTF-8" format
        normalized = locale.replace("-", "_")
        if "." not in normalized:
            normalized = f"{normalized}.UTF-8"
        locale_module.setlocale(locale_module.LC_TIME, normalized)
    except locale_module.Error:
        # Fallback: try without UTF-8
        with contextlib.suppress(locale_module.Error):
            locale_module.setlocale(locale_module.LC_TIME, locale.replace("-", "_"))
    return prev[0] if prev[0] else None


def _restore_locale(prev: str | None) -> None:
    """Restore previous locale."""
    if prev is not None:
        try:
            locale_module.setlocale(locale_module.LC_TIME, prev)
        except locale_module.Error:
            locale_module.setlocale(locale_module.LC_TIME, "")


class IntType(DataType):
    """Integer type - whole numbers."""

    name = "int"
    code = "L"
    python_type = int
    js_type = "number"
    sql_type = "INTEGER"
    align = "R"
    empty = 0
    default_format = "%d"

    def parse(self, value: str) -> int:
        return int(value)

    def serialize(self, value: Any) -> str:
        return str(value)

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            return locale_module.format_string(fmt, value, grouping=True)
        finally:
            _restore_locale(prev)


class FloatType(DataType):
    """Floating point type - decimal numbers with limited precision."""

    name = "float"
    code = "R"
    python_type = float
    js_type = "number"
    sql_type = "REAL"
    align = "R"
    empty = 0.0
    default_format = "%.2f"

    def parse(self, value: str) -> float:
        return float(value)

    def serialize(self, value: Any) -> str:
        return str(value)

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            return locale_module.format_string(fmt, value, grouping=True)
        finally:
            _restore_locale(prev)


class BoolType(DataType):
    """Boolean type - true/false values."""

    name = "bool"
    code = "B"
    python_type = bool
    js_type = "boolean"
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
    code = "T"
    python_type = str
    js_type = "string"
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
    code = "JS"
    python_type = dict  # Primary type, also handles list
    js_type = "object"
    sql_type = "JSON"
    align = "L"
    empty = None

    def parse(self, value: str) -> Any:
        return json.loads(value)

    def serialize(self, value: Any) -> str:
        return json.dumps(value)


class DecimalType(DataType):
    """Decimal type - exact decimal numbers (for money, etc.)."""

    name = "decimal"
    code = "N"
    python_type = Decimal
    js_type = "number"  # JS has no native Decimal
    sql_type = "DECIMAL"
    align = "R"
    empty = Decimal("0")
    default_format = "%.2f"

    def parse(self, value: str) -> Decimal:
        return Decimal(value)

    def serialize(self, value: Any) -> str:
        return str(value)

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            return locale_module.format_string(fmt, float(value), grouping=True)
        finally:
            _restore_locale(prev)


class DateType(DataType):
    """Date type - calendar date without time."""

    name = "date"
    code = "D"
    python_type = date
    js_type = "Date"
    sql_type = "DATE"
    align = "L"
    empty = None
    default_format = "%x"  # Locale's appropriate date representation

    def parse(self, value: str) -> date:
        return date.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        return str(value.isoformat())

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            result: str = value.strftime(fmt)
            return result
        finally:
            _restore_locale(prev)


class DateTimeType(DataType):
    """DateTime type - date with time (timezone-aware).

    DHZ preserves timezone information. When serialized, always outputs
    with Z suffix for UTC. This allows cross-timezone operations:
    America -> Paris (save as UTC) -> Tokyo (view as local or UTC).
    """

    name = "datetime"
    code = "DHZ"
    python_type = datetime
    js_type = "Date"
    sql_type = "TIMESTAMP WITH TIME ZONE"
    align = "L"
    empty = None
    default_format = "%c"  # Locale's appropriate date and time representation

    def parse(self, value: str) -> datetime:
        # Handle Z suffix for Python 3.10 compatibility
        # (fromisoformat only supports Z suffix in Python 3.11+)
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        # Always serialize with Z suffix for UTC
        from datetime import timezone as tz

        if value.tzinfo is not None:
            utc_value = value.astimezone(tz.utc)
            result: str = utc_value.strftime("%Y-%m-%dT%H:%M:%SZ")
            return result
        # Naive datetime: assume UTC and serialize as DHZ
        # Note: DH (naive datetime) is deprecated. Use timezone-aware datetimes.
        logger.debug(
            "Naive datetime %s serialized as DHZ (UTC). "
            "Consider using timezone-aware datetime. DH is deprecated.",
            value,
        )
        result = value.strftime("%Y-%m-%dT%H:%M:%SZ")
        return str(result)

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            result: str = value.strftime(fmt)
            return result
        finally:
            _restore_locale(prev)


class NaiveDateTimeType(DataType):
    """Naive DateTime type - date with time (no timezone).

    DEPRECATED: Use DateTimeType (DHZ) instead.

    DH is for naive datetimes without timezone info.
    Serializes as ISO format without Z suffix.
    """

    name = "naive_datetime"
    code = "DH"
    python_type = None  # Not auto-detected, must be explicit
    js_type = "Date"
    sql_type = "TIMESTAMP"
    align = "L"
    empty = None
    default_format = "%c"

    def parse(self, value: str) -> datetime:
        return datetime.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        # Serialize without timezone suffix
        result: str = value.strftime("%Y-%m-%dT%H:%M:%S")
        return result

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            result: str = value.strftime(fmt)
            return result
        finally:
            _restore_locale(prev)


class TimeType(DataType):
    """Time type - time of day without date."""

    name = "time"
    code = "H"
    python_type = time
    js_type = "Date"  # JS uses Date with epoch (1970-01-01)
    sql_type = "TIME"
    align = "L"
    empty = None
    default_format = "%X"  # Locale's appropriate time representation

    def parse(self, value: str) -> time:
        return time.fromisoformat(value)

    def serialize(self, value: Any) -> str:
        return str(value.isoformat())

    def _format_with_locale(self, value: Any, fmt: str, locale: str | None) -> str:
        prev = _set_locale(locale)
        try:
            result: str = value.strftime(fmt)
            return result
        finally:
            _restore_locale(prev)


# Register built-in types
def register_builtins() -> None:
    registry.register(IntType)
    registry.register(FloatType)
    registry.register(BoolType)
    registry.register(StrType)
    registry.register(JsonType)
    registry.register(DecimalType)
    registry.register(DateType)
    registry.register(DateTimeType)
    registry.register(NaiveDateTimeType)  # DH - deprecated
    registry.register(TimeType)


register_builtins()

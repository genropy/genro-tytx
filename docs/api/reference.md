# API Reference

Complete API documentation for genro-tytx.

## Core Functions

### from_text

```{eval-rst}
.. py:function:: from_text(value: str, type_code: str | None = None) -> Any

   Parse typed string to Python object.

   :param value: String with optional ``::type_code`` suffix
   :param type_code: Explicit type code (overrides embedded type)
   :return: Parsed Python value, or original string if no type
   :rtype: Any

   **Examples:**

   .. code-block:: python

      from_text("123::L")           # → 123
      from_text("100.50::N")        # → Decimal("100.50")
      from_text("2025-01-15::D")    # → date(2025, 1, 15)
      from_text("123", "L")         # → 123 (explicit type)
      from_text("hello")            # → "hello" (no type)
```

### as_text

```{eval-rst}
.. py:function:: as_text(value: Any, format: str | bool | None = None, locale: str | None = None) -> str

   Serialize Python value to string (no type suffix).

   :param value: Python value to serialize
   :param format: None (ISO), True (default format), or format string
   :param locale: Locale for formatting (e.g., "it_IT")
   :return: String representation
   :rtype: str

   **Examples:**

   .. code-block:: python

      as_text(123)                           # → "123"
      as_text(Decimal("100.50"))             # → "100.50"
      as_text(date(2025, 1, 15))             # → "2025-01-15"
      as_text(date(2025, 1, 15), "%d/%m/%Y") # → "15/01/2025"
```

### as_typed_text

```{eval-rst}
.. py:function:: as_typed_text(value: Any) -> str

   Serialize Python value with type suffix.

   :param value: Python value to serialize
   :return: String with ``::type_code`` suffix (strings return as-is)
   :rtype: str

   **Examples:**

   .. code-block:: python

      as_typed_text(123)                 # → "123::L"
      as_typed_text(Decimal("100.50"))   # → "100.50::N"
      as_typed_text("hello")             # → "hello" (no suffix)
```

## JSON Functions

### as_typed_json

```{eval-rst}
.. py:function:: as_typed_json(data: Any) -> str

   Serialize to JSON with TYTX type suffixes.

   :param data: Data structure to serialize
   :return: JSON string with typed values
   :rtype: str
   :raises TypeError: If data contains non-serializable objects

   **Examples:**

   .. code-block:: python

      as_typed_json({"price": Decimal("99.99")})
      # → '{"price": "99.99::N"}'
```

### as_json

```{eval-rst}
.. py:function:: as_json(data: Any) -> str

   Serialize to standard JSON (no type suffixes).

   :param data: Data structure to serialize
   :return: Standard JSON string
   :rtype: str
   :raises TypeError: If data contains non-serializable objects

   **Examples:**

   .. code-block:: python

      as_json({"price": Decimal("99.99")})
      # → '{"price": 99.99}'
```

### from_json

```{eval-rst}
.. py:function:: from_json(json_str: str) -> Any

   Parse JSON with TYTX type hydration.

   :param json_str: JSON string to parse
   :return: Parsed data with hydrated types
   :rtype: Any

   **Examples:**

   .. code-block:: python

      from_json('{"price": "99.99::N"}')
      # → {"price": Decimal("99.99")}
```

## XML Functions

### as_typed_xml

```{eval-rst}
.. py:function:: as_typed_xml(data: dict, root_tag: str | None = None) -> str

   Serialize to XML with TYTX type suffixes.

   :param data: Dict with ``{tag: {attrs: {}, value: ...}}`` structure
   :param root_tag: Optional root tag name
   :return: XML string with typed values
   :rtype: str
   :raises ValueError: If data structure is invalid

   **Examples:**

   .. code-block:: python

      data = {"root": {"attrs": {}, "value": Decimal("10.50")}}
      as_typed_xml(data)
      # → '<root>10.50::N</root>'
```

### as_xml

```{eval-rst}
.. py:function:: as_xml(data: dict, root_tag: str | None = None) -> str

   Serialize to standard XML (no type suffixes).

   :param data: Dict with ``{tag: {attrs: {}, value: ...}}`` structure
   :param root_tag: Optional root tag name
   :return: Standard XML string
   :rtype: str
   :raises ValueError: If data structure is invalid
```

### from_xml

```{eval-rst}
.. py:function:: from_xml(xml_str: str) -> dict

   Parse XML to ``{tag: {attrs: {}, value: ...}}`` structure.

   :param xml_str: XML string to parse
   :return: Dict with attrs/value structure
   :rtype: dict

   **Examples:**

   .. code-block:: python

      from_xml("<root>10.50::N</root>")
      # → {"root": {"attrs": {}, "value": Decimal("10.50")}}
```

## Registry Class

### TypeRegistry

```{eval-rst}
.. py:class:: TypeRegistry

   Manages type registration and lookup.

   .. py:method:: get(name_or_code: str) -> type[DataType] | None

      Get type class by name or code.

      :param name_or_code: Type name or code
      :return: Type class or None

   .. py:method:: get_for_value(value: Any) -> type[DataType] | None

      Get type class for Python value.

      :param value: Python value
      :return: Type class or None

   .. py:method:: is_typed(value: str) -> bool

      Check if string has valid TYTX type suffix.

      :param value: String to check
      :return: True if has valid type suffix

   .. py:method:: register(type_class: type[DataType]) -> None

      Register a type class.

      :param type_class: DataType subclass to register

   .. py:method:: from_text(value: str, type_code: str | None = None) -> Any

      Parse typed string to Python object.

   .. py:method:: as_text(value: Any, format: str | bool | None = None, locale: str | None = None) -> str

      Serialize value to string.

   .. py:method:: as_typed_text(value: Any) -> str

      Serialize value with type suffix.
```

## DataType Base Class

```{eval-rst}
.. py:class:: DataType

   Abstract base class for TYTX types.

   **Class Attributes:**

   .. py:attribute:: name
      :type: str

      Human-readable name (e.g., "integer")

   .. py:attribute:: code
      :type: str

      Type code (e.g., "L" for integer)

   .. py:attribute:: python_type
      :type: type | None

      Python type class (default: None)

   .. py:attribute:: sql_type
      :type: str

      SQL column type (default: "VARCHAR")

   .. py:attribute:: align
      :type: str

      Display alignment: "L", "R", "C" (default: "L")

   .. py:attribute:: empty
      :type: Any

      Default empty value (default: None)

   .. py:attribute:: js_type
      :type: str

      JavaScript type (default: "string")

   .. py:attribute:: default_format
      :type: str | None

      Default format string (default: None)

   **Abstract Methods:**

   .. py:method:: parse(value: str) -> Any
      :abstractmethod:

      Convert string to Python object.

   .. py:method:: serialize(value: Any) -> str
      :abstractmethod:

      Convert Python object to string.

   **Optional Methods:**

   .. py:method:: format(value: Any, fmt: str | bool | None = None, locale: str | None = None) -> str

      Format value for display with locale support.
```

## Built-in Types

| Type | Code | Python Type | Module |
|------|------|-------------|--------|
| `IntType` | `L` | `int` | `genro_tytx` |
| `FloatType` | `R` | `float` | `genro_tytx` |
| `DecimalType` | `N` | `Decimal` | `genro_tytx` |
| `BoolType` | `B` | `bool` | `genro_tytx` |
| `StrType` | `T` | `str` | `genro_tytx` |
| `DateType` | `D` | `date` | `genro_tytx` |
| `DateTimeType` | `DHZ` | `datetime` | `genro_tytx` |
| `NaiveDateTimeType` | `DH` | `datetime` | `genro_tytx` |
| `TimeType` | `H` | `time` | `genro_tytx` |
| `JsonType` | `JS` | `dict` | `genro_tytx` |

## Module Exports

```python
from genro_tytx import (
    # Core functions
    from_text,
    as_text,
    as_typed_text,

    # JSON functions
    as_json,
    as_typed_json,
    from_json,

    # XML functions
    as_xml,
    as_typed_xml,
    from_xml,

    # Registry
    registry,
    TypeRegistry,

    # Type classes
    IntType,
    FloatType,
    DecimalType,
    BoolType,
    StrType,
    DateType,
    DateTimeType,
    TimeType,
    JsonType,
)
```

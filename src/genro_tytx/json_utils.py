"""
JSON utilities for TYTX Protocol.

Provides encoder/decoder functions for JSON serialization with typed values.

JSON-native types (int, float, bool, str, null) are NOT marked with type codes
because JSON already preserves their type. Only non-native types (Decimal, date,
datetime, time) receive type markers.

Protocol Prefixes:
    TYTX://   - Standard typed payload
    XTYTX://  - Extended envelope with struct definitions

Usage:
    # Typed JSON (TYTX format - reversible)
    as_typed_json({"count": 5, "price": Decimal("99.50")})
    # → '{"count": 5, "price": "99.50::N"}'

    from_json(json_str)  # → {"count": 5, "price": Decimal("99.50")}

    # Standard JSON (for external systems - may lose precision)
    as_json(data)  # → '{"price": 99.5}'

    # XTYTX envelope with inline struct definitions
    from_json('XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}')
"""

import json
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from .registry import registry

# Protocol prefix constants
TYTX_PREFIX = "TYTX://"
XTYTX_PREFIX = "XTYTX://"


def _typed_encoder(obj: Any) -> str:
    """
    JSON encoder for non-native types.

    Called by json.dumps only for types JSON doesn't handle natively.
    Returns typed string (e.g., "99.50::N" for Decimal).

    Args:
        obj: Python object to encode (Decimal, date, datetime, time).

    Returns:
        Typed string representation.

    Raises:
        TypeError: If object is not serializable.
    """
    if isinstance(obj, (Decimal, datetime, date, time)):
        return registry.as_typed_text(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _standard_encoder(obj: Any) -> Any:
    """
    JSON encoder for non-native types (standard output).

    Converts to JSON-compatible types (may lose precision).

    Args:
        obj: Python object to encode.

    Returns:
        JSON-compatible representation.

    Raises:
        TypeError: If object is not serializable.
    """
    from datetime import date, datetime
    from decimal import Decimal

    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _hydrate(obj: Any, local_structs: dict | None = None) -> Any:
    """
    Recursively hydrate typed strings in parsed JSON.

    Args:
        obj: Parsed JSON value (dict, list, str, etc.).
        local_structs: Optional dict of local struct definitions that take
                       precedence over registry during hydration.

    Returns:
        Value with typed strings converted to Python objects.
    """
    if isinstance(obj, str):
        return registry.from_text(obj, local_structs=local_structs)
    if isinstance(obj, dict):
        return {k: _hydrate(v, local_structs) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_hydrate(v, local_structs) for v in obj]
    return obj


def _process_xtytx(envelope: dict) -> Any:
    """
    Process XTYTX envelope.

    1. Register gstruct entries globally (overwrites existing)
    2. Build local_structs context from lstruct
    3. Decode data using combined context
    4. Return decoded data (or None if data is empty)

    Args:
        envelope: Parsed XTYTX envelope with gstruct, lstruct, data fields.

    Returns:
        Decoded data or None if data is empty.

    Raises:
        KeyError: If required fields are missing.
    """
    gstruct = envelope["gstruct"]
    lstruct = envelope["lstruct"]
    data = envelope["data"]

    # Register gstruct entries globally (overwrites existing)
    for code, schema in gstruct.items():
        registry.register_struct(code, schema)

    # If data is empty, return None
    if not data:
        return None

    # Strip TYTX:// prefix from data if present
    if data.startswith(TYTX_PREFIX):
        data = data[len(TYTX_PREFIX):]

    # Parse and hydrate data with lstruct as local context
    parsed = json.loads(data)
    return _hydrate(parsed, local_structs=lstruct if lstruct else None)


def as_typed_json(obj: Any, **kwargs: Any) -> str:
    """
    Serialize Python object to JSON string with typed values (TYTX format).

    Non-native JSON types (Decimal, date, datetime, etc.) are serialized
    as typed strings (e.g., "123.45::D"). This format is reversible.

    Args:
        obj: Python object to serialize.
        **kwargs: Additional arguments passed to json.dumps.

    Returns:
        JSON string with typed values.
    """
    kwargs.setdefault("default", _typed_encoder)
    return json.dumps(obj, **kwargs)


def as_json(obj: Any, **kwargs: Any) -> str:
    """
    Serialize Python object to standard JSON string.

    Non-native JSON types are converted to JSON-compatible types:
    - Decimal → float (may lose precision)
    - date/datetime → ISO string

    Use this for export to external systems that don't understand TYTX.

    Args:
        obj: Python object to serialize.
        **kwargs: Additional arguments passed to json.dumps.

    Returns:
        Standard JSON string.
    """
    kwargs.setdefault("default", _standard_encoder)
    return json.dumps(obj, **kwargs)


def from_json(s: str, **kwargs: Any) -> Any:
    """
    Parse JSON string and hydrate typed values.

    Supports three formats:
    - Regular JSON: '{"price": "100::N"}' - typed strings are hydrated
    - TYTX:// prefix: 'TYTX://{"price": "100::N"}' - same as regular
    - XTYTX:// prefix: 'XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "..."}'
      - gstruct entries are registered globally
      - lstruct entries are used only during this decode
      - data is decoded using combined struct context

    Args:
        s: JSON string to parse (may have TYTX:// or XTYTX:// prefix).
        **kwargs: Additional arguments passed to json.loads.

    Returns:
        Python object with typed values hydrated.
        Returns None if XTYTX envelope has empty data.

    Raises:
        KeyError: If XTYTX envelope is missing required fields.
        json.JSONDecodeError: If JSON is invalid.
    """
    # Check for XTYTX:// prefix
    if s.startswith(XTYTX_PREFIX):
        envelope_json = s[len(XTYTX_PREFIX):]
        envelope = json.loads(envelope_json, **kwargs)
        return _process_xtytx(envelope)

    # Check for TYTX:// prefix
    if s.startswith(TYTX_PREFIX):
        s = s[len(TYTX_PREFIX):]

    # Regular JSON with TYTX typed values
    return _hydrate(json.loads(s, **kwargs))

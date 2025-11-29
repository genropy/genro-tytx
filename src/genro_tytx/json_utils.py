"""
JSON utilities for TYTX Protocol.

Provides encoder/decoder functions for JSON serialization with typed values.

Usage:
    # Encoding (Python → JSON with typed strings)
    json.dumps(data, default=tytx_encoder)
    # or
    tytx_dumps(data)

    # Decoding (JSON with typed strings → Python)
    tytx_loads(json_string)
"""

import json
from typing import Any

from .registry import registry


def tytx_encoder(obj: Any) -> str:
    """
    JSON encoder for non-native types.

    Use with json.dumps(data, default=tytx_encoder).

    Args:
        obj: Python object to encode.

    Returns:
        Typed string representation (e.g., "123.45::D").

    Raises:
        TypeError: If object is not serializable.
    """
    typed = registry.asTypedText(obj)
    if typed != str(obj):
        return typed
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def tytx_decoder(obj: Any) -> Any:
    """
    Recursively hydrate typed strings in parsed JSON.

    Args:
        obj: Parsed JSON value (dict, list, str, etc.).

    Returns:
        Value with typed strings converted to Python objects.
    """
    if isinstance(obj, str):
        return registry.fromText(obj)
    if isinstance(obj, dict):
        return {k: tytx_decoder(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [tytx_decoder(v) for v in obj]
    return obj


def tytx_dumps(obj: Any, **kwargs: Any) -> str:
    """
    Serialize Python object to JSON string with typed values.

    Non-native JSON types (Decimal, date, datetime, etc.) are serialized
    as typed strings (e.g., "123.45::D").

    Args:
        obj: Python object to serialize.
        **kwargs: Additional arguments passed to json.dumps.

    Returns:
        JSON string with typed values.
    """
    kwargs.setdefault("default", tytx_encoder)
    return json.dumps(obj, **kwargs)


def tytx_loads(s: str, **kwargs: Any) -> Any:
    """
    Parse JSON string and hydrate typed values.

    Typed strings (e.g., "123.45::D") are converted to Python objects.

    Args:
        s: JSON string to parse.
        **kwargs: Additional arguments passed to json.loads.

    Returns:
        Python object with typed values hydrated.
    """
    return tytx_decoder(json.loads(s, **kwargs))

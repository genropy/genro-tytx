"""
TYTX Metadata Grammar Parser

Parses metadata strings like: [len:5, reg:"[A-Z]{2}", enum:A|B|C]
Uses Lark for robust parsing with proper quote handling.
"""

from typing import Any, cast

from lark import Lark, Transformer, v_args
from lark.lexer import Token

# Lark grammar for TYTX metadata
METADATA_GRAMMAR = r"""
    start: metadata_list

    metadata_list: metadata_item ("," WS? metadata_item)*

    metadata_item: key ":" value

    key: /[a-z_]+/

    value: quoted_string
         | enum_list
         | simple_value

    quoted_string: ESCAPED_STRING
    enum_list: simple_value ("|" simple_value)+
    simple_value: /[^,\[\]"|]+/

    %import common.ESCAPED_STRING
    %import common.WS
    %ignore WS
"""


class MetadataTransformer(Transformer[Token, dict[str, Any]]):
    """Transform parsed tree into Python dict."""

    @v_args(inline=True)
    def key(self, s: Token) -> str:
        return str(s)

    @v_args(inline=True)
    def quoted_string(self, s: Token) -> str:
        # Remove quotes and unescape
        return str(s)[1:-1].replace('\\"', '"').replace('\\\\', '\\')

    @v_args(inline=True)
    def simple_value(self, s: Token) -> str:
        return str(s).strip()

    def enum_list(self, items: list[str]) -> str:
        return '|'.join(str(item) for item in items)

    def value(self, items: list[str]) -> str:
        return items[0]

    @v_args(inline=True)
    def metadata_item(self, key: str, value: str) -> tuple[str, str]:
        return (key, value)

    def metadata_list(self, items: list[tuple[str, str]]) -> dict[str, str]:
        return dict(items)

    def start(self, items: list[dict[str, str]]) -> dict[str, str]:
        return items[0]


# Create parser instance
_parser = Lark(METADATA_GRAMMAR, parser='lalr', transformer=MetadataTransformer())


def parse_metadata(text: str) -> dict[str, Any]:
    """
    Parse metadata string to dictionary.

    Args:
        text: Metadata string without brackets, e.g. 'len:5, reg:"[A-Z]{2}"'

    Returns:
        Dictionary of metadata key-value pairs

    Examples:
        >>> parse_metadata('len:5')
        {'len': '5'}
        >>> parse_metadata('len:5, reg:"[A-Z]{2}"')
        {'len': '5', 'reg': '[A-Z]{2}'}
        >>> parse_metadata('enum:A|B|C')
        {'enum': 'A|B|C'}
    """
    if not text or not text.strip():
        return {}

    try:
        return cast(dict[str, Any], _parser.parse(text.strip()))
    except Exception as e:
        raise ValueError(f"Failed to parse metadata '{text}': {e}") from e


def format_metadata(data: dict[str, Any]) -> str:
    """
    Format metadata dictionary to string.

    Args:
        data: Dictionary of metadata key-value pairs

    Returns:
        Formatted metadata string (without brackets)

    Examples:
        >>> format_metadata({'len': '5'})
        'len:5'
        >>> format_metadata({'len': '5', 'reg': '[A-Z]{2}'})
        'len:5, reg:"[A-Z]{2}"'
        >>> format_metadata({'enum': 'A|B|C'})
        'enum:A|B|C'
    """
    if not data:
        return ''

    parts = []
    for key, value in data.items():
        value_str = str(value)

        # Quote if contains special chars (except for enums with |)
        if _needs_quotes(value_str, key):
            # Escape quotes and backslashes
            escaped = value_str.replace('\\', '\\\\').replace('"', '\\"')
            parts.append(f'{key}:"{escaped}"')
        else:
            parts.append(f'{key}:{value_str}')

    return ', '.join(parts)


def _needs_quotes(value: str, key: str) -> bool:
    """Check if value needs to be quoted."""
    # Don't quote enum values (they use | separator)
    if key == 'enum' or '|' in value:
        return False

    # Quote if contains special chars
    special_chars = [',', '[', ']', ':', '"', '\\', '{', '}', '(', ')']
    return any(char in value for char in special_chars)


# Validation: known metadata keys
KNOWN_KEYS = {
    # Validation facets
    'len', 'min', 'max', 'dec', 'reg', 'enum',
    # UI facets
    'lbl', 'ph', 'hint', 'def', 'ro', 'hidden'
}


def validate_metadata(data: dict[str, Any], strict: bool = False) -> None:
    """
    Validate metadata dictionary.

    Args:
        data: Metadata dictionary
        strict: If True, raise error for unknown keys

    Raises:
        ValueError: If validation fails
    """
    for key in data:
        if strict and key not in KNOWN_KEYS:
            raise ValueError(f"Unknown metadata key: '{key}'")

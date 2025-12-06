# Installation

## Requirements

- Python 3.10 or higher
- No external dependencies (stdlib only)

## Install from PyPI

```bash
pip install genro-tytx-base
```

## Optional Dependencies

For faster JSON encoding/decoding with orjson:

```bash
pip install genro-tytx-base[fast]
```

For MessagePack support:

```bash
pip install genro-tytx-base[msgpack]
```

For all extras:

```bash
pip install genro-tytx-base[all]
```

## Development Installation

Clone the repository:

```bash
git clone https://github.com/genropy/genro-tytx-base.git
cd genro-tytx-base
pip install -e ".[dev]"
```

## Verify Installation

```python
>>> from genro_tytx_base import to_typed_text, from_text
>>> from decimal import Decimal
>>> to_typed_text({"price": Decimal("100.50")})
'{"price": "100.50::N"}::JS'
>>> from_text('{"price": "100.50::N"}::JS')
{'price': Decimal('100.50')}
```

## Performance Options

### orjson (Recommended)

For better JSON performance, install orjson:

```bash
pip install orjson
```

TYTX Base auto-detects orjson and uses it when available. You can also force a specific encoder:

```python
from genro_tytx_base import to_typed_text, from_text

# Force stdlib json
result = to_typed_text(data, use_orjson=False)

# Force orjson (raises error if not installed)
result = to_typed_text(data, use_orjson=True)

# Auto-detect (default)
result = to_typed_text(data)
```

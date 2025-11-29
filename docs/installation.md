# Installation

## Requirements

- Python 3.10 or higher
- No external dependencies (stdlib only)

## Install from PyPI

```bash
pip install genro-tytx
```

## Optional Dependencies

For faster JSON encoding with orjson:

```bash
pip install genro-tytx[json]
```

For MessagePack support:

```bash
pip install genro-tytx[msgpack]
```

For all extras:

```bash
pip install genro-tytx[all]
```

## Development Installation

Clone the repository:

```bash
git clone https://github.com/genropy/genro-tytx.git
cd genro-tytx
pip install -e ".[dev]"
```

## Verify Installation

```python
>>> from genro_tytx import from_text, as_typed_text
>>> from_text("100::D")
Decimal('100')
>>> as_typed_text(42)
'42::I'
```

## JavaScript Installation

For JavaScript/TypeScript projects:

```bash
npm install genro-tytx
```

Or include directly in browser:

```html
<script src="https://unpkg.com/genro-tytx/dist/genro-tytx.min.js"></script>
```

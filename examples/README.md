# TYTX Examples

This directory contains examples and tools for working with TYTX.

## Contents

### `/visualizer/`

Interactive visual editor for TYTX struct definitions.

**Usage**:
1. Open `visualizer/index.html` in a web browser
2. Create new structs or import existing JSON schemas
3. Edit fields, add metadata, nest structs
4. Export to JSON for use in your code

**Features**:
- Create/edit struct definitions
- Nested struct support
- Import/Export JSON
- Metadata editing (labels, validation, hints)
- Array field support

### `/schemas/`

Sample TYTX schema files.

| File | Description |
|------|-------------|
| `fatturapa.json` | Italian Electronic Invoice (FatturaPA v1.2.2) |

## XSD to TYTX Conversion

Use the `scripts/xsd_to_tytx.py` script to convert XSD schemas:

```bash
# Generate Python code
python scripts/xsd_to_tytx.py path/to/schema.xsd

# Generate JSON (for visualizer)
python scripts/xsd_to_tytx.py path/to/schema.xsd --json > output.json
```

## Example Struct Definitions

### FatturaPA (Italian Invoice)

```python
from genro_tytx import registry

# Address
registry.register_struct('INDIRIZZO', {
    'indirizzo': 'T[max:60]',
    'cap': 'T[len:5]',
    'comune': 'T[max:60]',
    'provincia': 'T[len:2]',
    'nazione': 'T[len:2]'
})

# Invoice line
registry.register_struct('RIGA', {
    'num': 'L',
    'desc': 'T[max:1000]',
    'qty': 'N[dec:8]',
    'price': 'N[dec:8]',
    'iva': 'N[dec:2]'
})

# Invoice with array of lines
registry.register_struct('FATTURA', {
    'testata': '@TESTATA',
    'righe': '#@RIGA',  # Array of structs
    'totale': 'N[dec:2]'
})
```

### GeoJSON

```python
registry.register_struct('LATLNG', {'lat': 'R', 'lng': 'R'})

registry.register_struct('FEATURE', {
    'type': 'T',
    'geometry': '@GEO_POINT',
    'properties': 'JS'
})

registry.register_struct('FEATURE_COLLECTION', {
    'type': 'T',
    'features': '#@FEATURE'
})
```

### Google Geocoder Response

```python
registry.register_struct('ADDR_COMP', {
    'long_name': 'T',
    'short_name': 'T',
    'types': '#T'
})

registry.register_struct('GEO_RESULT', {
    'place_id': 'T',
    'formatted_address': 'T',
    'address_components': '#@ADDR_COMP',
    'geometry': '@GEOMETRY'
})
```

### OpenAPI Parameters

```python
registry.register_struct('PARAM', {
    'name': 'T',
    'in': 'T[enum:query|path|header|cookie]',
    'required': 'B',
    'schema': 'JS'
})

registry.register_struct('OPERATION', {
    'summary': 'T',
    'operationId': 'T',
    'parameters': '#@PARAM'
})
```

## Using with XTYTX

Send struct definitions with data using XTYTX envelope:

```python
from genro_tytx import from_json

# Self-contained payload with local struct
payload = '''XTYTX://{
    "gstruct": {},
    "lstruct": {
        "POINT": {"x": "R", "y": "R"}
    },
    "data": "TYTX://{\\"point\\": \\"{\\\\\\"x\\\\\\":\\\\\\"3.14\\\\\\",\\\\\\"y\\\\\\":\\\\\\"2.71\\\\\\"}::@POINT\\"}"
}'''

result = from_json(payload)
# → {"point": {"x": 3.14, "y": 2.71}}
```

## License

Apache License 2.0 - Softwell S.r.l. (2025)

"""
XSD to TYTX Struct Converter.

Converts XSD schemas to TYTX struct definitions in v2 format.

Output format:
    - Simple fields: "T", "L", "N", etc.
    - Fields with constraints: {"type": "T", "validate": {"min": 1, "max": 100}}

Usage:
    python xsd_to_tytx.py schema.xsd           # Python code output
    python xsd_to_tytx.py schema.xsd --json    # JSON output
"""

import sys
import xml.etree.ElementTree as ET
from typing import Any
import json

# XSD Namespace
NS = {'xs': 'http://www.w3.org/2001/XMLSchema'}


def xsd_to_tytx_field(xsd_type: str, restrictions: dict[str, Any]) -> str | dict[str, Any]:
    """
    Maps XSD types and restrictions to TYTX field definition.

    Returns:
        - Simple string code if no restrictions: "T", "L", etc.
        - FieldDef object if restrictions present: {"type": "T", "validate": {...}}
    """
    base_type = xsd_type.replace('xs:', '')

    code = 'T'
    validate: dict[str, Any] = {}

    # 1. Map Base Type
    if base_type in ['string', 'normalizedString', 'token']:
        code = 'T'
    elif base_type in ['int', 'integer', 'long', 'short']:
        code = 'L'
    elif base_type in ['decimal']:
        code = 'N'
    elif base_type in ['float', 'double']:
        code = 'R'
    elif base_type in ['date']:
        code = 'D'
    elif base_type in ['dateTime']:
        code = 'DHZ'
    elif base_type in ['time']:
        code = 'H'
    elif base_type in ['boolean']:
        code = 'B'

    # 2. Map Restrictions (Facets) to validate section
    for key, val in restrictions.items():
        if key == 'maxLength':
            validate['max'] = int(val)
        elif key == 'minLength':
            validate['min'] = int(val)
        elif key == 'length':
            validate['length'] = int(val)
        elif key == 'pattern':
            validate['pattern'] = val
        elif key == 'fractionDigits':
            validate['decimals'] = int(val)
        elif key == 'totalDigits':
            validate['digits'] = int(val)
        elif key == 'minInclusive':
            validate['min'] = _parse_number(val)
        elif key == 'maxInclusive':
            validate['max'] = _parse_number(val)
        elif key == 'minExclusive':
            validate['min'] = _parse_number(val)
            validate['minExclusive'] = True
        elif key == 'maxExclusive':
            validate['max'] = _parse_number(val)
            validate['maxExclusive'] = True
        elif key == 'enumeration':
            # Enum values are passed as a list
            if isinstance(val, list):
                validate['enum'] = val

    # Return simple code or FieldDef object
    if validate:
        return {'type': code, 'validate': validate}
    return code


def _parse_number(val: str) -> int | float:
    """Parse string to int or float."""
    try:
        return int(val)
    except ValueError:
        return float(val)

def parse_simple_types(root) -> dict[str, str | dict[str, Any]]:
    """Parse all simpleType definitions and map them to TYTX field definitions."""
    simple_types: dict[str, str | dict[str, Any]] = {}

    for simple_type in root.findall('.//xs:simpleType', NS):
        name = simple_type.get('name')
        if not name:
            continue

        restriction = simple_type.find('.//xs:restriction', NS)
        if restriction is None:
            continue

        base_type = restriction.get('base', 'xs:string')
        restrictions: dict[str, Any] = {}

        # Extract restriction facets
        for facet in restriction:
            tag = facet.tag.replace('{http://www.w3.org/2001/XMLSchema}', '')
            value = facet.get('value')

            if tag == 'length':
                restrictions['length'] = value
            elif tag == 'minLength':
                restrictions['minLength'] = value
            elif tag == 'maxLength':
                restrictions['maxLength'] = value
            elif tag == 'minInclusive':
                restrictions['minInclusive'] = value
            elif tag == 'maxInclusive':
                restrictions['maxInclusive'] = value
            elif tag == 'minExclusive':
                restrictions['minExclusive'] = value
            elif tag == 'maxExclusive':
                restrictions['maxExclusive'] = value
            elif tag == 'pattern':
                restrictions['pattern'] = value
            elif tag == 'fractionDigits':
                restrictions['fractionDigits'] = value
            elif tag == 'totalDigits':
                restrictions['totalDigits'] = value
            elif tag == 'enumeration':
                if 'enumeration' not in restrictions:
                    restrictions['enumeration'] = []
                restrictions['enumeration'].append(value)

        # Map to TYTX field definition
        tytx_field = xsd_to_tytx_field(base_type, restrictions)
        simple_types[name] = tytx_field

    return simple_types

def parse_xsd(file_path: str) -> dict[str, dict[str, str | dict[str, Any]]]:
    """
    Parse XSD file and convert to TYTX struct definitions.

    Returns:
        Dict mapping struct names to field definitions in v2 format.
    """
    tree = ET.parse(file_path)
    root = tree.getroot()

    # First pass: parse all SimpleTypes
    simple_types = parse_simple_types(root)

    structs: dict[str, dict[str, str | dict[str, Any]]] = {}

    # Second pass: parse ComplexTypes (Structs)
    for complex_type in root.findall('.//xs:complexType', NS):
        name = complex_type.get('name')
        if not name:
            continue

        fields: dict[str, str | dict[str, Any]] = {}
        sequence = complex_type.find('.//xs:sequence', NS)
        if sequence is not None:
            for element in sequence.findall('xs:element', NS):
                elem_name = element.get('name')
                elem_type = element.get('type')

                # Skip elements with 'ref' instead of 'name' (external references)
                if not elem_name:
                    continue

                # Check for array (maxOccurs="unbounded")
                max_occurs = element.get('maxOccurs')
                is_array = max_occurs == 'unbounded'

                # Check for required (minOccurs > 0, default is 1)
                min_occurs = element.get('minOccurs', '1')
                is_required = min_occurs != '0'

                # Resolve Type
                tytx_field: str | dict[str, Any] = 'T'  # Default

                if elem_type and elem_type.startswith('xs:'):
                    # Built-in XSD type
                    tytx_field = xsd_to_tytx_field(elem_type, {})
                elif elem_type:
                    # Check if it's a SimpleType we've parsed
                    if elem_type in simple_types:
                        tytx_field = simple_types[elem_type]
                    else:
                        # Reference to another ComplexType (struct)
                        tytx_field = f"@{elem_type}"

                # Handle array prefix
                if is_array:
                    if isinstance(tytx_field, str):
                        tytx_field = f"#{tytx_field}"
                    else:
                        # FieldDef with array type
                        tytx_field['type'] = f"#{tytx_field['type']}"

                # Add required to validate if not required
                if not is_required:
                    if isinstance(tytx_field, str):
                        tytx_field = {'type': tytx_field, 'validate': {'required': False}}
                    else:
                        if 'validate' not in tytx_field:
                            tytx_field['validate'] = {}
                        tytx_field['validate']['required'] = False

                fields[elem_name] = tytx_field

        structs[name] = fields

    return structs

def _format_field_value(field: str | dict[str, Any]) -> str:
    """Format a field value for Python code output."""
    if isinstance(field, str):
        # Simple string type code
        if '\\' in field:
            return f"r'{field}'"
        return f"'{field}'"
    # FieldDef object - format as dict literal
    return repr(field)


def generate_python_code(structs: dict[str, dict[str, str | dict[str, Any]]]) -> None:
    """Generate Python code to register structs."""
    print("from genro_tytx import registry\n")

    for name, fields in structs.items():
        print(f"registry.register_struct('{name}', {{")
        for fname, fvalue in fields.items():
            formatted = _format_field_value(fvalue)
            print(f"    '{fname}': {formatted},")
        print("})\n")


def generate_json(structs: dict[str, dict[str, str | dict[str, Any]]]) -> None:
    """Generate JSON output of struct definitions."""
    print(json.dumps(structs, indent=4))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python xsd_to_tytx.py <schema.xsd> [--json]")
        sys.exit(1)
        
    file_path = sys.argv[1]
    structs = parse_xsd(file_path)
    
    if "--json" in sys.argv:
        generate_json(structs)
    else:
        generate_python_code(structs)

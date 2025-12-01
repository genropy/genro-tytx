import sys
import xml.etree.ElementTree as ET
from typing import Dict, Any
import json
import re

# Import metadata parser from genro_tytx if available, otherwise use fallback
try:
    import sys
    sys.path.insert(0, '/Users/gporcari/Sviluppo/genro_ng/meta-genro-modules/sub-projects/genro-tytx/src')
    from genro_tytx.metadata_parser import format_metadata
    HAS_METADATA_PARSER = True
except ImportError:
    HAS_METADATA_PARSER = False
    def format_metadata(data: Dict[str, Any]) -> str:
        """Fallback metadata formatter."""
        return ', '.join(f'{k}:{v}' for k, v in data.items())

# XSD Namespace
NS = {'xs': 'http://www.w3.org/2001/XMLSchema'}

def xsd_to_tytx_type(xsd_type: str, restrictions: Dict[str, Any]) -> str:
    """Maps XSD types and restrictions to TYTX codes + metadata."""
    base_type = xsd_type.replace('xs:', '')
    
    code = 'T'
    meta = {}

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
    elif base_type in ['boolean']:
        code = 'B'
    
    # 2. Map Restrictions (Facets) to metadata dict
    for key, val in restrictions.items():
        if key == 'maxLength':
            meta['max'] = val
        elif key == 'minLength':
            meta['min'] = val
        elif key == 'length':
            meta['len'] = val
        elif key == 'pattern':
            # Include pattern - parser will quote it automatically
            meta['reg'] = val
        elif key == 'fractionDigits':
            meta['dec'] = val
        elif key == 'enumeration':
            # Enum values are passed as a list
            if isinstance(val, list):
                meta['enum'] = '|'.join(val)

    if meta:
        meta_str = format_metadata(meta)
        return f"{code}[{meta_str}]"
    return code

def parse_simple_types(root) -> Dict[str, str]:
    """Parse all simpleType definitions and map them to TYTX types with metadata."""
    simple_types = {}
    
    for simple_type in root.findall('.//xs:simpleType', NS):
        name = simple_type.get('name')
        if not name:
            continue
        
        restriction = simple_type.find('.//xs:restriction', NS)
        if restriction is None:
            continue
        
        base_type = restriction.get('base', 'xs:string')
        restrictions = {}
        
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
        
        # Map to TYTX type
        tytx_type = xsd_to_tytx_type(base_type, restrictions)
        simple_types[name] = tytx_type
    
    return simple_types

def parse_xsd(file_path: str):
    tree = ET.parse(file_path)
    root = tree.getroot()
    
    # First pass: parse all SimpleTypes
    simple_types = parse_simple_types(root)
    
    structs = {}

    # Second pass: parse ComplexTypes (Structs)
    for complex_type in root.findall('.//xs:complexType', NS):
        name = complex_type.get('name')
        if not name: continue
        
        fields = {}
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
                
                # Resolve Type
                tytx_type = 'T' # Default
                
                if elem_type and elem_type.startswith('xs:'):
                    # Built-in XSD type
                    tytx_type = xsd_to_tytx_type(elem_type, {})
                elif elem_type:
                    # Check if it's a SimpleType we've parsed
                    if elem_type in simple_types:
                        tytx_type = simple_types[elem_type]
                    else:
                        # Reference to another ComplexType (struct)
                        tytx_type = f"@{elem_type}"
                
                if is_array:
                    tytx_type = f"#{tytx_type}"
                
                fields[elem_name] = tytx_type

        structs[name] = fields

    return structs

import json
import re

def generate_python_code(structs: Dict[str, Dict]):
    print("from genro_tytx import registry\n")
    
    for name, fields in structs.items():
        print(f"registry.register_struct('{name}', {{")
        for fname, ftype in fields.items():
            # Escape apostrophes for Python string literals
            escaped_type = ftype.replace("'", "\\'")
            # Use raw string if contains backslashes (regex patterns)
            if '\\' in ftype:
                print(f"    '{fname}': r'{escaped_type}',")
            else:
                print(f"    '{fname}': '{escaped_type}',")
        print("})\n")

def generate_json(structs: Dict[str, Dict]):
    schema = []
    
    for name, fields in structs.items():
        struct_obj = {
            'name': name,
            'fields': []
        }
        
        for fname, ftype in fields.items():
            # Parse type and meta from string "Code[meta]"
            match = re.match(r'^([^[\]]+)(?:\[(.*)\])?$', ftype)
            if match:
                type_code = match.group(1)
                meta = match.group(2) or ""
                struct_obj['fields'].append({
                    'name': fname,
                    'type': type_code,
                    'meta': meta
                })
            else:
                # Fallback
                struct_obj['fields'].append({
                    'name': fname,
                    'type': ftype,
                    'meta': ""
                })
        
        schema.append(struct_obj)
    
    print(json.dumps(schema, indent=4))

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

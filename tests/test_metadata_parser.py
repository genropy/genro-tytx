"""
Tests for metadata_parser module
"""

import pytest
from genro_tytx.metadata_parser import parse_metadata, format_metadata, validate_metadata


class TestParseMetadata:
    """Test metadata parsing."""
    
    def test_simple_value(self):
        result = parse_metadata('len:5')
        assert result == {'len': '5'}
    
    def test_multiple_values(self):
        result = parse_metadata('len:5, max:10')
        assert result == {'len': '5', 'max': '10'}
    
    def test_quoted_value(self):
        result = parse_metadata('reg:"[A-Z]{2}"')
        assert result == {'reg': '[A-Z]{2}'}
    
    def test_complex_regex(self):
        result = parse_metadata(r'reg:"[\\p{IsBasicLatin}]{1,10}"')
        assert result == {'reg': r'[\p{IsBasicLatin}]{1,10}'}
    
    def test_enum(self):
        result = parse_metadata('enum:A|B|C')
        assert result == {'enum': 'A|B|C'}
    
    def test_complex_metadata(self):
        result = parse_metadata('len:5, reg:"[A-Z]{2}", enum:SC|PR|AB')
        assert result == {
            'len': '5',
            'reg': '[A-Z]{2}',
            'enum': 'SC|PR|AB'
        }
    
    def test_empty_string(self):
        result = parse_metadata('')
        assert result == {}
    
    def test_whitespace(self):
        result = parse_metadata('  len:5  ,  max:10  ')
        assert result == {'len': '5', 'max': '10'}


class TestFormatMetadata:
    """Test metadata formatting."""
    
    def test_simple_value(self):
        result = format_metadata({'len': '5'})
        assert result == 'len:5'
    
    def test_multiple_values(self):
        result = format_metadata({'len': '5', 'max': '10'})
        assert result in ['len:5, max:10', 'max:10, len:5']
    
    def test_quoted_value(self):
        result = format_metadata({'reg': '[A-Z]{2}'})
        assert result == 'reg:"[A-Z]{2}"'
    
    def test_enum_not_quoted(self):
        result = format_metadata({'enum': 'A|B|C'})
        assert result == 'enum:A|B|C'
    
    def test_empty_dict(self):
        result = format_metadata({})
        assert result == ''


class TestRoundTrip:
    """Test parse → format → parse round-trip."""
    
    def test_simple(self):
        original = 'len:5, max:10'
        parsed = parse_metadata(original)
        formatted = format_metadata(parsed)
        reparsed = parse_metadata(formatted)
        assert parsed == reparsed
    
    def test_with_regex(self):
        original = 'reg:"[A-Z]{2}"'
        parsed = parse_metadata(original)
        formatted = format_metadata(parsed)
        reparsed = parse_metadata(formatted)
        assert parsed == reparsed
    
    def test_complex(self):
        original = 'len:5, reg:"[A-Z]{2}", enum:A|B|C'
        parsed = parse_metadata(original)
        formatted = format_metadata(parsed)
        reparsed = parse_metadata(formatted)
        assert parsed == reparsed


class TestValidateMetadata:
    """Test metadata validation."""
    
    def test_valid_keys(self):
        data = {'len': '5', 'max': '10', 'lbl': 'Label'}
        validate_metadata(data, strict=True)  # Should not raise
    
    def test_unknown_key_non_strict(self):
        data = {'unknown': 'value'}
        validate_metadata(data, strict=False)  # Should not raise
    
    def test_unknown_key_strict(self):
        data = {'unknown': 'value'}
        with pytest.raises(ValueError, match="Unknown metadata key"):
            validate_metadata(data, strict=True)

/**
 * Tests for TYTX metadata parser (TypeScript).
 */

import { describe, it, expect } from 'vitest';
import {
  parseMetadata,
  formatMetadata,
  validateMetadata,
  MetadataParseError,
  KNOWN_KEYS,
} from '../src/metadata.js';

describe('parseMetadata', () => {
  it('parses simple value', () => {
    expect(parseMetadata('len:5')).toEqual({ len: '5' });
  });

  it('parses multiple values', () => {
    expect(parseMetadata('len:5, max:10')).toEqual({ len: '5', max: '10' });
  });

  it('parses quoted value', () => {
    expect(parseMetadata('reg:"[A-Z]{2}"')).toEqual({ reg: '[A-Z]{2}' });
  });

  it('parses complex regex', () => {
    expect(parseMetadata('reg:"[\\\\p{IsBasicLatin}]{1,10}"')).toEqual({
      reg: '[\\p{IsBasicLatin}]{1,10}',
    });
  });

  it('parses enum', () => {
    expect(parseMetadata('enum:A|B|C')).toEqual({ enum: 'A|B|C' });
  });

  it('parses complex metadata', () => {
    expect(parseMetadata('len:5, reg:"[A-Z]{2}", enum:SC|PR|AB')).toEqual({
      len: '5',
      reg: '[A-Z]{2}',
      enum: 'SC|PR|AB',
    });
  });

  it('returns empty object for empty string', () => {
    expect(parseMetadata('')).toEqual({});
  });

  it('handles whitespace', () => {
    expect(parseMetadata('  len:5  ,  max:10  ')).toEqual({ len: '5', max: '10' });
  });

  it('handles escaped quotes in quoted string', () => {
    expect(parseMetadata('lbl:"Say \\"hello\\""')).toEqual({ lbl: 'Say "hello"' });
  });

  it('handles escaped backslash in quoted string', () => {
    expect(parseMetadata('reg:"a\\\\b"')).toEqual({ reg: 'a\\b' });
  });

  it('handles whitespace after colon', () => {
    // Tests lines 120-122: skip whitespace after colon before value
    expect(parseMetadata('len:   5')).toEqual({ len: '5' });
  });

  it('handles unknown escape sequence in quoted string', () => {
    // Tests lines 141-144: backslash followed by char that is not " or \
    // In this case, only the backslash is added (nextChar is 'n', not special)
    expect(parseMetadata('lbl:"a\\nb"')).toEqual({ lbl: 'a\\nb' });
  });

  it('throws on missing colon', () => {
    expect(() => parseMetadata('len5')).toThrow(MetadataParseError);
  });

  it('throws on empty key (starts with non-letter)', () => {
    // Tests lines 104-106: empty key
    expect(() => parseMetadata(':5')).toThrow(/Expected key/);
  });

  it('handles whitespace between key and colon', () => {
    // Tests lines 108-111: skip whitespace after key before colon
    expect(parseMetadata('len :5')).toEqual({ len: '5' });
  });

  it('throws on unterminated quoted string', () => {
    expect(() => parseMetadata('lbl:"unterminated')).toThrow(MetadataParseError);
  });

  it('handles whitespace after value before comma', () => {
    // Tests lines 167-169: whitespace skipping after value
    expect(parseMetadata('len:5   ,max:10')).toEqual({ len: '5', max: '10' });
  });

  it('handles value with trailing whitespace', () => {
    // Tests the whitespace skip loop
    expect(parseMetadata('len:5   ')).toEqual({ len: '5' });
  });

  it('handles null/undefined input', () => {
    expect(parseMetadata(null as never)).toEqual({});
    expect(parseMetadata(undefined as never)).toEqual({});
  });

  it('stops parsing at unexpected character after whitespace', () => {
    // Tests line 175-178: break when trimmed[pos] is not comma or ]
    // After value and whitespace, if there's an unexpected char, parser breaks
    // Here we have "len:5  x" - after parsing "5" and skipping "  ", it sees "x"
    // which is not comma or ], so it breaks
    expect(parseMetadata('len:5  x')).toEqual({ len: '5  x' });
  });

  it('handles quoted value followed by whitespace and character', () => {
    // After quoted value, skip whitespace, then break on unexpected char
    expect(parseMetadata('lbl:"test"  x')).toEqual({ lbl: 'test' });
  });

  it('parses value ending at comma', () => {
    // Tests line 158: value parsing stops at comma
    const result = parseMetadata('len:5,max:10');
    expect(result).toEqual({ len: '5', max: '10' });
  });
});

describe('formatMetadata', () => {
  it('formats simple value', () => {
    expect(formatMetadata({ len: '5' })).toBe('len:5');
  });

  it('formats multiple values', () => {
    const result = formatMetadata({ len: '5', max: '10' });
    // Order may vary
    expect(result).toMatch(/len:5/);
    expect(result).toMatch(/max:10/);
  });

  it('quotes value with special chars', () => {
    expect(formatMetadata({ reg: '[A-Z]{2}' })).toBe('reg:"[A-Z]{2}"');
  });

  it('does not quote enum values', () => {
    expect(formatMetadata({ enum: 'A|B|C' })).toBe('enum:A|B|C');
  });

  it('returns empty string for empty dict', () => {
    expect(formatMetadata({})).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatMetadata(null as never)).toBe('');
    expect(formatMetadata(undefined as never)).toBe('');
  });

  it('handles value with pipe but not enum key', () => {
    // Tests needsQuotes: value.includes('|') should not quote
    expect(formatMetadata({ custom: 'A|B' })).toBe('custom:A|B');
  });

  it('escapes quotes in value', () => {
    expect(formatMetadata({ lbl: 'Say "hello"' })).toBe('lbl:"Say \\"hello\\""');
  });

  it('escapes backslashes in value', () => {
    expect(formatMetadata({ reg: 'a\\b' })).toBe('reg:"a\\\\b"');
  });
});

describe('round-trip parse → format → parse', () => {
  it('simple values', () => {
    const original = 'len:5, max:10';
    const parsed = parseMetadata(original);
    const formatted = formatMetadata(parsed);
    const reparsed = parseMetadata(formatted);
    expect(parsed).toEqual(reparsed);
  });

  it('with regex', () => {
    const original = 'reg:"[A-Z]{2}"';
    const parsed = parseMetadata(original);
    const formatted = formatMetadata(parsed);
    const reparsed = parseMetadata(formatted);
    expect(parsed).toEqual(reparsed);
  });

  it('complex metadata', () => {
    const original = 'len:5, reg:"[A-Z]{2}", enum:A|B|C';
    const parsed = parseMetadata(original);
    const formatted = formatMetadata(parsed);
    const reparsed = parseMetadata(formatted);
    expect(parsed).toEqual(reparsed);
  });
});

describe('validateMetadata', () => {
  it('accepts valid keys', () => {
    expect(() => validateMetadata({ len: '5', max: '10', lbl: 'Label' }, true)).not.toThrow();
  });

  it('accepts unknown keys in non-strict mode', () => {
    expect(() => validateMetadata({ unknown: 'value' }, false)).not.toThrow();
  });

  it('throws for unknown keys in strict mode', () => {
    expect(() => validateMetadata({ unknown: 'value' }, true)).toThrow(/Unknown metadata key/);
  });
});

describe('KNOWN_KEYS', () => {
  it('contains validation facets', () => {
    expect(KNOWN_KEYS.has('len')).toBe(true);
    expect(KNOWN_KEYS.has('min')).toBe(true);
    expect(KNOWN_KEYS.has('max')).toBe(true);
    expect(KNOWN_KEYS.has('dec')).toBe(true);
    expect(KNOWN_KEYS.has('reg')).toBe(true);
    expect(KNOWN_KEYS.has('enum')).toBe(true);
  });

  it('contains UI facets', () => {
    expect(KNOWN_KEYS.has('lbl')).toBe(true);
    expect(KNOWN_KEYS.has('ph')).toBe(true);
    expect(KNOWN_KEYS.has('hint')).toBe(true);
    expect(KNOWN_KEYS.has('def')).toBe(true);
    expect(KNOWN_KEYS.has('ro')).toBe(true);
    expect(KNOWN_KEYS.has('hidden')).toBe(true);
  });
});

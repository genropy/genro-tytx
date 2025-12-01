/**
 * Tests for TYTX metadata parser (JavaScript).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    parseMetadata,
    formatMetadata,
    validateMetadata,
    MetadataParseError,
    KNOWN_KEYS
} = require('../src/metadata');

describe('parseMetadata', () => {
    it('parses simple value', () => {
        assert.deepStrictEqual(parseMetadata('len:5'), { len: '5' });
    });

    it('parses multiple values', () => {
        assert.deepStrictEqual(parseMetadata('len:5, max:10'), { len: '5', max: '10' });
    });

    it('parses quoted value', () => {
        assert.deepStrictEqual(parseMetadata('reg:"[A-Z]{2}"'), { reg: '[A-Z]{2}' });
    });

    it('parses complex regex', () => {
        assert.deepStrictEqual(
            parseMetadata('reg:"[\\\\p{IsBasicLatin}]{1,10}"'),
            { reg: '[\\p{IsBasicLatin}]{1,10}' }
        );
    });

    it('parses enum', () => {
        assert.deepStrictEqual(parseMetadata('enum:A|B|C'), { enum: 'A|B|C' });
    });

    it('parses complex metadata', () => {
        assert.deepStrictEqual(
            parseMetadata('len:5, reg:"[A-Z]{2}", enum:SC|PR|AB'),
            { len: '5', reg: '[A-Z]{2}', enum: 'SC|PR|AB' }
        );
    });

    it('returns empty object for empty string', () => {
        assert.deepStrictEqual(parseMetadata(''), {});
    });

    it('handles whitespace', () => {
        assert.deepStrictEqual(parseMetadata('  len:5  ,  max:10  '), { len: '5', max: '10' });
    });

    it('handles escaped quotes in quoted string', () => {
        assert.deepStrictEqual(parseMetadata('lbl:"Say \\"hello\\""'), { lbl: 'Say "hello"' });
    });

    it('handles escaped backslash in quoted string', () => {
        assert.deepStrictEqual(parseMetadata('reg:"a\\\\b"'), { reg: 'a\\b' });
    });

    it('throws on missing colon', () => {
        assert.throws(() => parseMetadata('len5'), MetadataParseError);
    });

    it('throws on unterminated quoted string', () => {
        assert.throws(() => parseMetadata('lbl:"unterminated'), MetadataParseError);
    });
});

describe('formatMetadata', () => {
    it('formats simple value', () => {
        assert.strictEqual(formatMetadata({ len: '5' }), 'len:5');
    });

    it('formats multiple values', () => {
        const result = formatMetadata({ len: '5', max: '10' });
        assert.ok(result.includes('len:5'));
        assert.ok(result.includes('max:10'));
    });

    it('quotes value with special chars', () => {
        assert.strictEqual(formatMetadata({ reg: '[A-Z]{2}' }), 'reg:"[A-Z]{2}"');
    });

    it('does not quote enum values', () => {
        assert.strictEqual(formatMetadata({ enum: 'A|B|C' }), 'enum:A|B|C');
    });

    it('returns empty string for empty dict', () => {
        assert.strictEqual(formatMetadata({}), '');
    });

    it('escapes quotes in value', () => {
        assert.strictEqual(formatMetadata({ lbl: 'Say "hello"' }), 'lbl:"Say \\"hello\\""');
    });

    it('escapes backslashes in value', () => {
        assert.strictEqual(formatMetadata({ reg: 'a\\b' }), 'reg:"a\\\\b"');
    });
});

describe('round-trip parse → format → parse', () => {
    it('simple values', () => {
        const original = 'len:5, max:10';
        const parsed = parseMetadata(original);
        const formatted = formatMetadata(parsed);
        const reparsed = parseMetadata(formatted);
        assert.deepStrictEqual(parsed, reparsed);
    });

    it('with regex', () => {
        const original = 'reg:"[A-Z]{2}"';
        const parsed = parseMetadata(original);
        const formatted = formatMetadata(parsed);
        const reparsed = parseMetadata(formatted);
        assert.deepStrictEqual(parsed, reparsed);
    });

    it('complex metadata', () => {
        const original = 'len:5, reg:"[A-Z]{2}", enum:A|B|C';
        const parsed = parseMetadata(original);
        const formatted = formatMetadata(parsed);
        const reparsed = parseMetadata(formatted);
        assert.deepStrictEqual(parsed, reparsed);
    });
});

describe('validateMetadata', () => {
    it('accepts valid keys', () => {
        assert.doesNotThrow(() => validateMetadata({ len: '5', max: '10', lbl: 'Label' }, true));
    });

    it('accepts unknown keys in non-strict mode', () => {
        assert.doesNotThrow(() => validateMetadata({ unknown: 'value' }, false));
    });

    it('throws for unknown keys in strict mode', () => {
        assert.throws(
            () => validateMetadata({ unknown: 'value' }, true),
            /Unknown metadata key/
        );
    });
});

describe('KNOWN_KEYS', () => {
    it('contains validation facets', () => {
        assert.ok(KNOWN_KEYS.has('len'));
        assert.ok(KNOWN_KEYS.has('min'));
        assert.ok(KNOWN_KEYS.has('max'));
        assert.ok(KNOWN_KEYS.has('dec'));
        assert.ok(KNOWN_KEYS.has('reg'));
        assert.ok(KNOWN_KEYS.has('enum'));
    });

    it('contains UI facets', () => {
        assert.ok(KNOWN_KEYS.has('lbl'));
        assert.ok(KNOWN_KEYS.has('ph'));
        assert.ok(KNOWN_KEYS.has('hint'));
        assert.ok(KNOWN_KEYS.has('def'));
        assert.ok(KNOWN_KEYS.has('ro'));
        assert.ok(KNOWN_KEYS.has('hidden'));
    });
});

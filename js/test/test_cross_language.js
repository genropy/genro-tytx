/**
 * Cross-language compatibility tests for TYTX protocol.
 *
 * These tests verify that JavaScript implementation produces output
 * identical to the shared fixtures that Python and TS must also match.
 *
 * @module test_cross_language
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { registry } = require('../src/registry');
require('../src/types'); // Register built-in types
const { as_typed_json, from_json } = require('../src/json_utils');

// Load fixtures
const fixturesPath = path.join(__dirname, '../../tests/fixtures/cross_language.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

/**
 * Create JavaScript value from fixture spec.
 */
function createValue(spec) {
    if (spec && typeof spec === 'object' && 'type' in spec) {
        const typeName = spec.type;
        const value = spec.value;

        switch (typeName) {
            case 'int':
                return parseInt(value, 10);
            case 'float':
                return parseFloat(value);
            case 'bool':
                return Boolean(value);
            case 'string':
                return String(value);
            case 'date':
                // Create date at midnight UTC
                return new Date(value + 'T00:00:00.000Z');
            case 'datetime':
                // Datetime - parse as-is (should have Z suffix)
                return new Date(value);
            case 'time':
                // Time is stored as Date on epoch (1970-01-01) UTC
                return new Date('1970-01-01T' + value + 'Z');
            case 'decimal':
                // JS doesn't have native Decimal, skip these tests
                return value;
            default:
                return value;
        }
    }
    return spec;
}

/**
 * Recursively create JavaScript object from fixture spec.
 */
function createObject(obj) {
    if (obj && typeof obj === 'object') {
        if ('type' in obj && 'value' in obj && Object.keys(obj).length === 2) {
            return createValue(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map(createObject);
        }
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            if (!k.startsWith('_')) {
                result[k] = createObject(v);
            }
        }
        return result;
    }
    return obj;
}

describe('Cross-language: typed_text', () => {
    for (const testCase of fixtures.typed_text.cases) {
        // Skip python-only tests (Decimal)
        if (testCase._python_only) {
            continue;
        }

        const value = createValue(testCase.input);
        const expected = testCase.expected;

        test(`as_typed_text(${JSON.stringify(testCase.input)}) = "${expected}"`, () => {
            const result = registry.as_typed_text(value);
            assert.strictEqual(result, expected);
        });
    }
});

describe('Cross-language: from_text', () => {
    for (const testCase of fixtures.from_text.cases) {
        // Skip python-only tests (Decimal)
        if (testCase._python_only) {
            continue;
        }

        const inputStr = testCase.input;
        const expectedSpec = testCase.expected;

        test(`from_text("${inputStr}")`, () => {
            const result = registry.from_text(inputStr);

            switch (expectedSpec.type) {
                case 'int':
                    assert.strictEqual(typeof result, 'number');
                    assert.strictEqual(result, expectedSpec.value);
                    break;
                case 'float':
                    assert.strictEqual(typeof result, 'number');
                    assert.ok(Math.abs(result - expectedSpec.value) < 0.0001);
                    break;
                case 'bool':
                    assert.strictEqual(typeof result, 'boolean');
                    assert.strictEqual(result, expectedSpec.value);
                    break;
                case 'string':
                    assert.strictEqual(typeof result, 'string');
                    assert.strictEqual(result, expectedSpec.value);
                    break;
                case 'date':
                    assert.ok(result instanceof Date);
                    assert.strictEqual(result.toISOString().slice(0, 10), expectedSpec.value);
                    break;
                case 'datetime':
                    assert.ok(result instanceof Date);
                    // Compare UTC datetime - fixture has Z suffix
                    const expectedIso = expectedSpec.value.replace('Z', '');
                    assert.strictEqual(result.toISOString().slice(0, 19), expectedIso);
                    break;
                case 'time':
                    // Time is now a Date on epoch
                    assert.ok(result instanceof Date);
                    assert.strictEqual(result.getUTCFullYear(), 1970);
                    assert.strictEqual(result.getUTCMonth(), 0);
                    assert.strictEqual(result.getUTCDate(), 1);
                    // Compare time string
                    const timeStr = `${String(result.getUTCHours()).padStart(2, '0')}:${String(result.getUTCMinutes()).padStart(2, '0')}:${String(result.getUTCSeconds()).padStart(2, '0')}`;
                    assert.strictEqual(timeStr, expectedSpec.value);
                    break;
            }
        });
    }
});

describe('Cross-language: typed_json', () => {
    for (const testCase of fixtures.typed_json.cases) {
        const name = testCase.name || 'unnamed';

        test(`as_typed_json: ${name}`, () => {
            const inputObj = createObject(testCase.input);
            const expected = testCase.expected;

            const resultStr = as_typed_json(inputObj);
            const result = JSON.parse(resultStr);

            // Deep compare
            assert.deepStrictEqual(result, expected);
        });
    }
});

describe('Cross-language: json_roundtrip', () => {
    for (const testCase of fixtures.json_roundtrip.cases) {
        const name = testCase.name || 'unnamed';

        test(`roundtrip: ${name}`, () => {
            const inputObj = createObject(testCase.input);

            const jsonStr = as_typed_json(inputObj);
            const result = from_json(jsonStr);

            // Compare structure and values
            assertEqualTyped(result, inputObj, name);
        });
    }
});

/**
 * Assert two values are equal with correct types.
 */
function assertEqualTyped(result, expected, name) {
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
        assert.ok(typeof result === 'object' && result !== null, `${name}: expected object`);
        const expectedKeys = Object.keys(expected);
        const resultKeys = Object.keys(result);
        assert.deepStrictEqual(new Set(resultKeys), new Set(expectedKeys), `${name}: keys mismatch`);
        for (const k of expectedKeys) {
            assertEqualTyped(result[k], expected[k], `${name}.${k}`);
        }
    } else if (Array.isArray(expected)) {
        assert.ok(Array.isArray(result), `${name}: expected array`);
        assert.strictEqual(result.length, expected.length, `${name}: length mismatch`);
        for (let i = 0; i < expected.length; i++) {
            assertEqualTyped(result[i], expected[i], `${name}[${i}]`);
        }
    } else if (expected instanceof Date) {
        assert.ok(result instanceof Date, `${name}: expected Date`);
        assert.strictEqual(result.toISOString(), expected.toISOString());
    } else if (typeof expected === 'number') {
        assert.strictEqual(typeof result, 'number', `${name}: expected number`);
        assert.ok(Math.abs(result - expected) < 0.0001, `${name}: ${result} != ${expected}`);
    } else {
        assert.strictEqual(result, expected, `${name}: value mismatch`);
    }
}

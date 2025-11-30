/**
 * Cross-language compatibility tests for TYTX protocol.
 *
 * These tests verify that TypeScript implementation produces output
 * identical to the shared fixtures that Python and JS must also match.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { registry } from '../src/registry.js';
import { asTypedJson, fromJson } from '../src/json.js';

// Load fixtures
const fixturesPath = path.join(__dirname, '../../tests/fixtures/cross_language.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

interface InputSpec {
  type: string;
  value: string | number | boolean;
}

interface TypedTextCase {
  input: InputSpec;
  expected: string;
}

interface FromTextCase {
  input: string;
  expected: InputSpec;
}

interface TypedJsonCase {
  name?: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

interface RoundtripCase {
  name?: string;
  input: Record<string, unknown>;
}

/**
 * Create JavaScript value from fixture spec.
 */
function createValue(spec: unknown): unknown {
  if (spec && typeof spec === 'object' && 'type' in spec) {
    const s = spec as InputSpec;
    const typeName = s.type;
    const value = s.value;

    switch (typeName) {
      case 'int':
        return typeof value === 'number' ? value : parseInt(String(value), 10);
      case 'float':
        return typeof value === 'number' ? value : parseFloat(String(value));
      case 'bool':
        return Boolean(value);
      case 'string':
        return String(value);
      case 'date':
        return new Date(String(value) + 'T00:00:00.000Z');
      case 'datetime':
        return new Date(String(value));
      case 'time':
        return String(value);
      case 'decimal':
        return String(value);
      default:
        return value;
    }
  }
  return spec;
}

/**
 * Recursively create JavaScript object from fixture spec.
 */
function createObject(obj: unknown): unknown {
  if (obj && typeof obj === 'object') {
    if ('type' in obj && 'value' in obj && Object.keys(obj).length === 2) {
      return createValue(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(createObject);
    }
    const result: Record<string, unknown> = {};
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
  const cases = fixtures.typed_text.cases as TypedTextCase[];

  for (const testCase of cases) {
    // Skip Decimal and Time tests - TS/JS doesn't have native types
    if (testCase.input.type === 'decimal' || testCase.input.type === 'time') {
      continue;
    }

    it(`as_typed_text(${JSON.stringify(testCase.input)}) = "${testCase.expected}"`, () => {
      const value = createValue(testCase.input) as import('../src/types.js').TytxValue;
      const result = registry.asTypedText(value);
      expect(result).toBe(testCase.expected);
    });
  }
});

describe('Cross-language: from_text', () => {
  const cases = fixtures.from_text.cases as FromTextCase[];

  for (const testCase of cases) {
    // Skip Decimal and Time tests - TS/JS doesn't have native types
    if (testCase.expected.type === 'decimal' || testCase.expected.type === 'time') {
      continue;
    }

    it(`from_text("${testCase.input}")`, () => {
      const result = registry.fromText(testCase.input);
      const expectedSpec = testCase.expected;

      switch (expectedSpec.type) {
        case 'int':
          expect(typeof result).toBe('number');
          expect(result).toBe(expectedSpec.value);
          break;
        case 'float':
          expect(typeof result).toBe('number');
          expect(result).toBeCloseTo(expectedSpec.value as number, 4);
          break;
        case 'bool':
          expect(typeof result).toBe('boolean');
          expect(result).toBe(expectedSpec.value);
          break;
        case 'string':
          expect(typeof result).toBe('string');
          expect(result).toBe(expectedSpec.value);
          break;
        case 'date':
          expect(result).toBeInstanceOf(Date);
          expect((result as Date).toISOString().slice(0, 10)).toBe(expectedSpec.value);
          break;
        case 'datetime':
          expect(result).toBeInstanceOf(Date);
          // Remove Z suffix from expected value for comparison
          expect((result as Date).toISOString().slice(0, 19)).toBe((expectedSpec.value as string).replace('Z', ''));
          break;
      }
    });
  }
});

describe('Cross-language: typed_json', () => {
  const cases = fixtures.typed_json.cases as TypedJsonCase[];

  for (const testCase of cases) {
    const name = testCase.name || 'unnamed';

    it(`as_typed_json: ${name}`, () => {
      const inputObj = createObject(testCase.input);
      const expected = testCase.expected;

      const resultStr = asTypedJson(inputObj);
      const result = JSON.parse(resultStr);

      expect(result).toEqual(expected);
    });
  }
});

describe('Cross-language: json_roundtrip', () => {
  const cases = fixtures.json_roundtrip.cases as RoundtripCase[];

  for (const testCase of cases) {
    const name = testCase.name || 'unnamed';

    it(`roundtrip: ${name}`, () => {
      const inputObj = createObject(testCase.input);

      const jsonStr = asTypedJson(inputObj);
      const result = fromJson(jsonStr);

      assertEqualTyped(result, inputObj, name);
    });
  }
});

/**
 * Assert two values are equal with correct types.
 */
function assertEqualTyped(result: unknown, expected: unknown, name: string): void {
  if (expected instanceof Date) {
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe(expected.toISOString());
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      assertEqualTyped((result as unknown[])[i], expected[i], `${name}[${i}]`);
    }
  } else if (expected && typeof expected === 'object') {
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    const expectedKeys = Object.keys(expected);
    const resultKeys = Object.keys(result as object);
    expect(new Set(resultKeys)).toEqual(new Set(expectedKeys));
    for (const k of expectedKeys) {
      assertEqualTyped(
        (result as Record<string, unknown>)[k],
        (expected as Record<string, unknown>)[k],
        `${name}.${k}`
      );
    }
  } else if (typeof expected === 'number') {
    expect(typeof result).toBe('number');
    expect(result).toBeCloseTo(expected, 4);
  } else {
    expect(result).toBe(expected);
  }
}

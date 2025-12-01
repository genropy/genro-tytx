/**
 * Tests for TYTX validation system (TypeScript).
 *
 * Tests cover:
 * - ValidationRegistry basic operations
 * - Standard validations (33 patterns)
 * - Boolean expression operators (!&|)
 * - Resolution order (local > global > registry)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationRegistry,
  ValidationDef,
  STANDARD_VALIDATIONS,
  validationRegistry,
  createValidationRegistry,
} from '../src/validation.js';

describe('ValidationRegistry basic operations', () => {
  it('register and get', () => {
    const registry = new ValidationRegistry();
    const definition: ValidationDef = {
      pattern: '^[A-Z]+$',
      message: 'Must be uppercase',
    };
    registry.register('test_upper', definition);

    const result = registry.get('test_upper');
    expect(result).toBeDefined();
    expect(result?.pattern).toBe('^[A-Z]+$');
    expect(result?.message).toBe('Must be uppercase');
  });

  it('unregister removes validation', () => {
    const registry = new ValidationRegistry();
    registry.register('temp', { pattern: '.*' });
    expect(registry.get('temp')).toBeDefined();

    registry.unregister('temp');
    expect(registry.get('temp')).toBeUndefined();
  });

  it('listValidations returns all names', () => {
    const registry = new ValidationRegistry();
    registry.register('a', { pattern: 'a' });
    registry.register('b', { pattern: 'b' });
    registry.register('c', { pattern: 'c' });

    const names = registry.listValidations();
    expect(new Set(names)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('get returns undefined for unknown', () => {
    const registry = new ValidationRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });
});

describe('ValidationRegistry.validate()', () => {
  it('pattern validation passes', () => {
    const registry = new ValidationRegistry();
    registry.register('upper', { pattern: '^[A-Z]+$' });

    expect(registry.validate('ABC', 'upper')).toBe(true);
  });

  it('pattern validation fails', () => {
    const registry = new ValidationRegistry();
    registry.register('upper', { pattern: '^[A-Z]+$' });

    expect(registry.validate('abc', 'upper')).toBe(false);
  });

  it('len validation passes', () => {
    const registry = new ValidationRegistry();
    registry.register('len5', { len: 5 });

    expect(registry.validate('12345', 'len5')).toBe(true);
  });

  it('len validation fails', () => {
    const registry = new ValidationRegistry();
    registry.register('len5', { len: 5 });

    expect(registry.validate('1234', 'len5')).toBe(false);
    expect(registry.validate('123456', 'len5')).toBe(false);
  });

  it('min validation', () => {
    const registry = new ValidationRegistry();
    registry.register('min3', { min: 3 });

    expect(registry.validate('abc', 'min3')).toBe(true);
    expect(registry.validate('abcd', 'min3')).toBe(true);
    expect(registry.validate('ab', 'min3')).toBe(false);
  });

  it('max validation', () => {
    const registry = new ValidationRegistry();
    registry.register('max5', { max: 5 });

    expect(registry.validate('abc', 'max5')).toBe(true);
    expect(registry.validate('abcde', 'max5')).toBe(true);
    expect(registry.validate('abcdef', 'max5')).toBe(false);
  });

  it('combined constraints', () => {
    const registry = new ValidationRegistry();
    registry.register('strict', {
      pattern: '^[A-Z]+$',
      len: 3,
    });

    expect(registry.validate('ABC', 'strict')).toBe(true);
    expect(registry.validate('AB', 'strict')).toBe(false);
    expect(registry.validate('abc', 'strict')).toBe(false);
    expect(registry.validate('ABCD', 'strict')).toBe(false);
  });

  it('unknown validation throws', () => {
    const registry = new ValidationRegistry();

    expect(() => registry.validate('test', 'nonexistent')).toThrow(/not found/);
  });
});

describe('Boolean expressions (!&|)', () => {
  let registry: ValidationRegistry;

  beforeEach(() => {
    registry = new ValidationRegistry();
    registry.register('upper', { pattern: '^[A-Z]+$' });
    registry.register('lower', { pattern: '^[a-z]+$' });
    registry.register('numeric', { pattern: '^[0-9]+$' });
    registry.register('alpha', { pattern: '^[a-zA-Z]+$' });
    registry.register('len3', { len: 3 });
  });

  it('single validation', () => {
    expect(registry.validateExpression('ABC', 'upper')).toBe(true);
    expect(registry.validateExpression('abc', 'upper')).toBe(false);
  });

  it('AND operator - all pass', () => {
    expect(registry.validateExpression('ABC', 'upper&len3')).toBe(true);
  });

  it('AND operator - one fails', () => {
    expect(registry.validateExpression('ABCD', 'upper&len3')).toBe(false);
    expect(registry.validateExpression('abc', 'upper&len3')).toBe(false);
  });

  it('OR operator - one passes', () => {
    expect(registry.validateExpression('ABC', 'upper|lower')).toBe(true);
    expect(registry.validateExpression('abc', 'upper|lower')).toBe(true);
  });

  it('OR operator - all fail', () => {
    expect(registry.validateExpression('123', 'upper|lower')).toBe(false);
  });

  it('NOT operator', () => {
    expect(registry.validateExpression('abc', '!upper')).toBe(true);
    expect(registry.validateExpression('ABC', '!upper')).toBe(false);
  });

  it('NOT with AND: !a&b = (!a) AND b', () => {
    expect(registry.validateExpression('abc', '!upper&lower')).toBe(true);
    expect(registry.validateExpression('ABC', '!upper&lower')).toBe(false);
    expect(registry.validateExpression('123', '!upper&lower')).toBe(false);
  });

  it('NOT with OR: !a|b = (!a) OR b', () => {
    expect(registry.validateExpression('abc', '!upper|numeric')).toBe(true);
    expect(registry.validateExpression('123', '!upper|numeric')).toBe(true);
    expect(registry.validateExpression('ABC', '!upper|numeric')).toBe(false);
  });

  it('complex expression: a&b|c&d', () => {
    expect(registry.validateExpression('ABC', 'upper&len3|lower&len3')).toBe(true);
    expect(registry.validateExpression('abc', 'upper&len3|lower&len3')).toBe(true);
    expect(registry.validateExpression('ABCD', 'upper&len3|lower&len3')).toBe(false);
    expect(registry.validateExpression('abcd', 'upper&len3|lower&len3')).toBe(false);
  });

  it('precedence: NOT highest', () => {
    expect(registry.validateExpression('abc', '!upper&alpha')).toBe(true);
    expect(registry.validateExpression('ABC', '!upper&alpha')).toBe(false);
  });

  it('precedence: AND before OR', () => {
    expect(registry.validateExpression('ABC', 'upper|lower&len3')).toBe(true);
    expect(registry.validateExpression('abcd', 'upper|lower&len3')).toBe(false);
    expect(registry.validateExpression('abc', 'upper|lower&len3')).toBe(true);
  });

  it('whitespace in expression', () => {
    expect(registry.validateExpression('ABC', ' upper & len3 ')).toBe(true);
    expect(registry.validateExpression('abc', ' upper | lower ')).toBe(true);
    expect(registry.validateExpression('abc', ' ! upper ')).toBe(true);
  });
});

describe('Resolution order: local > global > registry', () => {
  it('local overrides global', () => {
    const registry = new ValidationRegistry();
    registry.register('test', { pattern: '^REGISTRY$' });

    const globalValidations: Record<string, ValidationDef> = {
      test: { pattern: '^GLOBAL$' },
    };
    const localValidations: Record<string, ValidationDef> = {
      test: { pattern: '^LOCAL$' },
    };

    expect(registry.validate('LOCAL', 'test', localValidations, globalValidations)).toBe(true);
    expect(registry.validate('GLOBAL', 'test', localValidations, globalValidations)).toBe(false);
  });

  it('global overrides registry', () => {
    const registry = new ValidationRegistry();
    registry.register('test', { pattern: '^REGISTRY$' });

    const globalValidations: Record<string, ValidationDef> = {
      test: { pattern: '^GLOBAL$' },
    };

    expect(registry.validate('GLOBAL', 'test', null, globalValidations)).toBe(true);
    expect(registry.validate('REGISTRY', 'test', null, globalValidations)).toBe(false);
  });

  it('registry fallback', () => {
    const registry = new ValidationRegistry();
    registry.register('test', { pattern: '^REGISTRY$' });

    expect(registry.validate('REGISTRY', 'test')).toBe(true);
  });

  it('expression with local validations', () => {
    const registry = new ValidationRegistry();

    const localValidations: Record<string, ValidationDef> = {
      a: { pattern: '^[A-Z]+$' },
      b: { pattern: '^.{3}$' },
    };

    expect(registry.validateExpression('ABC', 'a&b', localValidations)).toBe(true);
    expect(registry.validateExpression('ABCD', 'a&b', localValidations)).toBe(false);
  });
});

describe('Standard validations', () => {
  it('33 standard validations defined', () => {
    expect(Object.keys(STANDARD_VALIDATIONS).length).toBe(33);
  });

  it('global registry has standard validations', () => {
    expect(validationRegistry.listValidations().length).toBe(33);
  });

  it('createValidationRegistry includes standard by default', () => {
    const registry = createValidationRegistry();
    expect(registry.listValidations().length).toBe(33);
  });

  it('createValidationRegistry can exclude standard', () => {
    const registry = createValidationRegistry(false);
    expect(registry.listValidations().length).toBe(0);
  });

  // Internet & Communication
  it('email valid', () => {
    expect(validationRegistry.validate('test@example.com', 'email')).toBe(true);
    expect(validationRegistry.validate('user.name+tag@domain.co.uk', 'email')).toBe(true);
  });

  it('email invalid', () => {
    expect(validationRegistry.validate('invalid', 'email')).toBe(false);
    expect(validationRegistry.validate('@domain.com', 'email')).toBe(false);
  });

  it('url valid', () => {
    expect(validationRegistry.validate('https://example.com', 'url')).toBe(true);
    expect(validationRegistry.validate('http://example.com/path?q=1', 'url')).toBe(true);
  });

  it('url invalid', () => {
    expect(validationRegistry.validate('ftp://example.com', 'url')).toBe(false);
    expect(validationRegistry.validate('example.com', 'url')).toBe(false);
  });

  it('domain valid', () => {
    expect(validationRegistry.validate('example.com', 'domain')).toBe(true);
    expect(validationRegistry.validate('sub.example.co.uk', 'domain')).toBe(true);
  });

  it('ipv4 valid', () => {
    expect(validationRegistry.validate('192.168.1.1', 'ipv4')).toBe(true);
    expect(validationRegistry.validate('255.255.255.255', 'ipv4')).toBe(true);
  });

  it('ipv4 invalid', () => {
    expect(validationRegistry.validate('256.1.1.1', 'ipv4')).toBe(false);
    expect(validationRegistry.validate('192.168.1', 'ipv4')).toBe(false);
  });

  it('phone valid', () => {
    expect(validationRegistry.validate('+393331234567', 'phone')).toBe(true);
    expect(validationRegistry.validate('393331234567', 'phone')).toBe(true);
  });

  // Identifiers
  it('uuid v4 valid', () => {
    expect(validationRegistry.validate('550e8400-e29b-41d4-a716-446655440000', 'uuid')).toBe(true);
  });

  it('uuid v4 invalid (v1)', () => {
    expect(validationRegistry.validate('550e8400-e29b-11d4-a716-446655440000', 'uuid')).toBe(false);
  });

  it('uuid_any valid', () => {
    expect(validationRegistry.validate('550e8400-e29b-11d4-a716-446655440000', 'uuid_any')).toBe(
      true,
    );
  });

  it('slug valid', () => {
    expect(validationRegistry.validate('my-post-title', 'slug')).toBe(true);
    expect(validationRegistry.validate('post123', 'slug')).toBe(true);
  });

  it('slug invalid', () => {
    expect(validationRegistry.validate('My-Post', 'slug')).toBe(false);
    expect(validationRegistry.validate('my_post', 'slug')).toBe(false);
  });

  // Italian Fiscal
  it('cf valid', () => {
    expect(validationRegistry.validate('RSSMRA85M01H501X', 'cf')).toBe(true);
  });

  it('cf invalid', () => {
    expect(validationRegistry.validate('RSSMRA85M01H501', 'cf')).toBe(false);
    expect(validationRegistry.validate('rssmra85m01h501x', 'cf')).toBe(false);
  });

  it('piva valid', () => {
    expect(validationRegistry.validate('12345678901', 'piva')).toBe(true);
  });

  it('piva invalid', () => {
    expect(validationRegistry.validate('1234567890', 'piva')).toBe(false);
    expect(validationRegistry.validate('123456789012', 'piva')).toBe(false);
  });

  it('cap_it valid', () => {
    expect(validationRegistry.validate('00100', 'cap_it')).toBe(true);
    expect(validationRegistry.validate('20100', 'cap_it')).toBe(true);
  });

  it('cap_it invalid', () => {
    expect(validationRegistry.validate('0010', 'cap_it')).toBe(false);
    expect(validationRegistry.validate('001000', 'cap_it')).toBe(false);
  });

  // European Standards
  it('iban valid', () => {
    expect(validationRegistry.validate('IT60X0542811101000000123456', 'iban')).toBe(true);
  });

  it('bic valid', () => {
    expect(validationRegistry.validate('DEUTDEFF', 'bic')).toBe(true);
    expect(validationRegistry.validate('DEUTDEFF500', 'bic')).toBe(true);
  });

  it('vat_eu valid', () => {
    expect(validationRegistry.validate('IT12345678901', 'vat_eu')).toBe(true);
    expect(validationRegistry.validate('DE123456789', 'vat_eu')).toBe(true);
  });

  // Text Constraints
  it('latin valid', () => {
    expect(validationRegistry.validate('Hello World 123!', 'latin')).toBe(true);
  });

  it('latin invalid', () => {
    expect(validationRegistry.validate('Héllo', 'latin')).toBe(false);
  });

  it('uppercase valid', () => {
    expect(validationRegistry.validate('HELLO', 'uppercase')).toBe(true);
  });

  it('uppercase invalid', () => {
    expect(validationRegistry.validate('Hello', 'uppercase')).toBe(false);
  });

  it('lowercase valid', () => {
    expect(validationRegistry.validate('hello', 'lowercase')).toBe(true);
  });

  it('alphanumeric valid', () => {
    expect(validationRegistry.validate('Hello123', 'alphanumeric')).toBe(true);
  });

  it('alphanumeric invalid', () => {
    expect(validationRegistry.validate('Hello-123', 'alphanumeric')).toBe(false);
  });

  it('no_spaces valid', () => {
    expect(validationRegistry.validate('HelloWorld', 'no_spaces')).toBe(true);
  });

  it('no_spaces invalid', () => {
    expect(validationRegistry.validate('Hello World', 'no_spaces')).toBe(false);
  });

  it('single_line valid', () => {
    expect(validationRegistry.validate('Hello World!', 'single_line')).toBe(true);
  });

  it('single_line invalid', () => {
    expect(validationRegistry.validate('Hello\nWorld', 'single_line')).toBe(false);
  });

  // Numeric Formats
  it('positive_int valid', () => {
    expect(validationRegistry.validate('123', 'positive_int')).toBe(true);
    expect(validationRegistry.validate('1', 'positive_int')).toBe(true);
  });

  it('positive_int invalid', () => {
    expect(validationRegistry.validate('0', 'positive_int')).toBe(false);
    expect(validationRegistry.validate('-1', 'positive_int')).toBe(false);
  });

  it('non_negative_int valid', () => {
    expect(validationRegistry.validate('0', 'non_negative_int')).toBe(true);
    expect(validationRegistry.validate('123', 'non_negative_int')).toBe(true);
  });

  it('decimal valid', () => {
    expect(validationRegistry.validate('123.45', 'decimal')).toBe(true);
    expect(validationRegistry.validate('-123.45', 'decimal')).toBe(true);
    expect(validationRegistry.validate('123', 'decimal')).toBe(true);
  });

  it('percentage valid', () => {
    expect(validationRegistry.validate('0', 'percentage')).toBe(true);
    expect(validationRegistry.validate('50.5', 'percentage')).toBe(true);
    expect(validationRegistry.validate('100', 'percentage')).toBe(true);
  });

  it('percentage invalid', () => {
    expect(validationRegistry.validate('101', 'percentage')).toBe(false);
  });

  // Date & Time Formats
  it('iso_date valid', () => {
    expect(validationRegistry.validate('2025-01-15', 'iso_date')).toBe(true);
  });

  it('iso_date invalid', () => {
    expect(validationRegistry.validate('2025-13-01', 'iso_date')).toBe(false);
    expect(validationRegistry.validate('2025/01/15', 'iso_date')).toBe(false);
  });

  it('iso_datetime valid', () => {
    expect(validationRegistry.validate('2025-01-15T10:30:00Z', 'iso_datetime')).toBe(true);
    expect(validationRegistry.validate('2025-01-15T10:30:00+01:00', 'iso_datetime')).toBe(true);
  });

  it('time valid', () => {
    expect(validationRegistry.validate('10:30', 'time')).toBe(true);
    expect(validationRegistry.validate('10:30:45', 'time')).toBe(true);
  });

  it('time invalid', () => {
    expect(validationRegistry.validate('25:00', 'time')).toBe(false);
  });

  it('year valid', () => {
    expect(validationRegistry.validate('2025', 'year')).toBe(true);
  });

  it('year invalid', () => {
    expect(validationRegistry.validate('25', 'year')).toBe(false);
    expect(validationRegistry.validate('20250', 'year')).toBe(false);
  });

  // Security
  it('password_strong valid', () => {
    expect(validationRegistry.validate('MyP@ss123', 'password_strong')).toBe(true);
  });

  it('password_strong invalid', () => {
    expect(validationRegistry.validate('password', 'password_strong')).toBe(false);
    expect(validationRegistry.validate('Password1', 'password_strong')).toBe(false);
  });

  it('hex valid', () => {
    expect(validationRegistry.validate('0123456789abcdefABCDEF', 'hex')).toBe(true);
  });

  it('hex invalid', () => {
    expect(validationRegistry.validate('0123456789abcdefg', 'hex')).toBe(false);
  });

  it('base64 valid', () => {
    expect(validationRegistry.validate('SGVsbG8gV29ybGQ=', 'base64')).toBe(true);
  });

  it('base64 invalid', () => {
    expect(validationRegistry.validate('Hello World!', 'base64')).toBe(false);
  });
});

describe('Real-world validation expressions', () => {
  it('CF or PIVA', () => {
    expect(validationRegistry.validateExpression('RSSMRA85M01H501X', 'cf|piva')).toBe(true);
    expect(validationRegistry.validateExpression('12345678901', 'cf|piva')).toBe(true);
    expect(validationRegistry.validateExpression('invalid', 'cf|piva')).toBe(false);
  });

  it('latin AND uppercase', () => {
    expect(validationRegistry.validateExpression('HELLO', 'latin&uppercase')).toBe(true);
    expect(validationRegistry.validateExpression('hello', 'latin&uppercase')).toBe(false);
    expect(validationRegistry.validateExpression('HÉLLO', 'latin&uppercase')).toBe(false);
  });

  it('NOT numeric', () => {
    expect(validationRegistry.validateExpression('abc', '!positive_int')).toBe(true);
    expect(validationRegistry.validateExpression('123', '!positive_int')).toBe(false);
  });

  it('email OR phone', () => {
    expect(validationRegistry.validateExpression('test@example.com', 'email|phone')).toBe(true);
    expect(validationRegistry.validateExpression('+393331234567', 'email|phone')).toBe(true);
    expect(validationRegistry.validateExpression('invalid', 'email|phone')).toBe(false);
  });
});

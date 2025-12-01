/**
 * Tests for XTYTX extended envelope format (TypeScript).
 *
 * Tests cover:
 * - Basic XTYTX parsing
 * - gvalidation (global validation registration)
 * - lvalidation (local validation definitions)
 * - Validation precedence (local > global > registry)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { fromJson, registry, validationRegistry } from '../src/index.js';
import type { XtytxResult } from '../src/index.js';

describe('XTYTX basic parsing', () => {
  it('detects XTYTX:// prefix and returns XtytxResult', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('globalValidations');
    expect(result).toHaveProperty('localValidations');
    expect(result.data).toBeNull();
  });

  it('TYTX:// prefix still works', () => {
    const payload = 'TYTX://{"price": "100::L"}';
    const result = fromJson(payload);
    expect(result).toEqual({ price: 100 });
  });

  it('regular JSON still works', () => {
    const payload = '{"price": "100::L"}';
    const result = fromJson(payload);
    expect(result).toEqual({ price: 100 });
  });
});

describe('XTYTX gvalidation', () => {
  afterEach(() => {
    // Clean up registered validations
    try {
      validationRegistry.unregister('xtest_email');
      validationRegistry.unregister('xmy_val');
      validationRegistry.unregister('xpersist_val');
      validationRegistry.unregister('xval_a');
      validationRegistry.unregister('xval_b');
    } catch {
      // Ignore errors if validation doesn't exist
    }
  });

  it('gvalidation registers globally', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xtest_email": {"pattern": "^[^@]+@[^@]+$", "message": "Invalid email"}}, "lvalidation": {}, "data": ""}';
    fromJson(payload);

    // Validation should be registered
    expect(validationRegistry.get('xtest_email')).not.toBeUndefined();
    expect(validationRegistry.get('xtest_email')?.pattern).toBe('^[^@]+@[^@]+$');

    // Validate works
    expect(validationRegistry.validate('test@example.com', 'xtest_email')).toBe(true);
    expect(validationRegistry.validate('invalid', 'xtest_email')).toBe(false);
  });

  it('gvalidation returned in result', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xmy_val": {"pattern": "^ABC$"}}, "lvalidation": {}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;

    expect(result.globalValidations).not.toBeNull();
    expect(result.globalValidations?.['xmy_val']).toBeDefined();
    expect(result.globalValidations?.['xmy_val'].pattern).toBe('^ABC$');
  });

  it('gvalidation persists after decoding', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xpersist_val": {"pattern": "^[A-Z]+$"}}, "lvalidation": {}, "data": ""}';
    fromJson(payload);

    // Should still exist
    expect(validationRegistry.get('xpersist_val')).not.toBeUndefined();
    // Can use in subsequent validations
    expect(validationRegistry.validate('ABC', 'xpersist_val')).toBe(true);
  });

  it('multiple validations registered at once', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xval_a": {"pattern": "^A"}, "xval_b": {"pattern": "^B"}}, "lvalidation": {}, "data": ""}';
    fromJson(payload);

    expect(validationRegistry.get('xval_a')).not.toBeUndefined();
    expect(validationRegistry.get('xval_b')).not.toBeUndefined();
  });
});

describe('XTYTX lvalidation', () => {
  it('lvalidation NOT registered globally', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {}, "lvalidation": {"xlocal_val": {"pattern": "^LOCAL$"}}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;

    // Should NOT be in global registry
    expect(validationRegistry.get('xlocal_val')).toBeUndefined();

    // But should be in result
    expect(result.localValidations).not.toBeNull();
    expect(result.localValidations?.['xlocal_val']).toBeDefined();
  });

  it('lvalidation returned in result', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {}, "lvalidation": {"xtemp_val": {"pattern": "^[0-9]+$", "message": "Numbers only"}}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;

    expect(result.localValidations).not.toBeNull();
    expect(result.localValidations?.['xtemp_val']).toBeDefined();
    expect(result.localValidations?.['xtemp_val'].message).toBe('Numbers only');
  });

  it('lvalidation can be used with validate()', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {}, "lvalidation": {"xnum_only": {"pattern": "^[0-9]+$"}}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;

    // Use local_validations in validate
    expect(
      validationRegistry.validate('12345', 'xnum_only', result.localValidations),
    ).toBe(true);
    expect(
      validationRegistry.validate('abc', 'xnum_only', result.localValidations),
    ).toBe(false);
  });
});

describe('XTYTX validation precedence', () => {
  afterEach(() => {
    try {
      validationRegistry.unregister('xprec');
      validationRegistry.unregister('xexisting_val');
    } catch {
      // Ignore
    }
  });

  it('lvalidation overrides gvalidation', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xprec": {"pattern": "^GLOBAL$"}}, "lvalidation": {"xprec": {"pattern": "^LOCAL$"}}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;

    // Using local_validations should use LOCAL pattern
    expect(
      validationRegistry.validate(
        'LOCAL',
        'xprec',
        result.localValidations,
        result.globalValidations,
      ),
    ).toBe(true);
    expect(
      validationRegistry.validate(
        'GLOBAL',
        'xprec',
        result.localValidations,
        result.globalValidations,
      ),
    ).toBe(false);

    // But global registry has GLOBAL pattern (gvalidation was registered)
    expect(validationRegistry.validate('GLOBAL', 'xprec')).toBe(true);
  });

  it('gvalidation overrides registry', () => {
    // Pre-register a validation
    validationRegistry.register('xexisting_val', { pattern: '^REGISTRY$' });

    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xexisting_val": {"pattern": "^GVALIDATION$"}}, "lvalidation": {}, "data": ""}';
    fromJson(payload);

    // gvalidation should have overwritten
    expect(validationRegistry.validate('GVALIDATION', 'xexisting_val')).toBe(true);
    expect(validationRegistry.validate('REGISTRY', 'xexisting_val')).toBe(false);
  });
});

describe('XTYTX validation with data', () => {
  afterEach(() => {
    try {
      validationRegistry.unregister('xcode');
      validationRegistry.unregister('xupper');
      validationRegistry.unregister('xshort');
    } catch {
      // Ignore
    }
  });

  it('complete envelope with validations and data', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xcode": {"pattern": "^[A-Z]{3}$", "len": 3}}, "lvalidation": {}, "data": "{\\"code\\": \\"ABC\\"}"}';
    const result = fromJson(payload) as XtytxResult;

    expect(result.data).toEqual({ code: 'ABC' });

    // Validation is available
    expect(validationRegistry.validate('ABC', 'xcode')).toBe(true);
    expect(validationRegistry.validate('ABCD', 'xcode')).toBe(false); // too long
    expect(validationRegistry.validate('abc', 'xcode')).toBe(false); // lowercase
  });

  it('boolean expressions work with gvalidation', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xupper": {"pattern": "^[A-Z]+$"}, "xshort": {"max": 5}}, "lvalidation": {}, "data": ""}';
    fromJson(payload);

    // AND expression
    expect(validationRegistry.validateExpression('ABC', 'xupper&xshort')).toBe(true);
    expect(validationRegistry.validateExpression('ABCDEF', 'xupper&xshort')).toBe(false); // too long
    expect(validationRegistry.validateExpression('abc', 'xupper&xshort')).toBe(false); // lowercase
  });

  it('optional validation fields', () => {
    // Without gvalidation/lvalidation fields
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": "{\\"x\\": 1}"}';
    const result = fromJson(payload) as XtytxResult;

    expect(result.data).toEqual({ x: 1 });
    expect(result.globalValidations).toBeNull();
    expect(result.localValidations).toBeNull();
  });
});

describe('XTYTX gstruct', () => {
  afterEach(() => {
    try {
      registry.unregister_struct('XCUSTOMER');
    } catch {
      // Ignore
    }
  });

  it('gstruct registers struct globally', () => {
    const payload = 'XTYTX://{"gstruct": {"XCUSTOMER": {"name": "T", "balance": "N"}}, "lstruct": {}, "data": ""}';
    fromJson(payload);

    // Struct should be registered
    expect(registry.get_struct('XCUSTOMER')).not.toBeUndefined();
    expect(registry.get_struct('XCUSTOMER')).toEqual({ name: 'T', balance: 'N' });
  });
});

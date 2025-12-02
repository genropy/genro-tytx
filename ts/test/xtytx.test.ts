/**
 * Tests for XTYTX extended envelope format (TypeScript).
 *
 * Tests cover:
 * - Basic XTYTX parsing
 * - gschema (global JSON Schema registration)
 * - lschema (local JSON Schema definitions)
 * - Data hydration with schemas
 *
 * TYTX is a transport format, not a validator.
 * Validation is delegated to JSON Schema.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { fromJson, registry, schemaRegistry } from '../src/index.js';
import type { XtytxResult } from '../src/index.js';

describe('XTYTX basic parsing', () => {
  it('detects XTYTX:// prefix and returns XtytxResult', () => {
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": ""}';
    const result = fromJson(payload) as XtytxResult;
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('globalSchemas');
    expect(result).toHaveProperty('localSchemas');
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

describe('XTYTX gschema', () => {
  afterEach(() => {
    // Clean up registered schemas
    try {
      schemaRegistry.unregister('XCUSTOMER');
      schemaRegistry.unregister('XORDER');
      schemaRegistry.unregister('XSCHEMA_A');
      schemaRegistry.unregister('XSCHEMA_B');
    } catch {
      // Ignore errors if schema doesn't exist
    }
  });

  it('gschema registers globally', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: {
        XCUSTOMER: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
          required: ['name', 'email'],
        },
      },
      data: '',
    })}`;
    fromJson(payload);

    // Schema should be registered
    expect(schemaRegistry.get('XCUSTOMER')).not.toBeUndefined();
    expect(schemaRegistry.get('XCUSTOMER')?.type).toBe('object');
    expect(schemaRegistry.get('XCUSTOMER')?.properties).toBeDefined();
  });

  it('gschema returned in result', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: {
        XORDER: {
          type: 'object',
          properties: { id: { type: 'integer' } },
        },
      },
      data: '',
    })}`;
    const result = fromJson(payload) as XtytxResult;

    expect(result.globalSchemas).not.toBeNull();
    expect(result.globalSchemas?.['XORDER']).toBeDefined();
    expect(result.globalSchemas?.['XORDER'].type).toBe('object');
  });

  it('gschema persists after decoding', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: {
        XCUSTOMER: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
      data: '',
    })}`;
    fromJson(payload);

    // Should still exist
    expect(schemaRegistry.get('XCUSTOMER')).not.toBeUndefined();
  });

  it('multiple schemas registered at once', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: {
        XSCHEMA_A: { type: 'object' },
        XSCHEMA_B: { type: 'object' },
      },
      data: '',
    })}`;
    fromJson(payload);

    expect(schemaRegistry.get('XSCHEMA_A')).not.toBeUndefined();
    expect(schemaRegistry.get('XSCHEMA_B')).not.toBeUndefined();
  });
});

describe('XTYTX lschema', () => {
  it('lschema NOT registered globally', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      lschema: {
        XLOCAL_SCHEMA: { type: 'object' },
      },
      data: '',
    })}`;
    const result = fromJson(payload) as XtytxResult;

    // Should NOT be in global registry
    expect(schemaRegistry.get('XLOCAL_SCHEMA')).toBeUndefined();

    // But should be in result
    expect(result.localSchemas).not.toBeNull();
    expect(result.localSchemas?.['XLOCAL_SCHEMA']).toBeDefined();
  });

  it('lschema returned in result', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      lschema: {
        XTEMP_SCHEMA: {
          type: 'object',
          properties: { docId: { type: 'string', pattern: '^DOC-' } },
        },
      },
      data: '',
    })}`;
    const result = fromJson(payload) as XtytxResult;

    expect(result.localSchemas).not.toBeNull();
    expect(result.localSchemas?.['XTEMP_SCHEMA']).toBeDefined();
    expect((result.localSchemas?.['XTEMP_SCHEMA'] as Record<string, unknown>).properties).toBeDefined();
  });

  it('both gschema and lschema in result', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: { XGLOBAL: { type: 'object' } },
      lschema: { XLOCAL: { type: 'object' } },
      data: '',
    })}`;
    const result = fromJson(payload) as XtytxResult;

    expect(result.globalSchemas).not.toBeNull();
    expect(result.globalSchemas?.['XGLOBAL']).toBeDefined();
    expect(result.localSchemas).not.toBeNull();
    expect(result.localSchemas?.['XLOCAL']).toBeDefined();
  });
});

describe('XTYTX schema with data', () => {
  afterEach(() => {
    try {
      schemaRegistry.unregister('XORDER');
    } catch {
      // Ignore
    }
  });

  it('complete envelope with schemas and data', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: {
        XORDER: {
          type: 'object',
          properties: {
            code: { type: 'string', pattern: '^[A-Z]{3}$' },
            amount: { type: 'integer', minimum: 1 },
          },
        },
      },
      data: '{"code": "ABC", "amount": "100::L"}',
    })}`;
    const result = fromJson(payload) as XtytxResult;

    expect(result.data).toEqual({ code: 'ABC', amount: 100 });

    // Schema is available for external validation
    const schema = schemaRegistry.get('XORDER');
    expect(schema).not.toBeUndefined();
    expect((schema?.properties as Record<string, unknown>)?.amount).toBeDefined();
  });

  it('optional schema fields', () => {
    // Without gschema/lschema fields
    const payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": "{\\"x\\": 1}"}';
    const result = fromJson(payload) as XtytxResult;

    expect(result.data).toEqual({ x: 1 });
    expect(result.globalSchemas).toBeNull();
    expect(result.localSchemas).toBeNull();
  });

  it('schemas available for post-processing validation', () => {
    const payload = `XTYTX://${JSON.stringify({
      gstruct: {},
      lstruct: {},
      gschema: {
        XORDER: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            amount: { type: 'integer', minimum: 1 },
          },
        },
      },
      lschema: {
        XITEM: {
          type: 'object',
          properties: { sku: { type: 'string' } },
        },
      },
      data: '{"code": "ABC", "amount": "100::L"}',
    })}`;
    const result = fromJson(payload) as XtytxResult;

    // User can retrieve schemas for external validation (e.g., with Ajv)
    const orderSchema = schemaRegistry.get('XORDER');
    expect(orderSchema).not.toBeUndefined();

    // Local schema available in result
    expect(result.localSchemas?.['XITEM']).toBeDefined();
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

describe('SchemaRegistry', () => {
  afterEach(() => {
    try {
      schemaRegistry.unregister('test_schema');
    } catch {
      // Ignore
    }
  });

  it('register and get schema', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };
    schemaRegistry.register('test_schema', schema);

    const retrieved = schemaRegistry.get('test_schema');
    expect(retrieved).toEqual(schema);
  });

  it('unregister schema', () => {
    schemaRegistry.register('test_schema', { type: 'object' });
    expect(schemaRegistry.get('test_schema')).toBeDefined();

    schemaRegistry.unregister('test_schema');
    expect(schemaRegistry.get('test_schema')).toBeUndefined();
  });

  it('listSchemas returns all registered names', () => {
    schemaRegistry.register('test_schema', { type: 'object' });

    const names = schemaRegistry.listSchemas();
    expect(names).toContain('test_schema');
  });
});

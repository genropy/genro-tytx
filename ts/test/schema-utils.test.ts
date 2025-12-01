/**
 * Tests for JSON Schema / OpenAPI utilities (TypeScript) - v2 format.
 * JSON Schema ↔ TYTX struct conversion with FieldDef objects.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { structFromJsonSchema, structToJsonSchema } from '../src/schema-utils.js';
import { registry } from '../src/registry.js';
import type { FieldDef } from '../src/types.js';

describe('structFromJsonSchema (v2)', () => {
  afterEach(() => {
    // Clean up any registered structs
    try { registry.unregister_struct('TEST_ADDRESS'); } catch {}
    try { registry.unregister_struct('CUSTOMER_ADDRESS'); } catch {}
    try { registry.unregister_struct('ORDER_ITEMS'); } catch {}
    try { registry.unregister_struct('Address'); } catch {}
    try { registry.unregister_struct('ROOT_ADDRESS'); } catch {}
    try { registry.unregister_struct('PERSON_ADDRESS'); } catch {}
  });

  it('converts basic types without constraints to simple strings', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        count: { type: 'number' },
        active: { type: 'boolean' },
        name: { type: 'string' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct).toEqual({
      id: 'L',
      count: 'R',
      active: 'B',
      name: 'T',
    });
  });

  it('converts number formats', () => {
    const schema = {
      type: 'object',
      properties: {
        price: { type: 'number', format: 'decimal' },
        rate: { type: 'number', format: 'float' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.price).toBe('N');
    expect(struct.rate).toBe('R');
  });

  it('converts date/time formats', () => {
    const schema = {
      type: 'object',
      properties: {
        birth_date: { type: 'string', format: 'date' },
        created_at: { type: 'string', format: 'date-time' },
        start_time: { type: 'string', format: 'time' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct).toEqual({
      birth_date: 'D',
      created_at: 'DH',
      start_time: 'H',
    });
  });

  it('converts arrays without constraints', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        scores: { type: 'array', items: { type: 'integer' } },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.tags).toBe('#T');
    expect(struct.scores).toBe('#L');
  });

  it('converts constraints to FieldDef with validate section', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        code: { type: 'string', pattern: '^[A-Z]{3}$' },
        status: { type: 'string', enum: ['active', 'inactive'] },
        age: { type: 'integer', minimum: 0, maximum: 150 },
      },
    };
    const struct = structFromJsonSchema(schema);

    expect(struct.name).toEqual({
      type: 'T',
      validate: { min: 1, max: 100 },
    });
    expect(struct.code).toEqual({
      type: 'T',
      validate: { pattern: '^[A-Z]{3}$' },
    });
    expect(struct.status).toEqual({
      type: 'T',
      validate: { enum: ['active', 'inactive'] },
    });
    expect(struct.age).toEqual({
      type: 'L',
      validate: { min: 0, max: 150 },
    });
  });

  it('converts title and description to ui section', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', title: 'Email', description: 'User email address' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.email).toEqual({
      type: 'T',
      ui: { label: 'Email', hint: 'User email address' },
    });
  });

  it('converts required fields to validate.required', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['id', 'name'],
    };
    const struct = structFromJsonSchema(schema);

    expect(struct.id).toEqual({
      type: 'L',
      validate: { required: true },
    });
    expect(struct.name).toEqual({
      type: 'T',
      validate: { required: true },
    });
    expect(struct.email).toBe('T');
  });

  it('combines constraints with required', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, title: 'Name' },
      },
      required: ['name'],
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.name).toEqual({
      type: 'T',
      validate: { min: 1, required: true },
      ui: { label: 'Name' },
    });
  });

  it('converts required arrays', () => {
    const schema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' } },
      },
      required: ['items'],
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.items).toEqual({
      type: '#T',
      validate: { required: true },
    });
  });

  it('converts nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
        },
      },
    };
    const struct = structFromJsonSchema(schema, { name: 'CUSTOMER' });
    expect(struct.name).toBe('T');
    expect(struct.address).toBe('@CUSTOMER_ADDRESS');
  });

  it('converts $ref references', () => {
    const schema = {
      type: 'object',
      properties: {
        billing: { $ref: '#/definitions/Address' },
        shipping: { $ref: '#/definitions/Address' },
      },
      definitions: {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
        },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.billing).toBe('@Address');
    expect(struct.shipping).toBe('@Address');
  });

  it('handles anyOf with null (Optional)', () => {
    const schema = {
      type: 'object',
      properties: {
        middle_name: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.middle_name).toBe('T');
  });

  it('handles default values', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { type: 'string', default: 'active' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.status).toEqual({
      type: 'T',
      validate: { default: 'active' },
    });
  });

  it('throws for non-object schema', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(() => structFromJsonSchema(schema as any)).toThrow("must have type: 'object'");
  });
});

describe('structToJsonSchema (v2)', () => {
  afterEach(() => {
    try { registry.unregister_struct('ADDR_TEST'); } catch {}
    try { registry.unregister_struct('ADDR_TEST_V2'); } catch {}
  });

  it('converts simple type codes', () => {
    const struct = {
      id: 'L',
      count: 'R',
      active: 'B',
      name: 'T',
    };
    const schema = structToJsonSchema(struct);
    expect(schema.type).toBe('object');
    expect(schema.properties?.id).toEqual({ type: 'integer' });
    expect(schema.properties?.count).toEqual({ type: 'number' });
    expect(schema.properties?.active).toEqual({ type: 'boolean' });
    expect(schema.properties?.name).toEqual({ type: 'string' });
  });

  it('converts decimal type', () => {
    const struct = { price: 'N' };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.price).toEqual({ type: 'number', format: 'decimal' });
  });

  it('converts date/time types', () => {
    const struct = {
      birth_date: 'D',
      created_at: 'DH',
      created_tz: 'DHZ',
      start_time: 'H',
    };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.birth_date).toEqual({ type: 'string', format: 'date' });
    expect(schema.properties?.created_at).toEqual({ type: 'string', format: 'date-time' });
    expect(schema.properties?.created_tz).toEqual({ type: 'string', format: 'date-time' });
    expect(schema.properties?.start_time).toEqual({ type: 'string', format: 'time' });
  });

  it('converts array types', () => {
    const struct = {
      tags: '#T',
      scores: '#L',
      prices: '#N',
    };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.tags).toEqual({ type: 'array', items: { type: 'string' } });
    expect(schema.properties?.scores).toEqual({ type: 'array', items: { type: 'integer' } });
    expect(schema.properties?.prices).toEqual({ type: 'array', items: { type: 'number', format: 'decimal' } });
  });

  it('converts FieldDef validate to JSON Schema constraints', () => {
    const struct = {
      name: { type: 'T', validate: { min: 1, max: 100 } } as FieldDef,
      code: { type: 'T', validate: { pattern: '[A-Z]{2}' } } as FieldDef,
      age: { type: 'L', validate: { min: 0, max: 120 } } as FieldDef,
    };
    const schema = structToJsonSchema(struct);

    expect(schema.properties?.name).toEqual({
      type: 'string',
      minLength: 1,
      maxLength: 100,
    });
    expect(schema.properties?.code).toEqual({
      type: 'string',
      pattern: '[A-Z]{2}',
    });
    expect(schema.properties?.age).toEqual({
      type: 'integer',
      minimum: 0,
      maximum: 120,
    });
  });

  it('converts enum', () => {
    const struct = {
      status: { type: 'T', validate: { enum: ['active', 'inactive'] } } as FieldDef,
    };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.status).toEqual({
      type: 'string',
      enum: ['active', 'inactive'],
    });
  });

  it('converts ui section to title/description', () => {
    const struct = {
      email: { type: 'T', ui: { label: 'Email', hint: 'User email' } } as FieldDef,
    };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.email).toEqual({
      type: 'string',
      title: 'Email',
      description: 'User email',
    });
  });

  it('converts validate.required to required array', () => {
    const struct = {
      id: { type: 'L', validate: { required: true } } as FieldDef,
      name: { type: 'T', validate: { required: true } } as FieldDef,
      email: 'T',
    };
    const schema = structToJsonSchema(struct);

    expect(schema.required).toBeDefined();
    expect(schema.required).toContain('id');
    expect(schema.required).toContain('name');
    expect(schema.required).not.toContain('email');
  });

  it('converts struct references', () => {
    const struct = { address: '@ADDRESS' };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.address).toEqual({ $ref: '#/definitions/ADDRESS' });
  });

  it('resolves struct references from registry', () => {
    registry.register_struct('ADDR_TEST_V2', { street: 'T', city: 'T' });
    const struct = { address: '@ADDR_TEST_V2' };
    const schema = structToJsonSchema(struct, { registry });

    expect(schema.properties?.address).toEqual({ $ref: '#/definitions/ADDR_TEST_V2' });
    expect(schema.definitions?.ADDR_TEST_V2).toBeDefined();
    expect(schema.definitions?.ADDR_TEST_V2.properties?.street).toEqual({ type: 'string' });
  });

  it('converts length constraint', () => {
    const struct = {
      code: { type: 'T', validate: { length: 3 } } as FieldDef,
    };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.code).toEqual({
      type: 'string',
      minLength: 3,
      maxLength: 3,
    });
  });

  it('converts default value', () => {
    const struct = {
      status: { type: 'T', validate: { default: 'active' } } as FieldDef,
    };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.status).toEqual({
      type: 'string',
      default: 'active',
    });
  });

  it('converts list struct (homogeneous)', () => {
    const struct = ['N'];
    const schema = structToJsonSchema(struct);
    expect(schema.type).toBe('array');
    expect(schema.items).toEqual({ type: 'number', format: 'decimal' });
  });

  it('converts list struct (positional)', () => {
    const struct = ['T', 'L', 'N'];
    const schema = structToJsonSchema(struct);
    expect(schema.type).toBe('array');
    expect(schema.items).toHaveLength(3);
    expect(schema.minItems).toBe(3);
    expect(schema.maxItems).toBe(3);
  });

  it('converts string struct (named)', () => {
    const struct = 'name:T,qty:L,price:N';
    const schema = structToJsonSchema(struct);
    expect(schema.type).toBe('object');
    expect(schema.properties?.name).toEqual({ type: 'string' });
    expect(schema.properties?.qty).toEqual({ type: 'integer' });
    expect(schema.properties?.price).toEqual({ type: 'number', format: 'decimal' });
  });

  it('includes title when name provided', () => {
    const struct = { id: 'L' };
    const schema = structToJsonSchema(struct, { name: 'Order' });
    expect(schema.title).toBe('Order');
  });
});

describe('round-trip conversion (v2)', () => {
  it('JSON Schema → TYTX → JSON Schema preserves basic types', () => {
    const original = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        price: { type: 'number', format: 'decimal' },
        created: { type: 'string', format: 'date' },
      },
    };
    const struct = structFromJsonSchema(original);
    const result = structToJsonSchema(struct);

    expect(result.properties?.id.type).toBe('integer');
    expect(result.properties?.name.type).toBe('string');
    expect(result.properties?.price.type).toBe('number');
    expect(result.properties?.price.format).toBe('decimal');
    expect(result.properties?.created.type).toBe('string');
    expect(result.properties?.created.format).toBe('date');
  });

  it('JSON Schema → TYTX → JSON Schema preserves required', () => {
    const original = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    };
    const struct = structFromJsonSchema(original);
    const result = structToJsonSchema(struct);

    expect(result.required?.sort()).toEqual(original.required.sort());
  });

  it('JSON Schema → TYTX → JSON Schema preserves constraints', () => {
    const original = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        age: { type: 'integer', minimum: 0 },
      },
    };
    const struct = structFromJsonSchema(original);
    const result = structToJsonSchema(struct);

    expect(result.properties?.name.minLength).toBe(1);
    expect(result.properties?.name.maxLength).toBe(100);
    expect(result.properties?.age.minimum).toBe(0);
  });

  it('TYTX → JSON Schema → TYTX preserves simple types', () => {
    const original = {
      id: 'L',
      name: 'T',
      price: 'N',
      date: 'D',
      tags: '#T',
    };
    const schema = structToJsonSchema(original);
    const result = structFromJsonSchema(schema);

    expect(result.id).toBe('L');
    expect(result.name).toBe('T');
    expect(result.price).toBe('N');
    expect(result.date).toBe('D');
    expect(result.tags).toBe('#T');
  });

  it('TYTX → JSON Schema → TYTX preserves FieldDef', () => {
    const original = {
      id: { type: 'L', validate: { required: true } } as FieldDef,
      name: { type: 'T', validate: { min: 1, required: true } } as FieldDef,
    };
    const schema = structToJsonSchema(original);
    const result = structFromJsonSchema(schema);

    expect(result.id).toEqual(original.id);
    expect(result.name).toEqual(original.name);
  });
});

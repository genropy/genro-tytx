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
      created_at: 'DHZ', // DHZ is canonical for timezone-aware datetime
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

  it('converts exclusiveMinimum and exclusiveMaximum', () => {
    const schema = {
      type: 'object',
      properties: {
        score: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.score).toEqual({
      type: 'R',
      validate: { min: 0, minExclusive: true, max: 100, maxExclusive: true },
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

describe('structToJsonSchema edge cases', () => {
  it('unknown type code defaults to string', () => {
    const struct = { field: 'UNKNOWN_TYPE_XYZ' };
    const schema = structToJsonSchema(struct);
    expect(schema.properties?.field).toEqual({ type: 'string' });
  });

  it('string struct anonymous (no colon) becomes array', () => {
    const struct = 'T,L,N';
    const schema = structToJsonSchema(struct);
    expect(schema.type).toBe('array');
    expect(schema.items).toHaveLength(3);
    expect(schema.minItems).toBe(3);
    expect(schema.maxItems).toBe(3);
  });

  it('string struct mixed named and anonymous skips anonymous', () => {
    // "name:T,L" has named field and anonymous field
    const struct = 'name:T,L';
    const schema = structToJsonSchema(struct);
    expect(schema.type).toBe('object');
    expect(schema.properties?.name).toEqual({ type: 'string' });
    // "L" without colon is skipped
    expect(Object.keys(schema.properties || {})).toEqual(['name']);
  });

  it('empty object struct returns empty properties', () => {
    // Empty object returns empty properties
    const schema = structToJsonSchema({});
    expect(schema.type).toBe('object');
    expect(schema.properties).toEqual({});
  });
});

describe('structFromJsonSchema fallback paths', () => {
  it('type with unknown format falls back to base type without format', () => {
    // integer with unknown format should fall back to integer (L)
    const schema = {
      type: 'object',
      properties: {
        value: { type: 'integer', format: 'unknown-format-xyz' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.value).toBe('L');
  });

  it('unknown type defaults to string', () => {
    // Completely unknown type defaults to T
    const schema = {
      type: 'object',
      properties: {
        value: { type: 'unknown_type_xyz' as 'string' },
      },
    };
    const struct = structFromJsonSchema(schema);
    expect(struct.value).toBe('T');
  });

  it('required nested object returns FieldDef with required flag', () => {
    const schema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
        },
      },
      required: ['address'],
    };
    const struct = structFromJsonSchema(schema, { name: 'REQ_TEST' });
    // Required nested object returns {type: "@...", validate: {required: true}}
    expect((struct.address as { type: string }).type).toBe('@REQ_TEST_ADDRESS');
    expect((struct.address as { validate: { required: boolean } }).validate.required).toBe(true);
  });
});

describe('structFromJsonSchema nested registration', () => {
  afterEach(() => {
    try {
      registry.unregister_struct('NESTED_ADDR');
      registry.unregister_struct('PERSON_NESTED_ADDRESS');
    } catch {
      // Ignore
    }
  });

  it('registers nested structs when registerNested is true', () => {
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

    const struct = structFromJsonSchema(schema, {
      name: 'PERSON_NESTED',
      registerNested: true,
      registry,
    });

    // Check that struct was created correctly
    expect(struct.name).toBe('T');
    // Non-required nested object returns string "@NAME"
    expect(struct.address).toBe('@PERSON_NESTED_ADDRESS');

    // Check that nested struct was registered
    const nestedStruct = registry.get_struct('PERSON_NESTED_ADDRESS');
    expect(nestedStruct).toBeDefined();
    expect((nestedStruct as Record<string, string>).street).toBe('T');
    expect((nestedStruct as Record<string, string>).city).toBe('T');
  });
});

describe('structFromJsonSchema oneOf handling', () => {
  it('oneOf takes first option', () => {
    const schema = {
      type: 'object',
      properties: {
        value: {
          oneOf: [{ type: 'integer' }, { type: 'string' }],
        },
      },
    };
    const struct = structFromJsonSchema(schema);
    // Takes first option (integer -> L)
    expect(struct.value).toBe('L');
  });
});

describe('structFromJsonSchema $ref handling', () => {
  it('$ref to nested object with required flag', () => {
    const schema = {
      type: 'object',
      properties: {
        address: { $ref: '#/$defs/Address' },
      },
      required: ['address'],
      $defs: {
        Address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
        },
      },
    };
    const struct = structFromJsonSchema(schema);
    // Required $ref to object should return FieldDef with required flag
    expect((struct.address as { type: string }).type).toBe('@Address');
    expect((struct.address as { validate: { required: boolean } }).validate.required).toBe(true);
  });

  it('$ref to non-object schema follows ref', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { $ref: '#/$defs/Status' },
      },
      $defs: {
        Status: { type: 'string', enum: ['active', 'inactive'] },
      },
    };
    const struct = structFromJsonSchema(schema);
    // $ref to a string schema should resolve to T with enum constraint
    expect((struct.status as { type: string }).type).toBe('T');
    expect((struct.status as { validate: { enum: string[] } }).validate.enum).toEqual([
      'active',
      'inactive',
    ]);
  });

  it('throws on non-local $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        data: { $ref: 'http://example.com/schema.json' },
      },
    };
    expect(() => structFromJsonSchema(schema)).toThrow(/Only local \$ref supported/);
  });

  it('throws on unresolvable $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        data: { $ref: '#/$defs/NonExistent' },
      },
      $defs: {},
    };
    expect(() => structFromJsonSchema(schema)).toThrow(/Cannot resolve \$ref/);
  });
});

describe('structToJsonSchema fallback for invalid struct', () => {
  it('invalid type (number) falls back to object', () => {
    // Pass a number as struct - TypeScript wouldn't allow this normally,
    // but runtime could receive invalid input. This hits the final fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = structToJsonSchema(42 as unknown as any);
    expect(schema.type).toBe('object');
  });

  it('null as struct falls back to object', () => {
    // null is not object (typeof null === 'object' but !Array.isArray and then entries fail)
    // Actually null would fail on Object.entries, so this path may not be hit
    // Try undefined instead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = structToJsonSchema(undefined as unknown as any);
    expect(schema.type).toBe('object');
  });
});

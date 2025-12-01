/**
 * Tests for TYTX schema utilities (JavaScript) - v2 format.
 * JSON Schema ↔ TYTX struct conversion with FieldDef objects.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    structFromJsonSchema,
    structToJsonSchema,
    JSONSCHEMA_TO_TYTX,
    TYTX_TO_JSONSCHEMA
} = require('../src/schema_utils');
const { registry } = require('../src/registry');

describe('structFromJsonSchema (v2)', () => {
    it('converts basic types without constraints to simple strings', () => {
        const schema = {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                price: { type: 'number' },
                active: { type: 'boolean' }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.deepStrictEqual(struct, {
            id: 'L',
            name: 'T',
            price: 'R',
            active: 'B'
        });
    });

    it('converts formatted types', () => {
        const schema = {
            type: 'object',
            properties: {
                amount: { type: 'number', format: 'decimal' },
                created: { type: 'string', format: 'date' },
                updated: { type: 'string', format: 'date-time' },
                startTime: { type: 'string', format: 'time' }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.deepStrictEqual(struct, {
            amount: 'N',
            created: 'D',
            updated: 'DH',
            startTime: 'H'
        });
    });

    it('converts constraints to FieldDef with validate section', () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                code: { type: 'string', pattern: '[A-Z]{2}' },
                status: { type: 'string', enum: ['active', 'inactive'] },
                age: { type: 'integer', minimum: 0, maximum: 120 }
            }
        };
        const struct = structFromJsonSchema(schema);

        // name should be FieldDef with validate
        assert.deepStrictEqual(struct.name, {
            type: 'T',
            validate: { min: 1, max: 100 }
        });

        // code should have pattern
        assert.deepStrictEqual(struct.code, {
            type: 'T',
            validate: { pattern: '[A-Z]{2}' }
        });

        // status should have enum
        assert.deepStrictEqual(struct.status, {
            type: 'T',
            validate: { enum: ['active', 'inactive'] }
        });

        // age should have min/max
        assert.deepStrictEqual(struct.age, {
            type: 'L',
            validate: { min: 0, max: 120 }
        });
    });

    it('converts title and description to ui section', () => {
        const schema = {
            type: 'object',
            properties: {
                email: { type: 'string', title: 'Email', description: 'User email address' }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.deepStrictEqual(struct.email, {
            type: 'T',
            ui: { label: 'Email', hint: 'User email address' }
        });
    });

    it('converts required fields to validate.required', () => {
        const schema = {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                email: { type: 'string' }
            },
            required: ['id', 'name']
        };
        const struct = structFromJsonSchema(schema);

        // id and name should have validate.required: true
        assert.deepStrictEqual(struct.id, {
            type: 'L',
            validate: { required: true }
        });
        assert.deepStrictEqual(struct.name, {
            type: 'T',
            validate: { required: true }
        });
        // email should be simple string (not required)
        assert.strictEqual(struct.email, 'T');
    });

    it('combines constraints with required', () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string', minLength: 1, title: 'Name' }
            },
            required: ['name']
        };
        const struct = structFromJsonSchema(schema);
        assert.deepStrictEqual(struct.name, {
            type: 'T',
            validate: { min: 1, required: true },
            ui: { label: 'Name' }
        });
    });

    it('converts array types', () => {
        const schema = {
            type: 'object',
            properties: {
                tags: { type: 'array', items: { type: 'string' } },
                scores: { type: 'array', items: { type: 'integer' } }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.strictEqual(struct.tags, '#T');
        assert.strictEqual(struct.scores, '#L');
    });

    it('converts required arrays', () => {
        const schema = {
            type: 'object',
            properties: {
                items: { type: 'array', items: { type: 'string' } }
            },
            required: ['items']
        };
        const struct = structFromJsonSchema(schema);
        assert.deepStrictEqual(struct.items, {
            type: '#T',
            validate: { required: true }
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
                        city: { type: 'string' }
                    }
                }
            }
        };
        const struct = structFromJsonSchema(schema, { name: 'PERSON' });
        assert.strictEqual(struct.name, 'T');
        assert.strictEqual(struct.address, '@PERSON_ADDRESS');
    });

    it('handles $ref references', () => {
        const schema = {
            type: 'object',
            properties: {
                shipping: { $ref: '#/definitions/Address' },
                billing: { $ref: '#/definitions/Address' }
            },
            definitions: {
                Address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' }
                    }
                }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.strictEqual(struct.shipping, '@Address');
        assert.strictEqual(struct.billing, '@Address');
    });

    it('handles anyOf with null (Optional)', () => {
        const schema = {
            type: 'object',
            properties: {
                nickname: {
                    anyOf: [
                        { type: 'string' },
                        { type: 'null' }
                    ]
                }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.strictEqual(struct.nickname, 'T');
    });

    it('handles oneOf (takes first)', () => {
        const schema = {
            type: 'object',
            properties: {
                value: {
                    oneOf: [
                        { type: 'integer' },
                        { type: 'string' }
                    ]
                }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.strictEqual(struct.value, 'L');
    });

    it('handles default values', () => {
        const schema = {
            type: 'object',
            properties: {
                status: { type: 'string', default: 'active' }
            }
        };
        const struct = structFromJsonSchema(schema);
        assert.deepStrictEqual(struct.status, {
            type: 'T',
            validate: { default: 'active' }
        });
    });

    it('throws for non-object schema', () => {
        assert.throws(() => {
            structFromJsonSchema({ type: 'array', items: { type: 'string' } });
        }, /must have type: 'object'/);
    });
});

describe('structToJsonSchema (v2)', () => {
    it('converts simple type codes', () => {
        const struct = { id: 'L', name: 'T', price: 'R', active: 'B' };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema, {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                price: { type: 'number' },
                active: { type: 'boolean' }
            }
        });
    });

    it('converts formatted types', () => {
        const struct = { amount: 'N', created: 'D', updated: 'DH', startTime: 'H' };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema.properties.amount, { type: 'number', format: 'decimal' });
        assert.deepStrictEqual(schema.properties.created, { type: 'string', format: 'date' });
        assert.deepStrictEqual(schema.properties.updated, { type: 'string', format: 'date-time' });
        assert.deepStrictEqual(schema.properties.startTime, { type: 'string', format: 'time' });
    });

    it('converts FieldDef validate to JSON Schema constraints', () => {
        const struct = {
            name: { type: 'T', validate: { min: 1, max: 100 } },
            code: { type: 'T', validate: { pattern: '[A-Z]{2}' } },
            age: { type: 'L', validate: { min: 0, max: 120 } }
        };
        const schema = structToJsonSchema(struct);

        assert.deepStrictEqual(schema.properties.name, {
            type: 'string',
            minLength: 1,
            maxLength: 100
        });
        assert.deepStrictEqual(schema.properties.code, {
            type: 'string',
            pattern: '[A-Z]{2}'
        });
        assert.deepStrictEqual(schema.properties.age, {
            type: 'integer',
            minimum: 0,
            maximum: 120
        });
    });

    it('converts enum', () => {
        const struct = { status: { type: 'T', validate: { enum: ['active', 'inactive'] } } };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema.properties.status, {
            type: 'string',
            enum: ['active', 'inactive']
        });
    });

    it('converts ui section to title/description', () => {
        const struct = {
            email: { type: 'T', ui: { label: 'Email', hint: 'User email' } }
        };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema.properties.email, {
            type: 'string',
            title: 'Email',
            description: 'User email'
        });
    });

    it('converts validate.required to required array', () => {
        const struct = {
            id: { type: 'L', validate: { required: true } },
            name: { type: 'T', validate: { required: true } },
            email: 'T'
        };
        const schema = structToJsonSchema(struct);

        assert.ok(schema.required);
        assert.ok(schema.required.includes('id'));
        assert.ok(schema.required.includes('name'));
        assert.ok(!schema.required.includes('email'));
    });

    it('converts array types', () => {
        const struct = { tags: '#T', scores: '#L' };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema.properties.tags, { type: 'array', items: { type: 'string' } });
        assert.deepStrictEqual(schema.properties.scores, { type: 'array', items: { type: 'integer' } });
    });

    it('converts list struct (homogeneous)', () => {
        const struct = ['L'];
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema, {
            type: 'array',
            items: { type: 'integer' }
        });
    });

    it('converts list struct (positional)', () => {
        const struct = ['T', 'L', 'N'];
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema, {
            type: 'array',
            items: [
                { type: 'string' },
                { type: 'integer' },
                { type: 'number', format: 'decimal' }
            ],
            minItems: 3,
            maxItems: 3
        });
    });

    it('converts string struct (named)', () => {
        const struct = 'name:T,qty:L,price:N';
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema, {
            type: 'object',
            properties: {
                name: { type: 'string' },
                qty: { type: 'integer' },
                price: { type: 'number', format: 'decimal' }
            }
        });
    });

    it('converts string struct (anonymous)', () => {
        const struct = 'T,L,N';
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema, {
            type: 'array',
            items: [
                { type: 'string' },
                { type: 'integer' },
                { type: 'number', format: 'decimal' }
            ],
            minItems: 3,
            maxItems: 3
        });
    });

    it('adds title when name provided', () => {
        const struct = { id: 'L' };
        const schema = structToJsonSchema(struct, { name: 'User' });
        assert.strictEqual(schema.title, 'User');
    });

    it('handles struct references with registry', () => {
        // Register a nested struct
        registry.register_struct('ADDRESS_TEST_V2', { street: 'T', city: 'T' });

        const struct = { name: 'T', address: '@ADDRESS_TEST_V2' };
        const schema = structToJsonSchema(struct, { registry, includeDefinitions: true });

        assert.deepStrictEqual(schema.properties.address, { $ref: '#/definitions/ADDRESS_TEST_V2' });
        assert.ok(schema.definitions);
        assert.deepStrictEqual(schema.definitions.ADDRESS_TEST_V2, {
            type: 'object',
            properties: {
                street: { type: 'string' },
                city: { type: 'string' }
            }
        });

        // Cleanup
        registry.unregister_struct('ADDRESS_TEST_V2');
    });

    it('converts length constraint', () => {
        const struct = {
            code: { type: 'T', validate: { length: 3 } }
        };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema.properties.code, {
            type: 'string',
            minLength: 3,
            maxLength: 3
        });
    });

    it('converts default value', () => {
        const struct = {
            status: { type: 'T', validate: { default: 'active' } }
        };
        const schema = structToJsonSchema(struct);
        assert.deepStrictEqual(schema.properties.status, {
            type: 'string',
            default: 'active'
        });
    });
});

describe('round-trip conversion (v2)', () => {
    it('JSON Schema → TYTX → JSON Schema (basic)', () => {
        const original = {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                price: { type: 'number' }
            }
        };
        const struct = structFromJsonSchema(original);
        const roundTrip = structToJsonSchema(struct);

        assert.deepStrictEqual(roundTrip.type, original.type);
        assert.deepStrictEqual(roundTrip.properties.id, original.properties.id);
        assert.deepStrictEqual(roundTrip.properties.name, original.properties.name);
        assert.deepStrictEqual(roundTrip.properties.price, original.properties.price);
    });

    it('JSON Schema → TYTX → JSON Schema (with required)', () => {
        const original = {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                name: { type: 'string' }
            },
            required: ['id', 'name']
        };
        const struct = structFromJsonSchema(original);
        const roundTrip = structToJsonSchema(struct);

        assert.deepStrictEqual(roundTrip.required.sort(), original.required.sort());
    });

    it('JSON Schema → TYTX → JSON Schema (with constraints)', () => {
        const original = {
            type: 'object',
            properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                age: { type: 'integer', minimum: 0 }
            }
        };
        const struct = structFromJsonSchema(original);
        const roundTrip = structToJsonSchema(struct);

        assert.strictEqual(roundTrip.properties.name.minLength, 1);
        assert.strictEqual(roundTrip.properties.name.maxLength, 100);
        assert.strictEqual(roundTrip.properties.age.minimum, 0);
    });

    it('TYTX → JSON Schema → TYTX (basic)', () => {
        const original = { id: 'L', name: 'T', amount: 'N', active: 'B' };
        const schema = structToJsonSchema(original);
        const roundTrip = structFromJsonSchema(schema);

        assert.deepStrictEqual(roundTrip, original);
    });

    it('TYTX → JSON Schema → TYTX (with FieldDef)', () => {
        const original = {
            id: { type: 'L', validate: { required: true } },
            name: { type: 'T', validate: { min: 1, required: true } }
        };
        const schema = structToJsonSchema(original);
        const roundTrip = structFromJsonSchema(schema);

        assert.deepStrictEqual(roundTrip.id, original.id);
        assert.deepStrictEqual(roundTrip.name, original.name);
    });
});

describe('mappings', () => {
    it('JSONSCHEMA_TO_TYTX has expected mappings', () => {
        assert.strictEqual(JSONSCHEMA_TO_TYTX['integer:'], 'L');
        assert.strictEqual(JSONSCHEMA_TO_TYTX['number:'], 'R');
        assert.strictEqual(JSONSCHEMA_TO_TYTX['boolean:'], 'B');
        assert.strictEqual(JSONSCHEMA_TO_TYTX['string:'], 'T');
        assert.strictEqual(JSONSCHEMA_TO_TYTX['string:date'], 'D');
    });

    it('TYTX_TO_JSONSCHEMA has expected mappings', () => {
        assert.deepStrictEqual(TYTX_TO_JSONSCHEMA.L, { type: 'integer' });
        assert.deepStrictEqual(TYTX_TO_JSONSCHEMA.R, { type: 'number' });
        assert.deepStrictEqual(TYTX_TO_JSONSCHEMA.B, { type: 'boolean' });
        assert.deepStrictEqual(TYTX_TO_JSONSCHEMA.T, { type: 'string' });
    });
});

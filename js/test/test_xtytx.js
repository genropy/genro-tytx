/**
 * Tests for XTYTX envelope processing (JavaScript).
 *
 * Tests cover:
 * - gschema registration and use
 * - lschema document-specific use
 * - Data hydration with schemas
 *
 * TYTX is a transport format, not a validator.
 * Validation is delegated to JSON Schema.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { from_json, schemaRegistry, processEnvelope } = require('../src');

describe('XTYTX gschema support', () => {
    // Clean up any test schemas after each test
    afterEach(() => {
        try { schemaRegistry.unregister('test_global'); } catch (e) {}
        try { schemaRegistry.unregister('CUSTOMER'); } catch (e) {}
        try { schemaRegistry.unregister('ORDER'); } catch (e) {}
    });

    it('gschema entries are registered globally', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                CUSTOMER: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' }
                    },
                    required: ['name', 'email']
                }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // gschema should be registered in global registry
        const schema = schemaRegistry.get('CUSTOMER');
        assert.ok(schema);
        assert.strictEqual(schema.type, 'object');
        assert.ok(schema.properties.name);
        assert.ok(schema.properties.email);
    });

    it('gschema can be retrieved for validation after registration', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                ORDER: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        total: { type: 'number', minimum: 0 }
                    }
                }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // Now we can retrieve the schema for external validation
        const schema = schemaRegistry.get('ORDER');
        assert.ok(schema);
        assert.strictEqual(schema.properties.total.minimum, 0);
    });

    it('multiple gschemas are registered', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                CUSTOMER: { type: 'object', properties: { name: { type: 'string' } } },
                ORDER: { type: 'object', properties: { id: { type: 'integer' } } }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        assert.ok(schemaRegistry.get('CUSTOMER'));
        assert.ok(schemaRegistry.get('ORDER'));
    });
});

describe('XTYTX lschema support', () => {
    it('lschema entries are returned in result', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            lschema: {
                DOC_SCHEMA: {
                    type: 'object',
                    properties: { docId: { type: 'string', pattern: '^DOC-' } }
                }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.ok(result.localSchemas);
        assert.ok(result.localSchemas.DOC_SCHEMA);
        assert.strictEqual(result.localSchemas.DOC_SCHEMA.properties.docId.pattern, '^DOC-');
    });

    it('lschema is NOT registered globally', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            lschema: {
                LOCAL_ONLY: { type: 'object' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // lschema should NOT be in global registry
        assert.strictEqual(schemaRegistry.get('LOCAL_ONLY'), undefined);
    });

    it('both gschema and lschema are returned', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                GLOBAL_SCHEMA: { type: 'object', properties: { g: { type: 'string' } } }
            },
            lschema: {
                LOCAL_SCHEMA: { type: 'object', properties: { l: { type: 'string' } } }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.ok(result.globalSchemas);
        assert.ok(result.globalSchemas.GLOBAL_SCHEMA);
        assert.ok(result.localSchemas);
        assert.ok(result.localSchemas.LOCAL_SCHEMA);
    });
});

describe('XTYTX data handling with schemas', () => {
    afterEach(() => {
        try { schemaRegistry.unregister('ORDER'); } catch (e) {}
    });

    it('data is hydrated correctly with gschema present', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                ORDER: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', pattern: '^[A-Z]{3}$' },
                        amount: { type: 'integer' }
                    }
                }
            },
            data: 'TYTX://{"code": "ABC", "amount": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.strictEqual(result.data.code, 'ABC');
        assert.strictEqual(result.data.amount, 100);
    });

    it('empty data returns null with schemas', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                ORDER: { type: 'object' }
            },
            data: ''
        })}`;

        const result = from_json(envelope);

        assert.strictEqual(result.data, null);
        assert.ok(result.globalSchemas);
        assert.ok(result.globalSchemas.ORDER);
    });

    it('schemas are available for post-processing validation', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                ORDER: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', pattern: '^[A-Z]{3}$' },
                        amount: { type: 'integer', minimum: 1 }
                    }
                }
            },
            lschema: {
                ITEM: {
                    type: 'object',
                    properties: {
                        sku: { type: 'string' }
                    }
                }
            },
            data: 'TYTX://{"code": "ABC", "amount": "100::L"}'
        })}`;

        const result = from_json(envelope);

        // User can retrieve schemas for external validation (e.g., with Ajv)
        const orderSchema = schemaRegistry.get('ORDER');
        assert.ok(orderSchema);
        assert.strictEqual(orderSchema.properties.amount.minimum, 1);

        // Local schema available in result
        assert.ok(result.localSchemas.ITEM);
    });
});

describe('XTYTX optional fields', () => {
    it('works without gschema', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.strictEqual(result.data.value, 100);
        assert.strictEqual(result.globalSchemas, null);
        assert.strictEqual(result.localSchemas, null);
    });

    it('works without lschema', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gschema: {
                TEST: { type: 'object' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.ok(result.globalSchemas);
        assert.strictEqual(result.localSchemas, null);
    });
});

describe('processEnvelope direct usage', () => {
    afterEach(() => {
        try { schemaRegistry.unregister('CUSTOM'); } catch (e) {}
    });

    it('can be used directly with custom hydrate function', () => {
        const envelope = {
            gstruct: {},
            lstruct: {},
            gschema: {
                CUSTOM: { type: 'object', properties: { value: { type: 'string' } } }
            },
            data: 'TYTX://test-data'
        };

        // Custom hydrate function that just returns the string
        const customHydrate = (dataStr) => ({ raw: dataStr });

        const result = processEnvelope(envelope, customHydrate, 'TYTX://');

        assert.deepStrictEqual(result.data, { raw: 'test-data' });
        assert.ok(result.globalSchemas);
        assert.ok(result.globalSchemas.CUSTOM);
    });

    it('throws on missing required fields', () => {
        assert.throws(
            () => processEnvelope({ lstruct: {}, data: '' }, () => null),
            /missing required field: gstruct/
        );

        assert.throws(
            () => processEnvelope({ gstruct: {}, data: '' }, () => null),
            /missing required field: lstruct/
        );

        assert.throws(
            () => processEnvelope({ gstruct: {}, lstruct: {} }, () => null),
            /missing required field: data/
        );
    });
});

describe('SchemaRegistry', () => {
    afterEach(() => {
        try { schemaRegistry.unregister('test_schema'); } catch (e) {}
    });

    it('register and get schema', () => {
        const schema = { type: 'object', properties: { name: { type: 'string' } } };
        schemaRegistry.register('test_schema', schema);

        const retrieved = schemaRegistry.get('test_schema');
        assert.deepStrictEqual(retrieved, schema);
    });

    it('unregister schema', () => {
        schemaRegistry.register('test_schema', { type: 'object' });
        assert.ok(schemaRegistry.get('test_schema'));

        schemaRegistry.unregister('test_schema');
        assert.strictEqual(schemaRegistry.get('test_schema'), undefined);
    });

    it('listSchemas returns all registered names', () => {
        schemaRegistry.register('test_schema', { type: 'object' });

        const names = schemaRegistry.listSchemas();
        assert.ok(names.includes('test_schema'));
    });
});

/**
 * Tests for XTYTX envelope processing (JavaScript).
 *
 * Tests cover:
 * - gvalidation registration and use
 * - lvalidation document-specific use
 * - Resolution order (local > global > registry)
 * - Data hydration with validations
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { from_json, validationRegistry, processEnvelope } = require('../src');

describe('XTYTX gvalidation support', () => {
    // Clean up any test validations after each test
    afterEach(() => {
        try { validationRegistry.unregister('test_global'); } catch (e) {}
        try { validationRegistry.unregister('test_upper'); } catch (e) {}
        try { validationRegistry.unregister('test_lower'); } catch (e) {}
    });

    it('gvalidation entries are registered globally', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                test_global: { pattern: '^[A-Z]+$', message: 'Must be uppercase' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // gvalidation should be registered in global registry
        const validation = validationRegistry.get('test_global');
        assert.ok(validation);
        assert.strictEqual(validation.pattern, '^[A-Z]+$');
        assert.strictEqual(validation.message, 'Must be uppercase');
    });

    it('gvalidation can be used for validation after registration', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                test_upper: { pattern: '^[A-Z]+$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // Now we can validate using the registered validation
        assert.strictEqual(validationRegistry.validate('ABC', 'test_upper'), true);
        assert.strictEqual(validationRegistry.validate('abc', 'test_upper'), false);
    });

    it('multiple gvalidations are registered', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                test_upper: { pattern: '^[A-Z]+$' },
                test_lower: { pattern: '^[a-z]+$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        assert.ok(validationRegistry.get('test_upper'));
        assert.ok(validationRegistry.get('test_lower'));
    });
});

describe('XTYTX lvalidation support', () => {
    it('lvalidation entries are returned in result', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            lvalidation: {
                doc_validation: { pattern: '^DOC', message: 'Must start with DOC' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.ok(result.localValidations);
        assert.ok(result.localValidations.doc_validation);
        assert.strictEqual(result.localValidations.doc_validation.pattern, '^DOC');
    });

    it('lvalidation is NOT registered globally', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            lvalidation: {
                local_only: { pattern: '^LOCAL$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // lvalidation should NOT be in global registry
        assert.strictEqual(validationRegistry.get('local_only'), undefined);
    });

    it('both gvalidation and lvalidation are returned', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                global_v: { pattern: '^GLOBAL$' }
            },
            lvalidation: {
                local_v: { pattern: '^LOCAL$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.ok(result.globalValidations);
        assert.ok(result.globalValidations.global_v);
        assert.ok(result.localValidations);
        assert.ok(result.localValidations.local_v);
    });
});

describe('XTYTX validation resolution order', () => {
    afterEach(() => {
        try { validationRegistry.unregister('priority_test'); } catch (e) {}
    });

    it('lvalidation overrides gvalidation in manual validation', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                priority_test: { pattern: '^GLOBAL$' }
            },
            lvalidation: {
                priority_test: { pattern: '^LOCAL$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        // When validating manually with local context, local wins
        assert.strictEqual(
            validationRegistry.validate('LOCAL', 'priority_test', result.localValidations),
            true
        );
        assert.strictEqual(
            validationRegistry.validate('GLOBAL', 'priority_test', result.localValidations),
            false
        );
    });

    it('gvalidation overrides registry after registration', () => {
        // First register in registry
        validationRegistry.register('priority_test', { pattern: '^REGISTRY$' });

        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                priority_test: { pattern: '^GLOBAL$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        from_json(envelope);

        // gvalidation should overwrite registry
        assert.strictEqual(validationRegistry.validate('GLOBAL', 'priority_test'), true);
        assert.strictEqual(validationRegistry.validate('REGISTRY', 'priority_test'), false);
    });
});

describe('XTYTX data handling with validations', () => {
    afterEach(() => {
        try { validationRegistry.unregister('code_format'); } catch (e) {}
    });

    it('data is hydrated correctly with gvalidation present', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                code_format: { pattern: '^[A-Z]{3}$' }
            },
            data: 'TYTX://{"code": "ABC", "amount": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.strictEqual(result.data.code, 'ABC');
        assert.strictEqual(result.data.amount, 100);
    });

    it('empty data returns null with validations', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                code_format: { pattern: '^[A-Z]{3}$' }
            },
            data: ''
        })}`;

        const result = from_json(envelope);

        assert.strictEqual(result.data, null);
        assert.ok(result.globalValidations);
        assert.ok(result.globalValidations.code_format);
    });

    it('validations are available for post-processing', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                code_format: { pattern: '^[A-Z]{3}$' }
            },
            lvalidation: {
                amount_positive: { pattern: '^[1-9]' }
            },
            data: 'TYTX://{"code": "ABC", "amount": "100::L"}'
        })}`;

        const result = from_json(envelope);

        // User can validate data using returned validations
        assert.strictEqual(
            validationRegistry.validate(result.data.code, 'code_format'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate(
                String(result.data.amount),
                'amount_positive',
                result.localValidations
            ),
            true
        );
    });
});

describe('XTYTX optional fields', () => {
    it('works without gvalidation', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.strictEqual(result.data.value, 100);
        assert.strictEqual(result.globalValidations, null);
        assert.strictEqual(result.localValidations, null);
    });

    it('works without lvalidation', () => {
        const envelope = `XTYTX://${JSON.stringify({
            gstruct: {},
            lstruct: {},
            gvalidation: {
                test: { pattern: '^test$' }
            },
            data: 'TYTX://{"value": "100::L"}'
        })}`;

        const result = from_json(envelope);

        assert.ok(result.globalValidations);
        assert.strictEqual(result.localValidations, null);
    });
});

describe('processEnvelope direct usage', () => {
    it('can be used directly with custom hydrate function', () => {
        const envelope = {
            gstruct: {},
            lstruct: {},
            gvalidation: {
                custom: { pattern: '^CUSTOM$' }
            },
            data: 'TYTX://test-data'
        };

        // Custom hydrate function that just returns the string
        const customHydrate = (dataStr) => ({ raw: dataStr });

        const result = processEnvelope(envelope, customHydrate, 'TYTX://');

        assert.deepStrictEqual(result.data, { raw: 'test-data' });
        assert.ok(result.globalValidations);
        assert.ok(result.globalValidations.custom);
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

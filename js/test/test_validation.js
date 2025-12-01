/**
 * Tests for TYTX validation system (JavaScript).
 *
 * Tests cover:
 * - ValidationRegistry basic operations
 * - Standard validations (33 patterns)
 * - Boolean expression operators (!&|)
 * - Resolution order (local > global > registry)
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
    ValidationRegistry,
    ValidationError,
    STANDARD_VALIDATIONS,
    validationRegistry,
    createValidationRegistry
} = require('../src/validation');

describe('ValidationRegistry basic operations', () => {
    it('register and get', () => {
        const registry = new ValidationRegistry();
        const definition = {
            pattern: '^[A-Z]+$',
            message: 'Must be uppercase'
        };
        registry.register('test_upper', definition);

        const result = registry.get('test_upper');
        assert.ok(result);
        assert.strictEqual(result.pattern, '^[A-Z]+$');
        assert.strictEqual(result.message, 'Must be uppercase');
    });

    it('unregister removes validation', () => {
        const registry = new ValidationRegistry();
        registry.register('temp', { pattern: '.*' });
        assert.ok(registry.get('temp'));

        registry.unregister('temp');
        assert.strictEqual(registry.get('temp'), undefined);
    });

    it('list_validations returns all names', () => {
        const registry = new ValidationRegistry();
        registry.register('a', { pattern: 'a' });
        registry.register('b', { pattern: 'b' });
        registry.register('c', { pattern: 'c' });

        const names = registry.list_validations();
        assert.deepStrictEqual(new Set(names), new Set(['a', 'b', 'c']));
    });

    it('get returns undefined for unknown', () => {
        const registry = new ValidationRegistry();
        assert.strictEqual(registry.get('nonexistent'), undefined);
    });
});

describe('ValidationRegistry.validate()', () => {
    it('pattern validation passes', () => {
        const registry = new ValidationRegistry();
        registry.register('upper', { pattern: '^[A-Z]+$' });

        assert.strictEqual(registry.validate('ABC', 'upper'), true);
    });

    it('pattern validation fails', () => {
        const registry = new ValidationRegistry();
        registry.register('upper', { pattern: '^[A-Z]+$' });

        assert.strictEqual(registry.validate('abc', 'upper'), false);
    });

    it('len validation passes', () => {
        const registry = new ValidationRegistry();
        registry.register('len5', { len: 5 });

        assert.strictEqual(registry.validate('12345', 'len5'), true);
    });

    it('len validation fails', () => {
        const registry = new ValidationRegistry();
        registry.register('len5', { len: 5 });

        assert.strictEqual(registry.validate('1234', 'len5'), false);
        assert.strictEqual(registry.validate('123456', 'len5'), false);
    });

    it('min validation', () => {
        const registry = new ValidationRegistry();
        registry.register('min3', { min: 3 });

        assert.strictEqual(registry.validate('abc', 'min3'), true);
        assert.strictEqual(registry.validate('abcd', 'min3'), true);
        assert.strictEqual(registry.validate('ab', 'min3'), false);
    });

    it('max validation', () => {
        const registry = new ValidationRegistry();
        registry.register('max5', { max: 5 });

        assert.strictEqual(registry.validate('abc', 'max5'), true);
        assert.strictEqual(registry.validate('abcde', 'max5'), true);
        assert.strictEqual(registry.validate('abcdef', 'max5'), false);
    });

    it('combined constraints', () => {
        const registry = new ValidationRegistry();
        registry.register('strict', {
            pattern: '^[A-Z]+$',
            len: 3
        });

        assert.strictEqual(registry.validate('ABC', 'strict'), true);
        assert.strictEqual(registry.validate('AB', 'strict'), false);
        assert.strictEqual(registry.validate('abc', 'strict'), false);
        assert.strictEqual(registry.validate('ABCD', 'strict'), false);
    });

    it('unknown validation throws', () => {
        const registry = new ValidationRegistry();

        assert.throws(
            () => registry.validate('test', 'nonexistent'),
            /not found/
        );
    });
});

describe('Boolean expressions (!&|)', () => {
    let registry;

    beforeEach(() => {
        registry = new ValidationRegistry();
        registry.register('upper', { pattern: '^[A-Z]+$' });
        registry.register('lower', { pattern: '^[a-z]+$' });
        registry.register('numeric', { pattern: '^[0-9]+$' });
        registry.register('alpha', { pattern: '^[a-zA-Z]+$' });
        registry.register('len3', { len: 3 });
    });

    it('single validation', () => {
        assert.strictEqual(registry.validate_expression('ABC', 'upper'), true);
        assert.strictEqual(registry.validate_expression('abc', 'upper'), false);
    });

    it('AND operator - all pass', () => {
        assert.strictEqual(registry.validate_expression('ABC', 'upper&len3'), true);
    });

    it('AND operator - one fails', () => {
        assert.strictEqual(registry.validate_expression('ABCD', 'upper&len3'), false);
        assert.strictEqual(registry.validate_expression('abc', 'upper&len3'), false);
    });

    it('OR operator - one passes', () => {
        assert.strictEqual(registry.validate_expression('ABC', 'upper|lower'), true);
        assert.strictEqual(registry.validate_expression('abc', 'upper|lower'), true);
    });

    it('OR operator - all fail', () => {
        assert.strictEqual(registry.validate_expression('123', 'upper|lower'), false);
    });

    it('NOT operator', () => {
        assert.strictEqual(registry.validate_expression('abc', '!upper'), true);
        assert.strictEqual(registry.validate_expression('ABC', '!upper'), false);
    });

    it('NOT with AND: !a&b = (!a) AND b', () => {
        assert.strictEqual(registry.validate_expression('abc', '!upper&lower'), true);
        assert.strictEqual(registry.validate_expression('ABC', '!upper&lower'), false);
        assert.strictEqual(registry.validate_expression('123', '!upper&lower'), false);
    });

    it('NOT with OR: !a|b = (!a) OR b', () => {
        assert.strictEqual(registry.validate_expression('abc', '!upper|numeric'), true);
        assert.strictEqual(registry.validate_expression('123', '!upper|numeric'), true);
        assert.strictEqual(registry.validate_expression('ABC', '!upper|numeric'), false);
    });

    it('complex expression: a&b|c&d', () => {
        assert.strictEqual(registry.validate_expression('ABC', 'upper&len3|lower&len3'), true);
        assert.strictEqual(registry.validate_expression('abc', 'upper&len3|lower&len3'), true);
        assert.strictEqual(registry.validate_expression('ABCD', 'upper&len3|lower&len3'), false);
        assert.strictEqual(registry.validate_expression('abcd', 'upper&len3|lower&len3'), false);
    });

    it('precedence: NOT highest', () => {
        assert.strictEqual(registry.validate_expression('abc', '!upper&alpha'), true);
        assert.strictEqual(registry.validate_expression('ABC', '!upper&alpha'), false);
    });

    it('precedence: AND before OR', () => {
        assert.strictEqual(registry.validate_expression('ABC', 'upper|lower&len3'), true);
        assert.strictEqual(registry.validate_expression('abcd', 'upper|lower&len3'), false);
        assert.strictEqual(registry.validate_expression('abc', 'upper|lower&len3'), true);
    });

    it('whitespace in expression', () => {
        assert.strictEqual(registry.validate_expression('ABC', ' upper & len3 '), true);
        assert.strictEqual(registry.validate_expression('abc', ' upper | lower '), true);
        assert.strictEqual(registry.validate_expression('abc', ' ! upper '), true);
    });
});

describe('Resolution order: local > global > registry', () => {
    it('local overrides global', () => {
        const registry = new ValidationRegistry();
        registry.register('test', { pattern: '^REGISTRY$' });

        const globalValidations = {
            test: { pattern: '^GLOBAL$' }
        };
        const localValidations = {
            test: { pattern: '^LOCAL$' }
        };

        assert.strictEqual(
            registry.validate('LOCAL', 'test', localValidations, globalValidations),
            true
        );
        assert.strictEqual(
            registry.validate('GLOBAL', 'test', localValidations, globalValidations),
            false
        );
    });

    it('global overrides registry', () => {
        const registry = new ValidationRegistry();
        registry.register('test', { pattern: '^REGISTRY$' });

        const globalValidations = {
            test: { pattern: '^GLOBAL$' }
        };

        assert.strictEqual(
            registry.validate('GLOBAL', 'test', null, globalValidations),
            true
        );
        assert.strictEqual(
            registry.validate('REGISTRY', 'test', null, globalValidations),
            false
        );
    });

    it('registry fallback', () => {
        const registry = new ValidationRegistry();
        registry.register('test', { pattern: '^REGISTRY$' });

        assert.strictEqual(registry.validate('REGISTRY', 'test'), true);
    });

    it('expression with local validations', () => {
        const registry = new ValidationRegistry();

        const localValidations = {
            a: { pattern: '^[A-Z]+$' },
            b: { pattern: '^.{3}$' }
        };

        assert.strictEqual(
            registry.validate_expression('ABC', 'a&b', localValidations),
            true
        );
        assert.strictEqual(
            registry.validate_expression('ABCD', 'a&b', localValidations),
            false
        );
    });
});

describe('Standard validations', () => {
    it('33 standard validations defined', () => {
        assert.strictEqual(Object.keys(STANDARD_VALIDATIONS).length, 33);
    });

    it('global registry has standard validations', () => {
        assert.strictEqual(validationRegistry.list_validations().length, 33);
    });

    it('createValidationRegistry includes standard by default', () => {
        const registry = createValidationRegistry();
        assert.strictEqual(registry.list_validations().length, 33);
    });

    it('createValidationRegistry can exclude standard', () => {
        const registry = createValidationRegistry(false);
        assert.strictEqual(registry.list_validations().length, 0);
    });

    // Internet & Communication
    it('email valid', () => {
        assert.strictEqual(validationRegistry.validate('test@example.com', 'email'), true);
        assert.strictEqual(validationRegistry.validate('user.name+tag@domain.co.uk', 'email'), true);
    });

    it('email invalid', () => {
        assert.strictEqual(validationRegistry.validate('invalid', 'email'), false);
        assert.strictEqual(validationRegistry.validate('@domain.com', 'email'), false);
    });

    it('url valid', () => {
        assert.strictEqual(validationRegistry.validate('https://example.com', 'url'), true);
        assert.strictEqual(validationRegistry.validate('http://example.com/path?q=1', 'url'), true);
    });

    it('url invalid', () => {
        assert.strictEqual(validationRegistry.validate('ftp://example.com', 'url'), false);
        assert.strictEqual(validationRegistry.validate('example.com', 'url'), false);
    });

    it('domain valid', () => {
        assert.strictEqual(validationRegistry.validate('example.com', 'domain'), true);
        assert.strictEqual(validationRegistry.validate('sub.example.co.uk', 'domain'), true);
    });

    it('ipv4 valid', () => {
        assert.strictEqual(validationRegistry.validate('192.168.1.1', 'ipv4'), true);
        assert.strictEqual(validationRegistry.validate('255.255.255.255', 'ipv4'), true);
    });

    it('ipv4 invalid', () => {
        assert.strictEqual(validationRegistry.validate('256.1.1.1', 'ipv4'), false);
        assert.strictEqual(validationRegistry.validate('192.168.1', 'ipv4'), false);
    });

    it('phone valid', () => {
        assert.strictEqual(validationRegistry.validate('+393331234567', 'phone'), true);
        assert.strictEqual(validationRegistry.validate('393331234567', 'phone'), true);
    });

    // Identifiers
    it('uuid v4 valid', () => {
        assert.strictEqual(
            validationRegistry.validate('550e8400-e29b-41d4-a716-446655440000', 'uuid'),
            true
        );
    });

    it('uuid v4 invalid (v1)', () => {
        assert.strictEqual(
            validationRegistry.validate('550e8400-e29b-11d4-a716-446655440000', 'uuid'),
            false
        );
    });

    it('uuid_any valid', () => {
        assert.strictEqual(
            validationRegistry.validate('550e8400-e29b-11d4-a716-446655440000', 'uuid_any'),
            true
        );
    });

    it('slug valid', () => {
        assert.strictEqual(validationRegistry.validate('my-post-title', 'slug'), true);
        assert.strictEqual(validationRegistry.validate('post123', 'slug'), true);
    });

    it('slug invalid', () => {
        assert.strictEqual(validationRegistry.validate('My-Post', 'slug'), false);
        assert.strictEqual(validationRegistry.validate('my_post', 'slug'), false);
    });

    // Italian Fiscal
    it('cf valid', () => {
        assert.strictEqual(validationRegistry.validate('RSSMRA85M01H501X', 'cf'), true);
    });

    it('cf invalid', () => {
        assert.strictEqual(validationRegistry.validate('RSSMRA85M01H501', 'cf'), false);
        assert.strictEqual(validationRegistry.validate('rssmra85m01h501x', 'cf'), false);
    });

    it('piva valid', () => {
        assert.strictEqual(validationRegistry.validate('12345678901', 'piva'), true);
    });

    it('piva invalid', () => {
        assert.strictEqual(validationRegistry.validate('1234567890', 'piva'), false);
        assert.strictEqual(validationRegistry.validate('123456789012', 'piva'), false);
    });

    it('cap_it valid', () => {
        assert.strictEqual(validationRegistry.validate('00100', 'cap_it'), true);
        assert.strictEqual(validationRegistry.validate('20100', 'cap_it'), true);
    });

    it('cap_it invalid', () => {
        assert.strictEqual(validationRegistry.validate('0010', 'cap_it'), false);
        assert.strictEqual(validationRegistry.validate('001000', 'cap_it'), false);
    });

    // European Standards
    it('iban valid', () => {
        assert.strictEqual(
            validationRegistry.validate('IT60X0542811101000000123456', 'iban'),
            true
        );
    });

    it('bic valid', () => {
        assert.strictEqual(validationRegistry.validate('DEUTDEFF', 'bic'), true);
        assert.strictEqual(validationRegistry.validate('DEUTDEFF500', 'bic'), true);
    });

    it('vat_eu valid', () => {
        assert.strictEqual(validationRegistry.validate('IT12345678901', 'vat_eu'), true);
        assert.strictEqual(validationRegistry.validate('DE123456789', 'vat_eu'), true);
    });

    // Text Constraints
    it('latin valid', () => {
        assert.strictEqual(validationRegistry.validate('Hello World 123!', 'latin'), true);
    });

    it('latin invalid', () => {
        assert.strictEqual(validationRegistry.validate('Héllo', 'latin'), false);
    });

    it('uppercase valid', () => {
        assert.strictEqual(validationRegistry.validate('HELLO', 'uppercase'), true);
    });

    it('uppercase invalid', () => {
        assert.strictEqual(validationRegistry.validate('Hello', 'uppercase'), false);
    });

    it('lowercase valid', () => {
        assert.strictEqual(validationRegistry.validate('hello', 'lowercase'), true);
    });

    it('alphanumeric valid', () => {
        assert.strictEqual(validationRegistry.validate('Hello123', 'alphanumeric'), true);
    });

    it('alphanumeric invalid', () => {
        assert.strictEqual(validationRegistry.validate('Hello-123', 'alphanumeric'), false);
    });

    it('no_spaces valid', () => {
        assert.strictEqual(validationRegistry.validate('HelloWorld', 'no_spaces'), true);
    });

    it('no_spaces invalid', () => {
        assert.strictEqual(validationRegistry.validate('Hello World', 'no_spaces'), false);
    });

    it('single_line valid', () => {
        assert.strictEqual(validationRegistry.validate('Hello World!', 'single_line'), true);
    });

    it('single_line invalid', () => {
        assert.strictEqual(validationRegistry.validate('Hello\nWorld', 'single_line'), false);
    });

    // Numeric Formats
    it('positive_int valid', () => {
        assert.strictEqual(validationRegistry.validate('123', 'positive_int'), true);
        assert.strictEqual(validationRegistry.validate('1', 'positive_int'), true);
    });

    it('positive_int invalid', () => {
        assert.strictEqual(validationRegistry.validate('0', 'positive_int'), false);
        assert.strictEqual(validationRegistry.validate('-1', 'positive_int'), false);
    });

    it('non_negative_int valid', () => {
        assert.strictEqual(validationRegistry.validate('0', 'non_negative_int'), true);
        assert.strictEqual(validationRegistry.validate('123', 'non_negative_int'), true);
    });

    it('decimal valid', () => {
        assert.strictEqual(validationRegistry.validate('123.45', 'decimal'), true);
        assert.strictEqual(validationRegistry.validate('-123.45', 'decimal'), true);
        assert.strictEqual(validationRegistry.validate('123', 'decimal'), true);
    });

    it('percentage valid', () => {
        assert.strictEqual(validationRegistry.validate('0', 'percentage'), true);
        assert.strictEqual(validationRegistry.validate('50.5', 'percentage'), true);
        assert.strictEqual(validationRegistry.validate('100', 'percentage'), true);
    });

    it('percentage invalid', () => {
        assert.strictEqual(validationRegistry.validate('101', 'percentage'), false);
    });

    // Date & Time Formats
    it('iso_date valid', () => {
        assert.strictEqual(validationRegistry.validate('2025-01-15', 'iso_date'), true);
    });

    it('iso_date invalid', () => {
        assert.strictEqual(validationRegistry.validate('2025-13-01', 'iso_date'), false);
        assert.strictEqual(validationRegistry.validate('2025/01/15', 'iso_date'), false);
    });

    it('iso_datetime valid', () => {
        assert.strictEqual(
            validationRegistry.validate('2025-01-15T10:30:00Z', 'iso_datetime'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate('2025-01-15T10:30:00+01:00', 'iso_datetime'),
            true
        );
    });

    it('time valid', () => {
        assert.strictEqual(validationRegistry.validate('10:30', 'time'), true);
        assert.strictEqual(validationRegistry.validate('10:30:45', 'time'), true);
    });

    it('time invalid', () => {
        assert.strictEqual(validationRegistry.validate('25:00', 'time'), false);
    });

    it('year valid', () => {
        assert.strictEqual(validationRegistry.validate('2025', 'year'), true);
    });

    it('year invalid', () => {
        assert.strictEqual(validationRegistry.validate('25', 'year'), false);
        assert.strictEqual(validationRegistry.validate('20250', 'year'), false);
    });

    // Security
    it('password_strong valid', () => {
        assert.strictEqual(validationRegistry.validate('MyP@ss123', 'password_strong'), true);
    });

    it('password_strong invalid', () => {
        assert.strictEqual(validationRegistry.validate('password', 'password_strong'), false);
        assert.strictEqual(validationRegistry.validate('Password1', 'password_strong'), false);
    });

    it('hex valid', () => {
        assert.strictEqual(validationRegistry.validate('0123456789abcdefABCDEF', 'hex'), true);
    });

    it('hex invalid', () => {
        assert.strictEqual(validationRegistry.validate('0123456789abcdefg', 'hex'), false);
    });

    it('base64 valid', () => {
        assert.strictEqual(validationRegistry.validate('SGVsbG8gV29ybGQ=', 'base64'), true);
    });

    it('base64 invalid', () => {
        assert.strictEqual(validationRegistry.validate('Hello World!', 'base64'), false);
    });
});

describe('Real-world validation expressions', () => {
    it('CF or PIVA', () => {
        assert.strictEqual(
            validationRegistry.validate_expression('RSSMRA85M01H501X', 'cf|piva'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate_expression('12345678901', 'cf|piva'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate_expression('invalid', 'cf|piva'),
            false
        );
    });

    it('latin AND uppercase', () => {
        assert.strictEqual(
            validationRegistry.validate_expression('HELLO', 'latin&uppercase'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate_expression('hello', 'latin&uppercase'),
            false
        );
        assert.strictEqual(
            validationRegistry.validate_expression('HÉLLO', 'latin&uppercase'),
            false
        );
    });

    it('NOT numeric', () => {
        assert.strictEqual(
            validationRegistry.validate_expression('abc', '!positive_int'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate_expression('123', '!positive_int'),
            false
        );
    });

    it('email OR phone', () => {
        assert.strictEqual(
            validationRegistry.validate_expression('test@example.com', 'email|phone'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate_expression('+393331234567', 'email|phone'),
            true
        );
        assert.strictEqual(
            validationRegistry.validate_expression('invalid', 'email|phone'),
            false
        );
    });
});

describe('ValidationError', () => {
    it('creates error with message only', () => {
        const error = new ValidationError('Test error');
        assert.strictEqual(error.message, 'Test error');
        assert.strictEqual(error.name, 'ValidationError');
        assert.strictEqual(error.validationName, undefined);
        assert.strictEqual(error.code, undefined);
    });

    it('creates error with validation name', () => {
        const error = new ValidationError('Invalid email', 'email');
        assert.strictEqual(error.message, 'Invalid email');
        assert.strictEqual(error.validationName, 'email');
        assert.strictEqual(error.code, undefined);
    });

    it('creates error with all fields', () => {
        const error = new ValidationError('Invalid email format', 'email', 'INVALID_EMAIL');
        assert.strictEqual(error.message, 'Invalid email format');
        assert.strictEqual(error.validationName, 'email');
        assert.strictEqual(error.code, 'INVALID_EMAIL');
    });

    it('is instanceof Error', () => {
        const error = new ValidationError('Test');
        assert.ok(error instanceof Error);
        assert.ok(error instanceof ValidationError);
    });
});

describe('Additional coverage tests', () => {
    it('validate with len constraint pass', () => {
        const registry = new ValidationRegistry();
        registry.register('exactly5', { len: 5 });
        assert.strictEqual(registry.validate('hello', 'exactly5'), true);
    });

    it('validate with len constraint fail', () => {
        const registry = new ValidationRegistry();
        registry.register('exactly5', { len: 5 });
        assert.strictEqual(registry.validate('hi', 'exactly5'), false);
    });

    it('validate with min constraint pass', () => {
        const registry = new ValidationRegistry();
        registry.register('min3', { min: 3 });
        assert.strictEqual(registry.validate('hello', 'min3'), true);
    });

    it('validate with min constraint fail', () => {
        const registry = new ValidationRegistry();
        registry.register('min3', { min: 3 });
        assert.strictEqual(registry.validate('hi', 'min3'), false);
    });

    it('validate with max constraint pass', () => {
        const registry = new ValidationRegistry();
        registry.register('max5', { max: 5 });
        assert.strictEqual(registry.validate('hi', 'max5'), true);
    });

    it('validate with max constraint fail', () => {
        const registry = new ValidationRegistry();
        registry.register('max5', { max: 5 });
        assert.strictEqual(registry.validate('hello world', 'max5'), false);
    });

    it('validate with combined len and pattern', () => {
        const registry = new ValidationRegistry();
        registry.register('code', { pattern: '^[A-Z]+$', len: 3 });
        assert.strictEqual(registry.validate('ABC', 'code'), true);
        assert.strictEqual(registry.validate('AB', 'code'), false);
        assert.strictEqual(registry.validate('abc', 'code'), false);
    });

    it('validate with min, max, and pattern', () => {
        const registry = new ValidationRegistry();
        registry.register('name', { pattern: '^[a-z]+$', min: 2, max: 10 });
        assert.strictEqual(registry.validate('john', 'name'), true);
        assert.strictEqual(registry.validate('a', 'name'), false);
        assert.strictEqual(registry.validate('verylongname', 'name'), false);
        assert.strictEqual(registry.validate('John', 'name'), false);
    });

    it('validate throws for unknown validation', () => {
        const registry = new ValidationRegistry();
        assert.throws(() => {
            registry.validate('test', 'nonexistent');
        }, /Validation 'nonexistent' not found/);
    });

    it('validate_expression with complex AND chain', () => {
        const registry = new ValidationRegistry();
        registry.register('a', { pattern: '^[a-z]+$' });
        registry.register('b', { min: 3 });
        registry.register('c', { max: 10 });

        assert.strictEqual(registry.validate_expression('hello', 'a&b&c'), true);
        assert.strictEqual(registry.validate_expression('hi', 'a&b&c'), false);
    });

    it('validate_expression with complex OR chain', () => {
        const registry = new ValidationRegistry();
        registry.register('upper', { pattern: '^[A-Z]+$' });
        registry.register('lower', { pattern: '^[a-z]+$' });
        registry.register('digits', { pattern: '^[0-9]+$' });

        assert.strictEqual(registry.validate_expression('ABC', 'upper|lower|digits'), true);
        assert.strictEqual(registry.validate_expression('abc', 'upper|lower|digits'), true);
        assert.strictEqual(registry.validate_expression('123', 'upper|lower|digits'), true);
        assert.strictEqual(registry.validate_expression('ABC123', 'upper|lower|digits'), false);
    });

    it('validate_expression with NOT in complex expression', () => {
        const registry = new ValidationRegistry();
        registry.register('numeric', { pattern: '^[0-9]+$' });
        registry.register('short', { max: 5 });

        // NOT numeric AND short
        assert.strictEqual(registry.validate_expression('abc', '!numeric&short'), true);
        assert.strictEqual(registry.validate_expression('123', '!numeric&short'), false);
        assert.strictEqual(registry.validate_expression('abcdefghij', '!numeric&short'), false);
    });

    it('get returns undefined for unregistered', () => {
        const registry = new ValidationRegistry();
        assert.strictEqual(registry.get('nonexistent'), undefined);
    });

    it('unregister non-existent does not throw', () => {
        const registry = new ValidationRegistry();
        // Should not throw
        registry.unregister('nonexistent');
        assert.ok(true);
    });

    it('STANDARD_VALIDATIONS is frozen object', () => {
        assert.strictEqual(typeof STANDARD_VALIDATIONS, 'object');
        assert.ok(Object.keys(STANDARD_VALIDATIONS).length > 0);
    });

    it('all STANDARD_VALIDATIONS have pattern', () => {
        for (const [name, def] of Object.entries(STANDARD_VALIDATIONS)) {
            assert.ok(def.pattern, `${name} should have pattern`);
        }
    });

    it('validate with empty pattern definition', () => {
        const registry = new ValidationRegistry();
        registry.register('any', {});  // No constraints
        assert.strictEqual(registry.validate('anything', 'any'), true);
        assert.strictEqual(registry.validate('', 'any'), true);
    });
});

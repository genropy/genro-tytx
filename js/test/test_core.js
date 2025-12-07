/**
 * TYTX Base - Core Tests
 *
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    toTypedText,
    fromText,
    toTypedJson,
    fromJson,
    registry,
    DecimalLib,
    decimalLibName,
    isDecimalInstance
} = require('../src/index.js');

describe('TYTX Base - Encode', () => {
    it('should encode Decimal', () => {
        if (!DecimalLib) {
            console.log('Skipping Decimal test - no decimal library');
            return;
        }
        const data = { price: new DecimalLib('100.50') };
        const result = toTypedText(data);
        assert.ok(result.endsWith('::JS'), 'Should have ::JS suffix');
        // Trailing zeros may be stripped (100.50 → 100.5)
        assert.ok(result.includes('::N"'), 'Should contain Decimal with ::N');
        assert.ok(result.includes('"price":"100.5'), 'Should contain price value');
    });

    it('should encode Date', () => {
        const data = { d: new Date('2025-01-15T00:00:00.000Z') };
        const result = toTypedText(data);
        assert.ok(result.endsWith('::JS'), 'Should have ::JS suffix');
        assert.ok(result.includes('"2025-01-15::D"'), 'Should contain date with ::D');
    });

    it('should encode DateTime', () => {
        const data = { dt: new Date('2025-01-15T10:30:00.000Z') };
        const result = toTypedText(data);
        assert.ok(result.endsWith('::JS'), 'Should have ::JS suffix');
        assert.ok(result.includes('::DHZ"'), 'Should contain datetime with ::DHZ');
    });

    it('should encode Time', () => {
        const data = { t: new Date('1970-01-01T10:30:00.000Z') };
        const result = toTypedText(data);
        assert.ok(result.endsWith('::JS'), 'Should have ::JS suffix');
        assert.ok(result.includes('"10:30:00::H"'), 'Should contain time with ::H');
    });

    it('should not add ::JS for native types only', () => {
        const data = { name: 'test', count: 42 };
        const result = toTypedText(data);
        assert.ok(!result.includes('::JS'), 'Should NOT have ::JS suffix for native types');
    });

    it('should handle nested structures', () => {
        const data = {
            invoice: {
                items: [
                    { price: DecimalLib ? new DecimalLib('100.00') : 100.0 }
                ]
            }
        };
        const result = toTypedText(data);
        if (DecimalLib) {
            assert.ok(result.endsWith('::JS'), 'Should have ::JS suffix');
        }
    });
});

describe('TYTX Base - Decode', () => {
    it('should decode Decimal', () => {
        const result = fromText('{"price":"100.50::N"}::JS');
        if (DecimalLib) {
            assert.ok(isDecimalInstance(result.price), 'Should be Decimal instance');
            // Compare numeric values (trailing zeros may be stripped)
            assert.equal(Number(result.price.toString()), 100.50);
        } else {
            assert.equal(result.price, 100.50);
        }
    });

    it('should decode Date', () => {
        const result = fromText('{"d":"2025-01-15::D"}::JS');
        assert.ok(result.d instanceof Date, 'Should be Date instance');
        assert.equal(result.d.getUTCFullYear(), 2025);
        assert.equal(result.d.getUTCMonth(), 0); // January
        assert.equal(result.d.getUTCDate(), 15);
    });

    it('should decode DateTime', () => {
        const result = fromText('{"dt":"2025-01-15T10:30:00Z::DHZ"}::JS');
        assert.ok(result.dt instanceof Date, 'Should be Date instance');
        assert.equal(result.dt.getUTCHours(), 10);
        assert.equal(result.dt.getUTCMinutes(), 30);
    });

    it('should decode deprecated DH', () => {
        const result = fromText('{"dt":"2025-01-15T10:30:00::DH"}::JS');
        assert.ok(result.dt instanceof Date, 'Should be Date instance');
    });

    it('should decode Time', () => {
        const result = fromText('{"t":"10:30:00::H"}::JS');
        assert.ok(result.t instanceof Date, 'Should be Date instance');
        assert.equal(result.t.getUTCHours(), 10);
        assert.equal(result.t.getUTCMinutes(), 30);
    });

    it('should decode Boolean', () => {
        const result = fromText('{"flag":"1::B"}::JS');
        assert.equal(result.flag, true);
    });

    it('should decode Integer (L)', () => {
        const result = fromText('{"count":"42::L"}::JS');
        assert.equal(result.count, 42);
        assert.ok(Number.isInteger(result.count));
    });

    it('should decode Float (R)', () => {
        const result = fromText('{"value":"3.14::R"}::JS');
        assert.equal(result.value, 3.14);
    });

    it('should decode Integer alias (I)', () => {
        const result = fromText('{"count":"42::I"}::JS');
        assert.equal(result.count, 42);
    });

    it('should not hydrate without ::JS marker', () => {
        const result = fromText('{"price":"100.50::N"}');
        assert.equal(result.price, '100.50::N', 'Should remain as string');
    });

    it('should handle unknown suffix', () => {
        const result = fromText('{"value":"test::UNKNOWN"}::JS');
        assert.equal(result.value, 'test::UNKNOWN', 'Should remain as string');
    });

    it('should handle nested structures', () => {
        const result = fromText('{"a":{"b":"100::N"}}::JS');
        if (DecimalLib) {
            assert.ok(isDecimalInstance(result.a.b));
        } else {
            assert.equal(result.a.b, 100);
        }
    });

    it('should handle arrays', () => {
        const result = fromText('["1.0::N","2.0::N"]::JS');
        assert.ok(Array.isArray(result));
        assert.equal(result.length, 2);
    });
});

describe('TYTX Base - JSON Format (with TYTX:// prefix)', () => {
    it('should encode with TYTX:// prefix', () => {
        if (!DecimalLib) {
            console.log('Skipping - no decimal library');
            return;
        }
        const data = { price: new DecimalLib('100.50') };
        const result = toTypedJson(data);
        assert.ok(result.startsWith('TYTX://'), 'Should start with TYTX://');
        assert.ok(result.endsWith('::JS'), 'Should end with ::JS');
    });

    it('should encode native types with prefix but no suffix', () => {
        const data = { name: 'test', count: 42 };
        const result = toTypedJson(data);
        assert.ok(result.startsWith('TYTX://'), 'Should start with TYTX://');
        assert.ok(!result.includes('::JS'), 'Should NOT have ::JS suffix');
    });

    it('should decode with TYTX:// prefix', () => {
        const result = fromJson('TYTX://{"price":"100.50::N"}::JS');
        if (DecimalLib) {
            assert.ok(isDecimalInstance(result.price));
        } else {
            assert.equal(result.price, 100.50);
        }
    });

    it('should decode without TYTX:// prefix', () => {
        const result = fromJson('{"price":"100.50::N"}::JS');
        if (DecimalLib) {
            assert.ok(isDecimalInstance(result.price));
        } else {
            assert.equal(result.price, 100.50);
        }
    });

    it('should roundtrip with prefix', () => {
        if (!DecimalLib) {
            console.log('Skipping - no decimal library');
            return;
        }
        const original = { price: new DecimalLib('100.50') };
        const encoded = toTypedJson(original);
        const decoded = fromJson(encoded);
        // Compare numeric values (trailing zeros may be stripped)
        assert.equal(Number(decoded.price.toString()), 100.50);
    });
});

describe('TYTX Base - Roundtrip', () => {
    it('should roundtrip Decimal', () => {
        if (!DecimalLib) {
            console.log('Skipping - no decimal library');
            return;
        }
        const original = { price: new DecimalLib('100.50') };
        const encoded = toTypedText(original);
        const decoded = fromText(encoded);
        // Compare numeric values (trailing zeros may be stripped)
        assert.equal(Number(decoded.price.toString()), Number(original.price.toString()));
    });

    it('should roundtrip Date', () => {
        const original = { d: new Date('2025-01-15T00:00:00.000Z') };
        const encoded = toTypedText(original);
        const decoded = fromText(encoded);
        assert.equal(decoded.d.getTime(), original.d.getTime());
    });

    it('should roundtrip complex structure', () => {
        const original = {
            invoice: {
                date: new Date('2025-01-15T00:00:00.000Z'),
                items: [
                    { price: DecimalLib ? new DecimalLib('100.00') : 100.0 }
                ]
            }
        };
        const encoded = toTypedText(original);
        const decoded = fromText(encoded);
        assert.equal(decoded.invoice.date.getTime(), original.invoice.date.getTime());
    });
});

describe('TYTX Base - Registry', () => {
    it('should have all types registered', () => {
        assert.ok(registry.get('N'), 'Should have N (Decimal)');
        assert.ok(registry.get('D'), 'Should have D (Date)');
        assert.ok(registry.get('DHZ'), 'Should have DHZ (DateTime)');
        assert.ok(registry.get('DH'), 'Should have DH (Naive DateTime)');
        assert.ok(registry.get('H'), 'Should have H (Time)');
        assert.ok(registry.get('L'), 'Should have L (Integer)');
        assert.ok(registry.get('R'), 'Should have R (Float)');
        assert.ok(registry.get('B'), 'Should have B (Boolean)');
        assert.ok(registry.get('T'), 'Should have T (String)');
        assert.ok(registry.get('I'), 'Should have I (Integer alias)');
    });

    it('should detect decimal library', () => {
        console.log(`Decimal library: ${decimalLibName}`);
        assert.ok(['number', 'big.js', 'decimal.js'].includes(decimalLibName));
    });
});

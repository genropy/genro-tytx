// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Extended roundtrip tests for all TYTX transports and types.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import { toTytx, fromTytx } from '../src/index.js';
import { createDecimal, setDecimalLibrary } from '../src/registry.js';
import { tytxEquivalent } from '../src/utils.js';

// Helper to create Date for date only (midnight UTC)
const date = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

// Helper to create Date for time only (epoch date)
const time = (h, m, s = 0, ms = 0) => new Date(Date.UTC(1970, 0, 1, h, m, s, ms));

// Helper to create Date for datetime
const datetime = (y, mo, d, h = 0, m = 0, s = 0, ms = 0) =>
    new Date(Date.UTC(y, mo - 1, d, h, m, s, ms));

const TRANSPORTS = [null, 'json', 'msgpack', 'xml'];
const DECIMAL_LIBRARIES = ['decimal.js', 'big.js', 'number'];

// Dataset factory - creates fresh data for each library
function createDatasets() {
    return [
        [1, null],
        ['alfa', null],
        [true, null],
        [false, null],
        [null, null],
        [3.14, null],
        [0, null],
        ['', null],
        ['hello world', null],
        [createDecimal('100.50'), null],
        [createDecimal('0'), null],
        [createDecimal('-999.99'), null],
        [date(2025, 1, 15), null],
        [datetime(2025, 1, 15, 10, 30, 0), null],
        [time(10, 30, 0), null],
        [[1, 2, 3], null],
        [{ a: 1, b: 2 }, null],
        [[1, 'alfa', true, null], null],
        [{ a: true, b: 23, c: 'hello' }, null],
        [[[1, 2], [3, 4]], null],
        [{ nested: { a: 1, b: 2 } }, null],
        [[null, null, null], null],
        [{ a: null, b: null }, null],
        [['', '', ''], null],
        [{ a: '', b: '' }, null],
        [[1, null, '', true], null],
        [{ a: 1, b: null, c: '', d: true }, null],
        [[[[1, 2], [3, 4]], [[5, 6], [7, 8]]], null],
        [{ l1: { l2: { l3: { l4: 42 } } } }, null],
        [[{ a: [1, 2] }, { b: [3, 4] }], null],
        [{ x: [{ y: 1 }, { y: 2 }] }, null],
        [[1, createDecimal('10.50'), date(2025, 1, 15)], null],
        [{ price: createDecimal('100.50'), date: date(2025, 1, 15) }, null],
        [[{ price: createDecimal('10.00') }, { price: createDecimal('20.00') }], null],
        [{ items: [createDecimal('1.1'), createDecimal('2.2'), createDecimal('3.3')] }, null],
        [
            {
                order: {
                    total: createDecimal('999.99'),
                    created: datetime(2025, 1, 15, 10, 30),
                },
            },
            null,
        ],
        [[createDecimal('10.50'), null, '', date(2025, 1, 15)], null],
        [
            {
                price: createDecimal('100.50'),
                empty: null,
                text: '',
                date: date(2025, 1, 15),
            },
            null,
        ],
        [[[createDecimal('1.1'), createDecimal('2.2')], [createDecimal('3.3'), createDecimal('4.4')]], null],
        [{ l1: { l2: { amount: createDecimal('999.99'), date: date(2025, 6, 15) } } }, null],
        [
            [{ dt: datetime(2025, 1, 1, 0, 0) }, { dt: datetime(2025, 12, 31, 23, 59) }],
            null,
        ],
        [{ times: [time(8, 0), time(12, 30), time(18, 0)] }, null],
        [{ info: { amount: createDecimal('100'), empty: null, text: '' } }, null],
        [[{ a: null, b: createDecimal('1') }, { a: '', b: date(2025, 1, 1) }], null],
        [{ outer: { inner: [null, '', createDecimal('0'), date(2025, 1, 1)] } }, null],
        // XML-only (attrs/value structure)
        [{ root: { attrs: {}, value: 'text' } }, ['xml']],
        [{ root: { attrs: { id: 123 }, value: null } }, ['xml']],
        [{ root: { attrs: { price: createDecimal('100.50') }, value: 'content' } }, ['xml']],
        [{ root: { attrs: { date: date(2025, 1, 15) }, value: 42 } }, ['xml']],
        [
            {
                order: {
                    attrs: { id: 1 },
                    value: { item: { attrs: {}, value: 'apple' } },
                },
            },
            ['xml'],
        ],
        [
            {
                root: {
                    attrs: {},
                    value: { child: { attrs: { x: 1 }, value: createDecimal('99.99') } },
                },
            },
            ['xml'],
        ],
        [
            {
                data: {
                    attrs: { created: datetime(2025, 1, 15, 10, 30) },
                    value: { name: { attrs: {}, value: 'test' } },
                },
            },
            ['xml'],
        ],
        // Aware datetime (UTC) - JS Date is always UTC internally
        [datetime(2025, 1, 15, 10, 30, 0), null],
        [{ dt: datetime(2025, 6, 15, 14, 30) }, null],
        // XML with bool/float attrs - covers force_suffix
        [{ root: { attrs: { active: true, rate: 3.14 }, value: 'data' } }, ['xml']],
        [{ root: { attrs: { disabled: false, score: 0.0 }, value: 123 } }, ['xml']],
        // XML with multiple children - covers list serialization/deserialization
        [
            {
                root: {
                    attrs: {},
                    value: [
                        { item: { attrs: {}, value: 'a' } },
                        { item: { attrs: {}, value: 'b' } },
                    ],
                },
            },
            ['xml'],
        ],
        // XML with scalar list value - covers else branch in list serialization
        [{ root: { attrs: {}, value: [1, 2, 3] } }, ['xml']],
    ];
}

/**
 * Yield all valid test case combinations as [value, transport, decimalLib].
 */
function* datasetIterator() {
    for (const decimalLib of DECIMAL_LIBRARIES) {
        setDecimalLibrary(decimalLib);
        const datasets = createDatasets();
        for (const [value, transports] of datasets) {
            const validTransports = transports || TRANSPORTS;
            for (const transport of validTransports) {
                yield [value, transport, decimalLib];
            }
        }
    }
}

/**
 * Run all roundtrip tests and return failures.
 */
function runTests() {
    const fails = {};
    let index = 0;

    for (const [value, transport, decimalLib] of datasetIterator()) {
        try {
            const txt = toTytx(value, transport);
            const nv = fromTytx(txt, transport);
            if (!tytxEquivalent(value, nv)) {
                fails[index] = { decimalLib, transport, value, txt, result: nv, error: null };
            }
        } catch (e) {
            fails[index] = { decimalLib, transport, value, txt: null, result: null, error: e.message };
        }
        index++;
    }

    return fails;
}

describe('TestExtendedRoundtrip', () => {
    test('invalid transport encode', () => {
        assert.throws(
            () => toTytx(1, 'foo'),
            /Unknown transport/
        );
    });

    test('invalid transport decode', () => {
        assert.throws(
            () => fromTytx('test', 'foo'),
            /Unknown transport/
        );
    });

    test('deserialize str suffix', () => {
        assert.strictEqual(fromTytx('hello::T'), 'hello');
    });

    test('deserialize datetime without Z', () => {
        const result = fromTytx('2025-01-15T10:30:00+00:00::DHZ');
        const expected = datetime(2025, 1, 15, 10, 30, 0);
        assert.strictEqual(result.getTime(), expected.getTime());
    });

    test('from_tytx null', () => {
        assert.strictEqual(fromTytx(null), null);
    });

    test('from_xml single child', () => {
        setDecimalLibrary('decimal.js');
        const result = fromTytx('<order><item>100::N</item></order>', 'xml');
        assert.deepStrictEqual(result, {
            order: {
                attrs: {},
                value: { item: { attrs: {}, value: createDecimal('100') } },
            },
        });
    });

    // Parametrized roundtrip tests
    let testIndex = 0;
    for (const [value, transport, decimalLib] of datasetIterator()) {
        const idx = testIndex++;
        test(`roundtrip ${idx} decimalLib=${decimalLib} transport=${transport}`, () => {
            setDecimalLibrary(decimalLib);
            const txt = toTytx(value, transport);
            const result = fromTytx(txt, transport);
            assert.ok(
                tytxEquivalent(value, result),
                `Mismatch: ${JSON.stringify(value)} -> ${txt} -> ${JSON.stringify(result)}`
            );
        });
    }
});

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('test_extended.js')) {
    const fails = runTests();

    if (Object.keys(fails).length > 0) {
        console.log('\nRoundtrip failures:\n');
        for (const [idx, { decimalLib, transport, value, txt, result, error }] of Object.entries(fails)) {
            console.log(`  [index=${idx}] decimalLib=${decimalLib} transport=${transport}`);
            console.log(`    original: ${JSON.stringify(value)}`);
            console.log(`    serialized: ${txt}`);
            console.log(`    result: ${JSON.stringify(result)}`);
            if (error) console.log(`    error: ${error}`);
            console.log();
        }
    } else {
        const total = [...datasetIterator()].length;
        console.log(`\nAll ${total} roundtrips passed!`);
    }
}

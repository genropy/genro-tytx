// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Extended roundtrip tests for all TYTX transports and types.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';

import { toTytx, fromTytx } from '../src/index.js';
import { createDecimal, setDecimalLibrary } from '../src/registry.js';
import { tytxEquivalent } from '../src/utils.js';

const require = createRequire(import.meta.url);

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

describe('TestPlainJsonDecode', () => {
    test('plain JSON dict with transport=json', () => {
        const result = fromTytx('{"key": "value", "count": 42}', 'json');
        assert.deepStrictEqual(result, { key: 'value', count: 42 });
    });

    test('plain JSON list with transport=json', () => {
        const result = fromTytx('[1, 2, 3]', 'json');
        assert.deepStrictEqual(result, [1, 2, 3]);
    });

    test('plain JSON nested dict with transport=json', () => {
        const result = fromTytx('{"jsonrpc": "2.0", "id": 1, "method": "initialize"}', 'json');
        assert.deepStrictEqual(result, { jsonrpc: '2.0', id: 1, method: 'initialize' });
    });

    test('TYTX-wrapped JSON still works with transport=json', () => {
        setDecimalLibrary('decimal.js');
        const data = { price: createDecimal('99.99') };
        const encoded = toTytx(data, 'json');
        const result = fromTytx(encoded, 'json');
        assert.ok(
            tytxEquivalent(data, result),
            `TYTX-wrapped mismatch: ${JSON.stringify(data)} -> ${encoded} -> ${JSON.stringify(result)}`
        );
    });
});

describe('TestRawEncoding', () => {
    test('raw=true with JSON produces plain JSON without TYTX suffixes', () => {
        const data = { price: 100.50, name: 'test', active: true };
        const result = toTytx(data, null, { raw: true });
        const parsed = JSON.parse(result);
        assert.deepStrictEqual(parsed, data);
        assert.ok(!result.includes('::JS'));
        assert.ok(!result.includes('::N'));
    });

    test('raw=true with transport=json produces plain JSON', () => {
        const data = { items: [1, 2, 3] };
        const result = toTytx(data, 'json', { raw: true });
        const parsed = JSON.parse(result);
        assert.deepStrictEqual(parsed, data);
    });

    test('raw=true with msgpack produces plain msgpack without TYTX processing', () => {
        const mp = require('@msgpack/msgpack');
        const data = { count: 42, values: [1, 2, 3] };
        const result = toTytx(data, 'msgpack', { raw: true });
        // Verify it equals plain msgpack encoding (no TYTX suffix strings)
        const expected = mp.encode(data);
        assert.deepStrictEqual(result, expected);
        // Verify it decodes back to original data
        const parsed = mp.decode(result);
        assert.deepStrictEqual(parsed, data);
    });

    test('raw=true with XML raises an error', () => {
        assert.throws(
            () => toTytx({ a: 1 }, 'xml', { raw: true }),
            /raw=true is not supported for XML/
        );
    });
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

describe('RAW bytes', () => {
    const samples = [
        [], [0], [0, 0, 0], [97], [97, 98], [97, 98, 99], [97, 98, 99, 100],
        [255, 254, 253], Array.from({ length: 256 }, (_, i) => i),
    ];
    const wrapped = (bytes) => ({
        blob: new Uint8Array(bytes), items: [new Uint8Array(bytes), 'k', 1], n: bytes.length,
    });
    const sameBytes = (a, b) => a instanceof Uint8Array && Array.from(a).join() === Array.from(b).join();

    test('scalar is standard base64', () => {
        assert.strictEqual(toTytx(new Uint8Array([97, 98])), 'YWI=::RAW');
        assert.strictEqual(toTytx(new Uint8Array([])), '::RAW');
        assert.strictEqual(toTytx(new Uint8Array([0])), 'AA==::RAW');
        assert.strictEqual(toTytx(new Uint8Array([0, 1, 2])), 'AAEC::RAW');
    });

    test('inside a structure marks the json', () => {
        assert.strictEqual(toTytx({ b: new Uint8Array([0]) }), '{"b":"AA==::RAW"}::JS');
    });

    test('Buffer is a Uint8Array and travels as RAW', () => {
        assert.strictEqual(toTytx(Buffer.from('ab')), 'YWI=::RAW');
    });

    test('msgpack is native bin: a plain reader sees the bytes', () => {
        const { decode } = require('@msgpack/msgpack');
        const plain = decode(toTytx({ b: new Uint8Array([0, 97, 98]) }, 'msgpack'));
        assert.ok(sameBytes(plain.b, [0, 97, 98]));
    });

    test('invalid base64 is an error', () => {
        assert.throws(() => fromTytx('not base64!::RAW'), /not standard padded base64/);
    });

    test('lenient base64 is refused like Python does', () => {
        // Missing padding, inner space, character outside the alphabet,
        // trailing newline, padding too short.
        for (const bad of ['YQ::RAW', 'Y Q==::RAW', 'Y*==::RAW', 'YQ==\n::RAW', 'YQ=::RAW', ' YQ==::RAW']) {
            assert.throws(() => fromTytx(bad), /not standard padded base64/, bad);
        }
    });

    for (const bytes of samples) {
        for (const transport of [null, 'json', 'msgpack']) {
            test(`dict and list round trip len=${bytes.length} transport=${transport}`, () => {
                const decoded = fromTytx(toTytx(wrapped(bytes), transport), transport);
                assert.ok(sameBytes(decoded.blob, bytes));
                assert.ok(sameBytes(decoded.items[0], bytes));
                assert.strictEqual(decoded.items[1], 'k');
                assert.strictEqual(decoded.n, bytes.length);
            });
        }
        test(`xml text and attribute round trip len=${bytes.length}`, () => {
            const value = { root: { attrs: { sig: new Uint8Array(bytes) }, value: wrapped(bytes) } };
            const decoded = fromTytx(toTytx(value, 'xml'), 'xml');
            assert.ok(sameBytes(decoded.root.attrs.sig, bytes));
            assert.ok(sameBytes(decoded.root.value.blob, bytes));
            assert.ok(sameBytes(decoded.root.value.items[0], bytes));
        });
    }
});

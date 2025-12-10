// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * HTTP cross-language roundtrip tests (JS → Python → JS).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchTytx, getTransport } from '../src/index.js';
import { createDecimal, setDecimalLibrary } from '../src/registry.js';
import { tytxEquivalent } from '../src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to create Date for date only (midnight UTC)
const date = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

// Helper to create Date for time only (epoch date)
const time = (h, m, s = 0, ms = 0) => new Date(Date.UTC(1970, 0, 1, h, m, s, ms));

// Helper to create Date for datetime (with at least 1ms to avoid date/datetime ambiguity)
const datetime = (y, mo, d, h = 0, m = 0, s = 0, ms = 1) =>
    new Date(Date.UTC(y, mo - 1, d, h, m, s, ms));

const PYTHON_SERVER_PORT = 3457;
const PYTHON_SERVER_URL = `http://localhost:${PYTHON_SERVER_PORT}/echo`;

const HTTP_TRANSPORTS = ['json', 'xml', 'msgpack'];

// Dataset for HTTP tests (same as test_extended but with datetime fix)
function createHttpDatasets() {
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
        [datetime(2025, 1, 15, 10, 30, 0, 1), null],
        [time(10, 30, 0, 1), null],
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
                    created: datetime(2025, 1, 15, 10, 30, 0, 1),
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
            [{ dt: datetime(2025, 1, 1, 0, 0, 0, 1) }, { dt: datetime(2025, 12, 31, 23, 59, 0, 1) }],
            null,
        ],
        [{ times: [time(8, 0, 0, 1), time(12, 30, 0, 1), time(18, 0, 0, 1)] }, null],
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
                    attrs: { created: datetime(2025, 1, 15, 10, 30, 0, 1) },
                    value: { name: { attrs: {}, value: 'test' } },
                },
            },
            ['xml'],
        ],
        // Aware datetime (UTC) - JS Date is always UTC internally
        [datetime(2025, 1, 15, 10, 30, 0, 1), null],
        [{ dt: datetime(2025, 6, 15, 14, 30, 0, 1) }, null],
        // XML with bool/float attrs
        [{ root: { attrs: { active: true, rate: 3.14 }, value: 'data' } }, ['xml']],
        [{ root: { attrs: { disabled: false, score: 0.0 }, value: 123 } }, ['xml']],
        // XML with multiple children
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
        // XML with scalar list value
        [{ root: { attrs: {}, value: [1, 2, 3] } }, ['xml']],
    ];
}

/**
 * Yield all valid HTTP test case combinations.
 */
function* httpDatasetIterator() {
    setDecimalLibrary('decimal.js');
    const datasets = createHttpDatasets();
    for (const [value, transports] of datasets) {
        const validTransports = transports || HTTP_TRANSPORTS;
        for (const transport of validTransports) {
            if (HTTP_TRANSPORTS.includes(transport)) {
                yield [value, transport];
            }
        }
    }
}


/**
 * Wait for server to be ready.
 */
async function waitForServer(url, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(url.replace('/echo', '/health'), {
                signal: AbortSignal.timeout(1000)
            });
            if (response.ok) return true;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return false;
}

describe('TestHTTPUtilities', () => {
    test('getTransport null', () => {
        assert.strictEqual(getTransport(null), null);
        assert.strictEqual(getTransport(''), null);
    });

    test('getTransport json', () => {
        assert.strictEqual(getTransport('application/json'), 'json');
        assert.strictEqual(getTransport('application/json; charset=utf-8'), 'json');
    });

    test('getTransport xml', () => {
        assert.strictEqual(getTransport('application/xml'), 'xml');
        assert.strictEqual(getTransport('text/xml'), 'xml');
    });

    test('getTransport msgpack', () => {
        assert.strictEqual(getTransport('application/msgpack'), 'msgpack');
    });

    test('getTransport unknown', () => {
        assert.strictEqual(getTransport('text/plain'), null);
    });
});

describe('TestHTTPCrossLanguageRoundtrip (JS → Python → JS)', () => {
    let pythonServer = null;

    before(async () => {
        // Start Python echo server
        const serverPath = path.join(__dirname, '..', '..', 'tests', 'server_echo.py');
        pythonServer = spawn('python', [serverPath, String(PYTHON_SERVER_PORT)], {
            cwd: path.join(__dirname, '..', '..'),
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Wait for server to start
        const ready = await waitForServer(PYTHON_SERVER_URL);
        if (!ready) {
            pythonServer.kill();
            throw new Error('Python server failed to start');
        }
    });

    after(() => {
        if (pythonServer) {
            pythonServer.kill();
        }
    });

    // Generate tests
    let testIndex = 0;
    for (const [value, transport] of httpDatasetIterator()) {
        const idx = testIndex++;
        test(`roundtrip via Python ${idx} transport=${transport}`, async () => {
            setDecimalLibrary('decimal.js');
            // fetchTytx fa serializzazione/deserializzazione automaticamente
            const result = await fetchTytx(PYTHON_SERVER_URL, { body: value, transport });
            assert.ok(
                tytxEquivalent(value, result),
                `Mismatch: ${JSON.stringify(value)} -> ${JSON.stringify(result)}`
            );
        });
    }
});

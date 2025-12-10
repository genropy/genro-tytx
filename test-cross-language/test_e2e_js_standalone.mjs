/**
 * Standalone E2E Test for JavaScript Client.
 *
 * Requires the Python server to be running:
 *   python server_asgi.py
 *
 * Then run:
 *   node test_e2e_js_standalone.mjs
 *
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import {
    tytx_fetch,
    createDate,
    createTime,
    createDateTime,
    DecimalLib,
} from '../js/src/index.js';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:8765';

async function runTests() {
    console.log('TYTX E2E JavaScript Client Tests');
    console.log(`Server: ${SERVER_URL}`);
    console.log('');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`✓ ${name}`);
            passed++;
        } catch (err) {
            console.log(`✗ ${name}`);
            console.log(`  Error: ${err.message}`);
            failed++;
        }
    }

    function assertEqual(actual, expected, msg = '') {
        if (actual !== expected) {
            throw new Error(`${msg}: expected ${expected}, got ${actual}`);
        }
    }

    function assertOk(value, msg = '') {
        if (!value) {
            throw new Error(`${msg}: expected truthy value, got ${value}`);
        }
    }

    // Health check
    await test('Health check', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/health`);
        assertEqual(result.status, 'ok', 'Status');
    });

    // Receive types
    await test('Receive Decimal', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/types`);
        assertOk(DecimalLib, 'DecimalLib');
        assertEqual(Number(result.decimal.toString()), 123.456, 'Decimal value');
    });

    await test('Receive Date', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/types`);
        assertOk(result.date instanceof Date, 'Is Date');
        assertEqual(result.date.getUTCFullYear(), 2025, 'Year');
        assertEqual(result.date.getUTCMonth(), 5, 'Month (June=5)');
        assertEqual(result.date.getUTCDate(), 15, 'Day');
    });

    await test('Receive DateTime', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/types`);
        assertOk(result.datetime instanceof Date, 'Is Date');
        assertEqual(result.datetime.getUTCFullYear(), 2025, 'Year');
        assertEqual(result.datetime.getUTCHours(), 10, 'Hour');
    });

    await test('Receive Time', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/types`);
        assertOk(result.time instanceof Date, 'Is Date');
        assertEqual(result.time.getUTCHours(), 14, 'Hour');
        assertEqual(result.time.getUTCMinutes(), 45, 'Minute');
    });

    await test('Receive native types', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/types`);
        assertEqual(result.string, 'hello', 'String');
        assertEqual(result.integer, 42, 'Integer');
        assertEqual(result.boolean, true, 'Boolean');
        assertEqual(result.null, null, 'Null');
    });

    // Query parameters
    await test('Send Date in query', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/echo`, {
            query: { date: createDate(2025, 1, 15) },
        });
        assertEqual(result.query.date._type, 'date', 'Type');
        assertEqual(result.query.date.value, '2025-01-15', 'Value');
    });

    await test('Send Decimal in query', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/echo`, {
            query: { price: new DecimalLib('99.99') },
        });
        assertEqual(result.query.price._type, 'Decimal', 'Type');
        assertEqual(result.query.price.value, '99.99', 'Value');
    });

    // POST body
    await test('Send typed body', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/echo`, {
            method: 'POST',
            body: {
                price: new DecimalLib('100.50'),
                date: createDate(2025, 6, 15),
            },
        });
        assertEqual(result.body.price._type, 'Decimal', 'Price type');
        assertEqual(result.body.date._type, 'date', 'Date type');
    });

    // Computation
    await test('Server computation', async () => {
        const result = await tytx_fetch(`${SERVER_URL}/compute`, {
            method: 'POST',
            body: {
                price: new DecimalLib('100.00'),
                quantity: 5,
                tax_rate: new DecimalLib('0.22'),
            },
        });
        assertEqual(Number(result.subtotal.toString()), 500, 'Subtotal');
        assertEqual(Number(result.tax.toString()), 110, 'Tax');
        assertEqual(Number(result.total.toString()), 610, 'Total');
        assertOk(result.computed_at instanceof Date, 'computed_at is Date');
    });

    // Summary
    console.log('');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    process.exit(failed > 0 ? 1 : 0);
}

// Check server is up first
try {
    const response = await fetch(`${SERVER_URL}/health`);
    if (!response.ok) {
        throw new Error('Server not healthy');
    }
} catch (err) {
    console.error(`Cannot connect to server at ${SERVER_URL}`);
    console.error('Start the server with: python server_asgi.py');
    process.exit(1);
}

runTests();

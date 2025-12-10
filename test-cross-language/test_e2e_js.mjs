/**
 * End-to-End Tests for TYTX HTTP Integration (JavaScript Client).
 *
 * Tests real HTTP communication between JS client and Python ASGI server.
 *
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

// Import from the JS package
import {
    tytx_fetch,
    createDate,
    createTime,
    createDateTime,
    fromText,
    DecimalLib,
} from '../js/src/index.js';

const SERVER_PORT = 8765;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

let serverProcess = null;

/**
 * Wait for server to be ready by polling health endpoint.
 */
async function waitForServer(url, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const response = await fetch(`${url}/health`);
            if (response.ok) {
                return true;
            }
        } catch {
            // Server not ready yet
        }
        await setTimeout(200);
    }
    return false;
}

/**
 * Start the Python ASGI server.
 */
async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('python', ['server_asgi.py'], {
            cwd: new URL('.', import.meta.url).pathname,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        serverProcess.on('error', reject);

        // Wait for server to start
        waitForServer(SERVER_URL).then(ready => {
            if (ready) {
                resolve();
            } else {
                reject(new Error('Server failed to start'));
            }
        });
    });
}

/**
 * Stop the Python server.
 */
function stopServer() {
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}

describe('TYTX E2E JavaScript Client', { skip: !DecimalLib }, () => {
    before(async () => {
        try {
            await startServer();
        } catch (err) {
            console.log('Skipping E2E tests: could not start server');
            console.log('Install uvicorn: pip install uvicorn');
            throw err;
        }
    });

    after(() => {
        stopServer();
    });

    describe('Health Check', () => {
        it('should connect to server', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/health`);
            assert.equal(result.status, 'ok');
        });
    });

    describe('Receive Typed Values', () => {
        it('should receive Decimal from server', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/types`);
            assert.ok(DecimalLib);
            // The server returns Decimal, client should receive it
            assert.equal(Number(result.decimal.toString()), 123.456);
        });

        it('should receive Date from server', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/types`);
            assert.ok(result.date instanceof Date);
            assert.equal(result.date.getUTCFullYear(), 2025);
            assert.equal(result.date.getUTCMonth(), 5); // June = 5
            assert.equal(result.date.getUTCDate(), 15);
        });

        it('should receive DateTime from server', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/types`);
            assert.ok(result.datetime instanceof Date);
            assert.equal(result.datetime.getUTCFullYear(), 2025);
            assert.equal(result.datetime.getUTCHours(), 10);
        });

        it('should receive Time from server', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/types`);
            assert.ok(result.time instanceof Date);
            assert.equal(result.time.getUTCHours(), 14);
            assert.equal(result.time.getUTCMinutes(), 45);
        });

        it('should receive native types from server', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/types`);
            assert.equal(result.string, 'hello');
            assert.equal(result.integer, 42);
            assert.equal(result.boolean, true);
            assert.equal(result.null, null);
        });
    });

    describe('Send Query Parameters', () => {
        it('should send Date in query string', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/echo`, {
                query: { date: createDate(2025, 1, 15) },
            });
            assert.equal(result.query.date._type, 'date');
            assert.equal(result.query.date.value, '2025-01-15');
        });

        it('should send Decimal in query string', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/echo`, {
                query: { price: new DecimalLib('99.99') },
            });
            assert.equal(result.query.price._type, 'Decimal');
            assert.equal(result.query.price.value, '99.99');
        });

        it('should send mixed types in query string', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/echo`, {
                query: {
                    date: createDate(2025, 3, 20),
                    price: new DecimalLib('150.00'),
                    limit: 10,
                    name: 'test',
                },
            });
            assert.equal(result.query.date._type, 'date');
            assert.equal(result.query.price._type, 'Decimal');
            assert.equal(result.query.limit, '10');
            assert.equal(result.query.name, 'test');
        });
    });

    describe('Send POST Body', () => {
        it('should send typed values in body', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/echo`, {
                method: 'POST',
                body: {
                    price: new DecimalLib('100.50'),
                    date: createDate(2025, 6, 15),
                    datetime: createDateTime(2025, 6, 15, 10, 30, 0),
                },
            });
            assert.equal(result.body.price._type, 'Decimal');
            assert.equal(result.body.price.value, '100.50');
            assert.equal(result.body.date._type, 'date');
            assert.equal(result.body.datetime._type, 'datetime');
        });
    });

    describe('Server Computation', () => {
        it('should compute with Decimal values', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/compute`, {
                method: 'POST',
                body: {
                    price: new DecimalLib('100.00'),
                    quantity: 5,
                    tax_rate: new DecimalLib('0.22'),
                },
            });

            // Server computes: 100 * 5 = 500, tax = 110, total = 610
            assert.equal(Number(result.subtotal.toString()), 500);
            assert.equal(Number(result.tax.toString()), 110);
            assert.equal(Number(result.total.toString()), 610);

            // computed_at should be a datetime
            assert.ok(result.computed_at instanceof Date);
        });

        it('should compute with different values', async () => {
            const result = await tytx_fetch(`${SERVER_URL}/compute`, {
                method: 'POST',
                body: {
                    price: new DecimalLib('50.00'),
                    quantity: 3,
                    tax_rate: new DecimalLib('0.10'),
                },
            });

            // Server computes: 50 * 3 = 150, tax = 15, total = 165
            assert.equal(Number(result.subtotal.toString()), 150);
            assert.equal(Number(result.tax.toString()), 15);
            assert.equal(Number(result.total.toString()), 165);
        });
    });

    describe('Full Roundtrip', () => {
        it('should roundtrip all types through server', async () => {
            const original = {
                decimal: new DecimalLib('999.123456'),
                date: createDate(2025, 12, 31),
                datetime: createDateTime(2025, 12, 31, 23, 59, 59),
                time: createTime(12, 30, 45),
            };

            const result = await tytx_fetch(`${SERVER_URL}/echo`, {
                method: 'POST',
                body: original,
            });

            assert.equal(result.body.decimal.value, '999.123456');
            assert.equal(result.body.date.value, '2025-12-31');
            assert.ok(result.body.datetime.value.includes('2025-12-31'));
            assert.equal(result.body.time.value, '12:30:45');
        });
    });
});

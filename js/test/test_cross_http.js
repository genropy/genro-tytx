/**
 * Cross-Language HTTP Round-Trip Tests
 *
 * These tests verify TYTX compatibility between JavaScript and Python
 * by making HTTP requests to a Python test server.
 *
 * Run with: CROSS_LANG=1 npm run test:cross
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const { fetch_typed, fetch_typed_request } = require('../src');
const { packb } = require('../src/msgpack_utils');

// Server configuration
const SERVER_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;

// Server process reference
let serverProcess = null;

/**
 * Start Python test server.
 */
async function startServer() {
    return new Promise((resolve, reject) => {
        const projectRoot = path.resolve(__dirname, '../..');
        serverProcess = spawn('python', ['-m', 'tests.test_cross_language_server'], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env }
        });

        let output = '';
        serverProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('running on')) {
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error('Server stderr:', data.toString());
        });

        serverProcess.on('error', (err) => {
            reject(new Error(`Failed to start server: ${err.message}`));
        });

        serverProcess.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                reject(new Error(`Server exited with code ${code}`));
            }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            reject(new Error('Server start timeout'));
        }, 10000);
    });
}

/**
 * Stop Python test server.
 */
function stopServer() {
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}

/**
 * Wait for server to be ready.
 */
async function waitForServer(maxRetries = 20) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(`${BASE_URL}/health`);
            if (response.ok) return true;
        } catch {
            // Server not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

// =============================================================================
// Cross-Language HTTP Tests
// =============================================================================

describe('Cross-Language HTTP Round-Trip', { skip: !process.env.CROSS_LANG }, () => {

    before(async () => {
        try {
            await startServer();
        } catch (err) {
            console.log('Could not start server automatically, trying to connect to existing...');
        }
        const ready = await waitForServer();
        if (!ready) {
            throw new Error(`Python server not available at ${BASE_URL}`);
        }
        console.log(`Connected to Python server at ${BASE_URL}`);
    });

    after(() => {
        stopServer();
    });

    // =========================================================================
    // GET JSON endpoint - Python serves, JS receives
    // =========================================================================

    describe('Python → JS: JSON', () => {
        test('hydrates integer correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.strictEqual(result.integer, 42);
            assert.strictEqual(typeof result.integer, 'number');
        });

        test('hydrates float correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.ok(Math.abs(result.float - 3.14159) < 0.0001);
        });

        test('hydrates decimal correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.strictEqual(Number(result.decimal), 99.99);
        });

        test('hydrates string correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.strictEqual(result.string, 'hello world');
        });

        test('hydrates boolean correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.strictEqual(result.boolean, true);
        });

        test('hydrates date correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.ok(result.date instanceof Date);
            assert.strictEqual(result.date.getUTCFullYear(), 2025);
            assert.strictEqual(result.date.getUTCMonth(), 0); // January
            assert.strictEqual(result.date.getUTCDate(), 15);
        });

        test('hydrates datetime correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.ok(result.datetime instanceof Date);
            assert.strictEqual(result.datetime.getUTCHours(), 10);
            assert.strictEqual(result.datetime.getUTCMinutes(), 30);
        });

        test('hydrates time correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.ok(result.time instanceof Date);
            assert.strictEqual(result.time.getUTCHours(), 14);
            assert.strictEqual(result.time.getUTCMinutes(), 30);
        });

        test('hydrates null correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.strictEqual(result.null, null);
        });

        test('hydrates array correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.ok(Array.isArray(result.array));
            assert.deepStrictEqual(result.array, [1, 2, 3]);
        });

        test('hydrates nested object correctly', async () => {
            const result = await fetch_typed(`${BASE_URL}/json`);
            assert.strictEqual(result.nested.x, 10);
            assert.strictEqual(result.nested.y, 20);
        });
    });

    // =========================================================================
    // GET msgpack endpoint - Python serves, JS receives
    // =========================================================================

    describe('Python → JS: msgpack', () => {
        test('hydrates all types from msgpack', async () => {
            const result = await fetch_typed(`${BASE_URL}/msgpack`);

            assert.strictEqual(result.integer, 42);
            assert.strictEqual(result.string, 'hello world');
            assert.strictEqual(result.boolean, true);
            assert.ok(result.date instanceof Date);
            assert.ok(result.datetime instanceof Date);
        });
    });

    // =========================================================================
    // GET text endpoints - Python serves, JS receives
    // =========================================================================

    describe('Python → JS: typed text', () => {
        test('hydrates typed integer', async () => {
            const result = await fetch_typed(`${BASE_URL}/text/integer`);
            assert.strictEqual(result, 42);
            assert.strictEqual(typeof result, 'number');
        });

        test('hydrates typed decimal', async () => {
            const result = await fetch_typed(`${BASE_URL}/text/decimal`);
            assert.strictEqual(Number(result), 99.99);
        });

        test('hydrates typed date', async () => {
            const result = await fetch_typed(`${BASE_URL}/text/date`);
            assert.ok(result instanceof Date);
            assert.strictEqual(result.getUTCFullYear(), 2025);
            assert.strictEqual(result.getUTCMonth(), 0);
            assert.strictEqual(result.getUTCDate(), 15);
        });
    });

    // =========================================================================
    // POST echo endpoints - JS sends, Python echoes back, JS receives
    // =========================================================================

    describe('JS → Python → JS: JSON echo', () => {
        test('round-trip preserves integer', async () => {
            const input = { value: 12345 };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.strictEqual(result.value, 12345);
        });

        test('round-trip preserves float', async () => {
            const input = { value: 3.14159 };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.ok(Math.abs(result.value - 3.14159) < 0.0001);
        });

        test('round-trip preserves boolean', async () => {
            const input = { active: true, disabled: false };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.strictEqual(result.active, true);
            assert.strictEqual(result.disabled, false);
        });

        test('round-trip preserves date', async () => {
            const date = new Date('2025-01-15T00:00:00Z');
            const input = { created: date };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.ok(result.created instanceof Date);
            assert.strictEqual(result.created.getUTCFullYear(), 2025);
            assert.strictEqual(result.created.getUTCMonth(), 0);
            assert.strictEqual(result.created.getUTCDate(), 15);
        });

        test('round-trip preserves datetime', async () => {
            const datetime = new Date('2025-06-15T14:30:45Z');
            const input = { timestamp: datetime };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.ok(result.timestamp instanceof Date);
            assert.strictEqual(result.timestamp.getUTCHours(), 14);
            assert.strictEqual(result.timestamp.getUTCMinutes(), 30);
        });

        test('round-trip preserves array', async () => {
            const input = { items: [1, 2, 3, 4, 5] };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.deepStrictEqual(result.items, [1, 2, 3, 4, 5]);
        });

        test('round-trip preserves nested object', async () => {
            const input = {
                user: {
                    id: 123,
                    name: 'test',
                    meta: { role: 'admin' }
                }
            };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });
            assert.strictEqual(result.user.id, 123);
            assert.strictEqual(result.user.name, 'test');
            assert.strictEqual(result.user.meta.role, 'admin');
        });

        test('round-trip preserves complex object', async () => {
            const input = {
                id: 999,
                price: 149.99,
                created: new Date('2025-03-20T08:15:30Z'),
                active: true,
                tags: ['premium', 'featured'],
                details: {
                    weight: 2.5,
                    dimensions: { width: 10, height: 20 }
                }
            };
            const result = await fetch_typed_request(`${BASE_URL}/echo/json`, {
                body: input,
                sendAs: 'json',
                expect: 'json'
            });

            assert.strictEqual(result.id, 999);
            assert.ok(Math.abs(result.price - 149.99) < 0.01);
            assert.ok(result.created instanceof Date);
            assert.strictEqual(result.active, true);
            assert.deepStrictEqual(result.tags, ['premium', 'featured']);
            assert.ok(Math.abs(result.details.weight - 2.5) < 0.01);
            assert.strictEqual(result.details.dimensions.width, 10);
        });
    });

    describe('JS → Python → JS: msgpack echo', () => {
        test('msgpack round-trip preserves types', async () => {
            const input = {
                id: 456,
                value: 3.14,
                timestamp: new Date('2025-06-01T12:00:00Z'),
                active: true
            };

            const result = await fetch_typed_request(`${BASE_URL}/echo/msgpack`, {
                body: input,
                sendAs: 'msgpack',
                expect: 'msgpack'
            });

            assert.strictEqual(result.id, 456);
            assert.ok(Math.abs(result.value - 3.14) < 0.01);
            assert.ok(result.timestamp instanceof Date);
            assert.strictEqual(result.active, true);
        });
    });
});

/**
 * TYTX Fetch Tests
 *
 * Tests for fetch utilities in the JavaScript implementation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { fetch_typed, fetch_xtytx, fetch_typed_request, build_xtytx_envelope, detectExpect } = require('../src');
const { as_typed_json } = require('../src/json_utils');
const { registry } = require('../src/registry');
const { packb } = require('../src/msgpack_utils');

// =============================================================================
// detectExpect Tests
// =============================================================================

describe('detectExpect', () => {
    test('returns text for null/undefined content-type', () => {
        assert.strictEqual(detectExpect(null), 'text');
        assert.strictEqual(detectExpect(undefined), 'text');
        assert.strictEqual(detectExpect(''), 'text');
    });

    test('returns json for json content-type', () => {
        assert.strictEqual(detectExpect('application/json'), 'json');
        assert.strictEqual(detectExpect('application/JSON'), 'json');
        assert.strictEqual(detectExpect('text/json'), 'json');
    });

    test('returns xml for xml content-type', () => {
        assert.strictEqual(detectExpect('application/xml'), 'xml');
        assert.strictEqual(detectExpect('text/xml'), 'xml');
        assert.strictEqual(detectExpect('APPLICATION/XML'), 'xml');
    });

    test('returns msgpack for msgpack content-type', () => {
        assert.strictEqual(detectExpect('application/msgpack'), 'msgpack');
        assert.strictEqual(detectExpect('application/x-msgpack'), 'msgpack');
    });

    test('returns text for unknown content-type', () => {
        assert.strictEqual(detectExpect('text/plain'), 'text');
        assert.strictEqual(detectExpect('text/html'), 'text');
    });
});

// =============================================================================
// fetch_typed Tests
// =============================================================================

describe('fetch_typed', () => {
    test('hydrates typed JSON response', async () => {
        const body = '{"price":"99.99::N","qty":"5::L"}';
        global.fetch = async () => new Response(body, { headers: { 'Content-Type': 'application/json' } });
        const res = await fetch_typed('http://example.com/json');
        assert.strictEqual(Number(res.price), 99.99);
        assert.strictEqual(res.qty, 5);
    });

    test('throws on HTTP error', async () => {
        global.fetch = async () => new Response('Not found', { status: 404, statusText: 'Not Found' });
        await assert.rejects(
            () => fetch_typed('http://example.com/notfound'),
            /HTTP 404/
        );
    });

    test('handles XML response', async () => {
        const xmlBody = '<root><value>42::L</value></root>';
        global.fetch = async () => new Response(xmlBody, { headers: { 'Content-Type': 'application/xml' } });
        const res = await fetch_typed('http://example.com/xml');
        // from_xml returns { root: { attrs: {}, value: { value: { attrs: {}, value: 42 } } } }
        assert.strictEqual(res.root.value.value.value, 42);
    });

    test('handles msgpack response', async () => {
        const data = { price: 100 };
        const packed = packb(data);
        global.fetch = async () => new Response(packed, { headers: { 'Content-Type': 'application/msgpack' } });
        const res = await fetch_typed('http://example.com/msgpack');
        assert.strictEqual(res.price, 100);
    });

    test('handles text response (fallback)', async () => {
        global.fetch = async () => new Response('42::L', { headers: { 'Content-Type': 'text/plain' } });
        const res = await fetch_typed('http://example.com/text');
        assert.strictEqual(res, 42);
    });

    test('uses explicit expect option over content-type', async () => {
        // Server returns text/plain but we expect json
        const body = '{"x":"1::L"}';
        global.fetch = async () => new Response(body, { headers: { 'Content-Type': 'text/plain' } });
        const res = await fetch_typed('http://example.com/json', { expect: 'json' });
        assert.strictEqual(res.x, 1);
    });
});

// =============================================================================
// fetch_typed_request Tests
// =============================================================================

describe('fetch_typed_request', () => {
    test('sends typed JSON request body', async () => {
        const mock = async (_url, init) => {
            assert.strictEqual(init.headers['Content-Type'], 'application/json');
            assert.strictEqual(init.headers['X-TYTX-Request'], 'json');
            const parsed = JSON.parse(init.body);
            assert.ok(parsed.price);
            return new Response(as_typed_json({ ok: true }));
        };
        global.fetch = mock;
        const res = await fetch_typed_request('http://example.com/json', {
            method: 'POST',
            expect: 'json',
            body: { price: 10 },
            sendAs: 'json',
        });
        assert.strictEqual(res.ok, true);
    });

    test('sends typed text request body', async () => {
        const mock = async (_url, init) => {
            assert.strictEqual(init.headers['Content-Type'], 'text/plain');
            assert.strictEqual(init.headers['X-TYTX-Request'], 'text');
            assert.strictEqual(init.body, '1::L');
            return new Response('true::B', { headers: { 'Content-Type': 'text/plain' } });
        };
        global.fetch = mock;
        const res = await fetch_typed_request('http://example.com/text', {
            method: 'POST',
            expect: 'text',
            body: 1,
            sendAs: 'text',
        });
        assert.strictEqual(res, true);
    });

    test('sends msgpack request body', async () => {
        const mock = async (_url, init) => {
            assert.strictEqual(init.headers['Content-Type'], 'application/msgpack');
            assert.strictEqual(init.headers['X-TYTX-Request'], 'msgpack');
            assert.ok(init.body instanceof Uint8Array);
            return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
        };
        global.fetch = mock;
        const res = await fetch_typed_request('http://example.com/msgpack', {
            method: 'POST',
            body: { value: 42 },
            sendAs: 'msgpack',
            expect: 'json',
        });
        assert.strictEqual(res.ok, true);
    });

    test('delegates to fetch_xtytx when xtytx=true', async () => {
        registry.register_struct('P', { x: 'L' });
        const mock = async (_url, init) => {
            assert.strictEqual(init.headers['X-TYTX-Request'], 'xtytx');
            return new Response('{"pt":"{\\"x\\":\\"1\\"}::@P"}', { headers: { 'Content-Type': 'application/json' } });
        };
        global.fetch = mock;
        const res = await fetch_typed_request('http://example.com/xtytx', { body: { pt: { x: 1 } }, xtytx: true });
        assert.deepStrictEqual(res.pt, { x: 1 });
        registry.unregister_struct('P');
    });
});

// =============================================================================
// fetch_xtytx Tests
// =============================================================================

describe('fetch_xtytx', () => {
    test('builds xtytx envelope and sends', async () => {
        registry.register_struct('P', { x: 'L' });
        const mock = async (_url, init) => {
            assert.strictEqual(init.headers['X-TYTX-Request'], 'xtytx');
            assert.ok(String(init.body).startsWith('XTYTX://'));
            return new Response('{"pt":"{\\"x\\":\\"1\\"}::@P"}', { headers: { 'Content-Type': 'application/json' } });
        };
        global.fetch = mock;
        const res = await fetch_xtytx('http://example.com/xtytx', {
            payload: { pt: { x: 1 } },
            gstruct: { P: { x: 'L' } },
        });
        assert.deepStrictEqual(res.pt, { x: 1 });
        registry.unregister_struct('P');
    });
});

// =============================================================================
// build_xtytx_envelope Tests
// =============================================================================

describe('build_xtytx_envelope', () => {
    test('creates envelope with object payload', () => {
        const env = build_xtytx_envelope({ payload: { x: 1 }, gstruct: { P: { x: 'L' } } });
        assert.ok(env.startsWith('XTYTX://'));
    });

    test('creates envelope with string payload', () => {
        const env = build_xtytx_envelope({ payload: '{"x":"1::L"}' });
        assert.ok(env.startsWith('XTYTX://'));
        const parsed = JSON.parse(env.replace('XTYTX://', ''));
        assert.strictEqual(parsed.data, '{"x":"1::L"}');
    });

    test('auto-collects lstruct when payload references struct', () => {
        registry.register_struct('P', { x: 'L' });
        const env = build_xtytx_envelope({ payload: { pt: '{"x":"1"}::@P' } });
        const parsed = JSON.parse(env.replace('XTYTX://', ''));
        assert.ok(parsed.lstruct.P);
        registry.unregister_struct('P');
    });

    test('does not duplicate lstruct entries', () => {
        registry.register_struct('Q', { y: 'L' });
        // lstruct already has Q
        const env = build_xtytx_envelope({
            payload: '{"pt":"{\\"y\\":\\"1\\"}::@Q"}',
            lstruct: { Q: { y: 'L' } }
        });
        const parsed = JSON.parse(env.replace('XTYTX://', ''));
        assert.deepStrictEqual(parsed.lstruct.Q, { y: 'L' });
        registry.unregister_struct('Q');
    });

    test('ignores unknown struct references', () => {
        // Reference to UNKNOWN struct that is not registered
        const env = build_xtytx_envelope({ payload: '{"pt":"{}::@UNKNOWN"}' });
        const parsed = JSON.parse(env.replace('XTYTX://', ''));
        assert.strictEqual(parsed.lstruct.UNKNOWN, undefined);
    });
});

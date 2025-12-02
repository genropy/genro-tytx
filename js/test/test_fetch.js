// @ts-check
const assert = require('assert');
const { fetch_typed, fetch_xtytx, fetch_typed_request, build_xtytx_envelope, registry } = require('../src');
const { as_typed_json } = require('../src/json_utils');
const { registry } = require('../src/registry');

describe('fetch_typed (request/response)', () => {
    afterEach(() => {
        if (global.fetch && global.fetch.restore) {
            global.fetch.restore();
        }
    });

    it('hydrated typed JSON response', async () => {
        const body = '{"price":"99.99::N","qty":"5::L"}';
        global.fetch = async () => new Response(body, { headers: { 'Content-Type': 'application/json' } });
        const res = await fetch_typed('http://example.com/json');
        assert.strictEqual(Number(res.price), 99.99);
        assert.strictEqual(res.qty, 5);
    });

    it('typed JSON request body', async () => {
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

    it('typed text request body', async () => {
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

    it('builds xtytx envelope and sends via fetch_xtytx', async () => {
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

    it('build_xtytx_envelope helper works', () => {
        const env = build_xtytx_envelope({ payload: { x: 1 }, gstruct: { P: { x: 'L' } } });
        assert.ok(env.startsWith('XTYTX://'));
    });

    it('auto-collects lstruct when payload references struct', () => {
        registry.register_struct('P', { x: 'L' });
        const env = build_xtytx_envelope({ payload: { pt: '{"x":"1"}::@P' } });
        const parsed = JSON.parse(env.replace('XTYTX://', ''));
        assert.ok(parsed.lstruct.P);
        registry.unregister_struct('P');
    });

    it('fetch_typed_request with xtytx=true delegates to fetch_xtytx', async () => {
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

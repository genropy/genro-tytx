import { describe, it, expect, vi } from 'vitest';
import { fetchTyped, fetchTypedRequest, fetchXtytx, buildXtytxEnvelope } from '../src/fetch.js';
import { registry } from '../src/registry.js';

describe('fetchTyped', () => {
  it('hydrates typed JSON', async () => {
    const body = '{"price":"99.99::N","qty":"5::L"}';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'application/json' } })));
    const res = await fetchTyped('http://example.com/json');
    expect(Number(res.price)).toBe(99.99);
    expect(res.qty).toBe(5);
    vi.unstubAllGlobals();
  });

  it('builds XTYTX envelope with gstruct/gschema', () => {
    const env = buildXtytxEnvelope({
      payload: { x: 1 },
      gstruct: { P: { x: 'L' } },
      gschema: { P: { type: 'object' } },
    });
    expect(env.startsWith('XTYTX://')).toBe(true);
    const parsed = JSON.parse(env.replace('XTYTX://', ''));
    expect(parsed.gstruct.P.x).toBe('L');
    expect(parsed.data).toContain('x');
  });

  it('auto-collects lstruct when autoStructs=true', () => {
    registry.register_struct('P', { x: 'L' });
    const env = buildXtytxEnvelope({
      payload: { pt: '{"x":"1"}::@P' }, // typed string referencing @P
      autoStructs: true,
    });
    const parsed = JSON.parse(env.replace('XTYTX://', ''));
    expect(parsed.lstruct.P).toBeDefined();
    expect(parsed.lstruct.P.x).toBe('L');
    registry.unregister_struct('P');
  });

  it('sends XTYTX envelope and hydrates response', async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      expect(init?.headers?.['X-TYTX-Request']).toBe('xtytx');
      expect(typeof init?.body).toBe('string');
      return new Response('{"ok":"true::B"}', { headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch as any);
    const res = await fetchXtytx('http://example.com/xtytx', { payload: { ok: true } });
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('fetchTypedRequest with xtytx=true delegates to fetchXtytx', async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      expect(init?.headers?.['X-TYTX-Request']).toBe('xtytx');
      return new Response('{"ok":"true::B"}', { headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch as any);
    const res = await fetchTypedRequest('http://example.com/xtytx', { body: { x: 1 }, xtytx: true });
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('hydrates typed text', async () => {
    const body = 'true::B';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'text/plain' } })));
    const res = await fetchTyped('http://example.com/text');
    expect(res).toBe(true);
    vi.unstubAllGlobals();
  });

  it('sends typed json request and hydrates response', async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      expect(init?.headers?.['Content-Type']).toBe('application/json');
      expect(init?.headers?.['X-TYTX-Request']).toBe('json');
      expect(init?.body).toContain('price');
      return new Response('{"ok":"true::B"}', { headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch as any);
    const res = await fetchTypedRequest('http://example.com/json', { method: 'POST', body: { price: 10 }, sendAs: 'json' });
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('sends typed text request', async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      expect(init?.headers?.['Content-Type']).toBe('text/plain');
      expect(init?.headers?.['X-TYTX-Request']).toBe('text');
      expect(init?.body).toBe('1::L');
      return new Response('1::L', { headers: { 'Content-Type': 'text/plain' } });
    });
    vi.stubGlobal('fetch', mockFetch as any);
    const res = await fetchTypedRequest('http://example.com/text', { method: 'POST', body: 1, sendAs: 'text', expect: 'text' });
    expect(res).toBe(1);
    vi.unstubAllGlobals();
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404, statusText: 'Not Found' })));
    await expect(fetchTyped('http://example.com/notfound')).rejects.toThrow('HTTP 404');
    vi.unstubAllGlobals();
  });

  it('handles msgpack response', async () => {
    // Create a simple msgpack-like buffer (fixmap with one key-value)
    // This is a minimal test - real msgpack would need the library
    const body = new Uint8Array([0x81, 0xa1, 0x78, 0x01]); // {x: 1} in msgpack
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'application/msgpack' } })));
    const res = await fetchTyped('http://example.com/msgpack');
    expect(res).toEqual({ x: 1 });
    vi.unstubAllGlobals();
  });

  it('handles x-msgpack content type', async () => {
    const body = new Uint8Array([0x81, 0xa1, 0x79, 0x02]); // {y: 2}
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'application/x-msgpack' } })));
    const res = await fetchTyped('http://example.com/xmsgpack');
    expect(res).toEqual({ y: 2 });
    vi.unstubAllGlobals();
  });

  it('handles xml content type as typed text', async () => {
    const body = '42::L';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'application/xml' } })));
    const res = await fetchTyped('http://example.com/xml');
    expect(res).toBe(42);
    vi.unstubAllGlobals();
  });

  it('defaults to text when no content-type', async () => {
    const body = '100::L';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: {} })));
    const res = await fetchTyped('http://example.com/nocontent');
    expect(res).toBe(100);
    vi.unstubAllGlobals();
  });

  it('respects explicit expect option', async () => {
    const body = '{"value":"50::L"}';
    // Content-Type says text, but we force json
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'text/plain' } })));
    const res = await fetchTyped('http://example.com/force', { expect: 'json' });
    expect(res.value).toBe(50);
    vi.unstubAllGlobals();
  });

  it('sends msgpack request', async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      expect(init?.headers?.['Content-Type']).toBe('application/msgpack');
      expect(init?.headers?.['X-TYTX-Request']).toBe('msgpack');
      expect(init?.body).toBeInstanceOf(Uint8Array);
      return new Response('{"ok":"true::B"}', { headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch as any);
    const res = await fetchTypedRequest('http://example.com/msgpack', { method: 'POST', body: { value: 1 }, sendAs: 'msgpack' });
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('defaults sendAs to json', async () => {
    const mockFetch = vi.fn(async (_url, init) => {
      expect(init?.headers?.['Content-Type']).toBe('application/json');
      return new Response('{"ok":"true::B"}', { headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch as any);
    // sendAs not specified, should default to json
    const res = await fetchTypedRequest('http://example.com/default', { method: 'POST', body: { test: 1 } });
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });
});

import { describe, it, expect } from 'vitest';
import { hydrateTypedBody, detectExpectFromHeaders } from '../src/server.js';
import { asTypedJson } from '../src/json.js';
import { packb } from '../src/msgpack.js';
import { buildXtytxEnvelope } from '../src/fetch.js';

describe('hydrateTypedBody', () => {
  it('hydrates typed JSON', () => {
    const raw = asTypedJson({ price: 10.5 });
    const result = hydrateTypedBody({ raw, contentType: 'application/json' }) as any;
    expect(result.price).toBe(10.5);
  });

  it('hydrates msgpack', () => {
    const packed = packb({ ok: true });
    const result = hydrateTypedBody({ raw: packed, contentType: 'application/msgpack' }) as any;
    expect(result.ok).toBe(true);
  });

  it('hydrates XTYTX envelopes', () => {
    const env = buildXtytxEnvelope({ payload: { total: 3 } });
    const result = hydrateTypedBody({ raw: env, tytxRequest: 'xtytx' }) as any;
    expect(result.data.total).toBe(3);
  });
});

describe('detectExpectFromHeaders', () => {
  it('prefers X-TYTX-Request header', () => {
    const expectKind = detectExpectFromHeaders('application/json', 'xtytx');
    expect(expectKind).toBe('xtytx');
  });

  it('falls back to content-type', () => {
    const expectKind = detectExpectFromHeaders('application/msgpack', null);
    expect(expectKind).toBe('msgpack');
  });
});

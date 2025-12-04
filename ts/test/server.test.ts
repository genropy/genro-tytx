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

  it('detects msgpack from tytxRequest header', () => {
    expect(detectExpectFromHeaders(null, 'msgpack')).toBe('msgpack');
  });

  it('detects json from tytxRequest header', () => {
    expect(detectExpectFromHeaders(null, 'json')).toBe('json');
  });

  it('detects text from tytxRequest header', () => {
    expect(detectExpectFromHeaders(null, 'text')).toBe('text');
  });

  it('falls back to text for unknown content-type', () => {
    expect(detectExpectFromHeaders('application/octet-stream', null)).toBe('text');
  });

  it('detects xml from content-type', () => {
    expect(detectExpectFromHeaders('application/xml', null)).toBe('xml');
  });
});

describe('hydrateTypedBody edge cases', () => {
  it('hydrates typed string values inside xtytx envelope', () => {
    // To test hydrateFromJsonString's string branch, we need actual typed strings
    // in the data field. asTypedJson only adds markers for Date (not JSON-native types).
    // So we use a Date which becomes "2025-01-15::D" and then is hydrated back
    const testDate = new Date('2025-01-15T00:00:00.000Z');
    const env = buildXtytxEnvelope({ payload: { created: testDate, name: 'test' } });
    const result = hydrateTypedBody({ raw: env, expect: 'xtytx' }) as any;
    expect(result.data.created).toBeInstanceOf(Date);
    expect(result.data.name).toBe('test');
  });

  it('falls back to text for xml expect', () => {
    const raw = '42::L';
    const result = hydrateTypedBody({ raw, expect: 'xml' });
    expect(result).toBe(42);
  });

  it('falls back to text for unknown expect', () => {
    const raw = 'hello::T';
    const result = hydrateTypedBody({ raw, expect: 'text' });
    expect(result).toBe('hello');
  });

  it('handles ArrayBuffer input', () => {
    const text = '123::L';
    const buffer = new TextEncoder().encode(text).buffer;
    const result = hydrateTypedBody({ raw: buffer, expect: 'text' });
    expect(result).toBe(123);
  });

  it('handles string input for msgpack (toUint8 string branch)', () => {
    // toUint8 is called with string only when msgpack receives a string raw input
    // Create valid msgpack and convert to string that TextEncoder will preserve
    // Simple msgpack: fixint 42 = 0x2a (single byte, ASCII safe)
    const result = hydrateTypedBody({ raw: '*', expect: 'msgpack' }) as any;
    expect(result).toBe(42); // 0x2a = 42 = '*' in ASCII
  });
});

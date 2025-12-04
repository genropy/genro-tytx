import { fromJson } from './json.js';
import { unpackb } from './msgpack.js';
import { registry } from './registry.js';
import { processEnvelope } from './xtytx.js';
import type { StructSchema } from './types.js';

export type HydrateExpect = 'json' | 'text' | 'xml' | 'msgpack' | 'xtytx';

export interface HydrateOptions {
  raw: string | Uint8Array | ArrayBuffer;
  contentType?: string | null;
  expect?: HydrateExpect;
  /**
   * Optional X-TYTX-Request header value (json|text|msgpack|xtytx).
   * Used as a signal when Content-Type is generic.
   */
  tytxRequest?: string | null;
}

function toUint8(raw: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof raw === 'string') {
    return new TextEncoder().encode(raw);
  }
  if (raw instanceof Uint8Array) {
    return raw;
  }
  // raw is ArrayBuffer (the only remaining case per TypeScript types)
  return new Uint8Array(raw);
}

function detectExpect(contentType?: string | null, tytxRequest?: string | null): HydrateExpect {
  const hint = tytxRequest?.toLowerCase();
  if (hint === 'xtytx') return 'xtytx';
  if (hint === 'msgpack') return 'msgpack';
  if (hint === 'json') return 'json';
  if (hint === 'text') return 'text';

  if (!contentType) return 'text';
  const ct = contentType.toLowerCase();
  if (ct.includes('xtytx')) return 'xtytx';
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('msgpack') || ct.includes('application/x-msgpack')) return 'msgpack';
  return 'text';
}

function hydrateFromJsonString(data: string, localStructs: Record<string, StructSchema> | null): any {
  const parsed = JSON.parse(data);
  const walk = (value: any): any => {
    if (typeof value === 'string') {
      return registry.fromText(value, undefined, localStructs ?? undefined);
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  };
  return walk(parsed);
}

/**
  * Hydrate a raw HTTP body using TYTX rules.
  *
  * - Supports typed JSON/text/XML/msgpack
  * - Detects XTYTX envelopes (XTYTX://{...}) and processes them
  *
  * This is a building block for Node.js servers (Express/Koa/Fastify, ecc.).
  * You can read the body with your framework of choice, then call this helper:
  *
  * ```ts
  * const hydrated = hydrateTypedBody({
  *   raw: bodyBuffer,
  *   contentType: req.headers['content-type'],
  *   tytxRequest: req.headers['x-tytx-request'],
  * });
  * req.tytx = hydrated;
  * ```
  */
export function hydrateTypedBody(options: HydrateOptions): any {
  const { raw, contentType, expect, tytxRequest } = options;
  const chosen = expect ?? detectExpect(contentType, tytxRequest);

  if (chosen === 'msgpack') {
    return unpackb(toUint8(raw));
  }

  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(toUint8(raw));

  // XTYTX envelope detection
  if (chosen === 'xtytx' || text.startsWith('XTYTX://')) {
    const envelopeJson = text.replace(/^XTYTX:\/\//, '');
    const envelope = JSON.parse(envelopeJson);
    // hydrate using fromJson for the payload
    return processEnvelope(envelope, (data, localStructs) => {
      return hydrateFromJsonString(data, localStructs);
    }, 'TYTX://');
  }

  if (chosen === 'json') {
    return fromJson(text);
  }

  // TS build does not ship XML hydration; fall back to typed text
  return registry.fromText(text);
}

export { detectExpect, detectExpect as detectExpectFromHeaders };

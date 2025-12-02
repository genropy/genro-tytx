import { asTypedJson, fromJson } from './json.js';
import { registry } from './registry.js';
import { packb, unpackb } from './msgpack.js';

export type FetchExpect = 'json' | 'text' | 'xml' | 'msgpack';

export interface FetchTypedOptions extends RequestInit {
  expect?: FetchExpect;
}

export type FetchSendKind = 'json' | 'text' | 'msgpack';

export interface FetchTypedRequestOptions extends FetchTypedOptions {
  body: any;
  sendAs?: FetchSendKind;
  xtytx?: boolean;
  autoStructs?: boolean;
}

export interface XtytxEnvelope {
  gstruct?: Record<string, any>;
  lstruct?: Record<string, any>;
  gschema?: Record<string, any>;
  lschema?: Record<string, any>;
  data: string;
}

export interface FetchXtytxOptions extends FetchTypedOptions {
  payload: any;
  gstruct?: Record<string, any>;
  lstruct?: Record<string, any>;
  gschema?: Record<string, any>;
  lschema?: Record<string, any>;
  /**
   * If true, scan the typed JSON payload for ::@STRUCT markers and
   * include the referenced structs as lstruct (if found in registry).
   */
  autoStructs?: boolean;
}

function serializeTypedBody(body: any, kind: FetchSendKind): { body: BodyInit; headers: HeadersInit } {
  if (kind === 'msgpack') {
    const packed = packb(body);
    return { body: packed, headers: { 'Content-Type': 'application/msgpack', 'X-TYTX-Request': 'msgpack' } };
  }
  if (kind === 'json') {
    return {
      body: asTypedJson(body),
      headers: { 'Content-Type': 'application/json', 'X-TYTX-Request': 'json' },
    };
  }
  // text (typed string)
  return {
    body: registry.asTypedText(body),
    headers: { 'Content-Type': 'text/plain', 'X-TYTX-Request': 'text' },
  };
}

function detectExpect(contentType: string | null): FetchExpect {
  if (!contentType) return 'text';
  const ct = contentType.toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('msgpack') || ct.includes('application/x-msgpack')) return 'msgpack';
  return 'text';
}

/**
 * Fetch a resource and hydrate it using TYTX parsers.
 *
 * - If `expect` is not provided, it is inferred from the `Content-Type`.
 * - Supports JSON (with TYTX markers), plain typed text, XML, and MessagePack.
 *
 * @example
 * ```ts
 * const data = await fetchTyped('/api/order'); // infer from content-type
 * const xml = await fetchTyped('/api/xml', { expect: 'xml' });
 * ```
 */
export async function fetchTyped(url: string, options: FetchTypedOptions = {}): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const expect = options.expect ?? detectExpect(res.headers.get('content-type'));

  if (expect === 'msgpack') {
    const buf = await res.arrayBuffer();
    return unpackb(new Uint8Array(buf));
  }

  const raw = await res.text();
  if (expect === 'json') return fromJson(raw);
  if (expect === 'xml') {
    // TS build does not include XML utilities; treat as plain typed text
    return registry.fromText(raw);
  }
  return registry.fromText(raw);
}

/**
 * Send a typed payload and hydrate the response.
 *
 * @example
 * ```ts
 * const result = await fetchTypedRequest('/api/order', { method: 'POST', body: { price: 99.99 }, sendAs: 'json' });
 * ```
 */
export async function fetchTypedRequest(url: string, options: FetchTypedRequestOptions): Promise<any> {
  if (options.xtytx) {
    return fetchXtytx(url, {
      payload: options.body,
      gstruct: (options as any).gstruct,
      lstruct: (options as any).lstruct,
      gschema: (options as any).gschema,
      lschema: (options as any).lschema,
      autoStructs: options.autoStructs,
      ...options,
    });
  }
  const sendAs = options.sendAs ?? 'json';
  const { body, headers } = serializeTypedBody(options.body, sendAs);
  const mergedHeaders = { ...(options.headers || {}), ...headers };
  const { body: _ignored, ...rest } = options;
  return fetchTyped(url, { ...rest, headers: mergedHeaders, body });
}

function collectStructsFromTypedJson(typedJson: string, existing?: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...(existing || {}) };
  const regex = /::@([A-Z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(typedJson)) !== null) {
    const name = match[1];
    if (!out[name]) {
      const schema = registry.get_struct(name);
      if (schema) out[name] = schema;
    }
  }
  return out;
}

/**
 * Build an XTYTX envelope string (XTYTX://{...}).
 */
export function buildXtytxEnvelope(options: FetchXtytxOptions): string {
  const typedData = asTypedJson(options.payload);
  const lstruct = options.autoStructs ? collectStructsFromTypedJson(typedData, options.lstruct) : options.lstruct;
  const envelope: XtytxEnvelope = {
    gstruct: options.gstruct ?? {},
    lstruct: lstruct ?? {},
    gschema: options.gschema ?? {},
    lschema: options.lschema ?? {},
    data: typedData,
  };
  return `XTYTX://${JSON.stringify(envelope)}`;
}

/**
 * Send an XTYTX envelope (optional gstruct/gschema) and hydrate the response.
 */
export async function fetchXtytx(url: string, options: FetchXtytxOptions): Promise<any> {
  const body = buildXtytxEnvelope(options);
  const headers = {
    'Content-Type': 'application/json',
    'X-TYTX-Request': 'xtytx',
    ...(options.headers || {}),
  };
  return fetchTyped(url, { ...options, body, headers, method: options.method ?? 'POST' });
}

/**
 * JSON utilities for TYTX TypeScript implementation.
 *
 * Protocol Prefixes:
 *     TYTX://   - Standard typed payload
 *     XTYTX://  - Extended envelope with struct and schema definitions
 *
 * @module json
 */

import type { TytxValue, TytxObject, JsonOptions, StructSchema } from './types.js';
import { registry } from './registry.js';
import type { XtytxEnvelope, XtytxResult } from './xtytx.js';
import { processEnvelope } from './xtytx.js';

/** Protocol prefix for standard TYTX payloads */
export const TYTX_PREFIX = 'TYTX://';

/** Protocol prefix for extended TYTX envelopes with struct definitions */
export const XTYTX_PREFIX = 'XTYTX://';

/**
 * Recursively hydrate typed strings in parsed JSON.
 */
function hydrate(obj: unknown, localStructs: Record<string, StructSchema> | null = null): TytxValue {
  if (typeof obj === 'string') {
    return registry.fromText(obj, undefined, localStructs);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => hydrate(item, localStructs));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: TytxObject = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = hydrate(v, localStructs);
    }
    return result;
  }
  return obj as TytxValue;
}

/**
 * Hydrate JSON string with local structs context.
 * Internal helper for processEnvelope.
 */
function hydrateJson(dataStr: string, localStructs: Record<string, StructSchema> | null): TytxValue {
  const parsed = JSON.parse(dataStr) as unknown;
  return hydrate(parsed, localStructs);
}

/**
 * Recursively serialize values to typed strings.
 *
 * JSON-native types (number, boolean, string, null) pass through unchanged.
 * Only Date objects get type markers (they're not JSON-native).
 */
function serialize(obj: unknown, typed: boolean): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Date objects - not JSON-native, needs marker
  if (obj instanceof Date) {
    return typed ? registry.asTypedText(obj) : obj.toISOString();
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((v) => serialize(v, typed));
  }

  // Handle plain objects
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = serialize(v, typed);
    }
    return result;
  }

  // JSON-native types (number, boolean, string): pass through unchanged
  return obj;
}

/**
 * Serialize to TYTX-typed JSON string.
 *
 * @example
 * ```ts
 * const json = asTypedJson({ price: 99.99, date: new Date('2025-01-15') });
 * // '{"price":"99.99::R","date":"2025-01-15::D"}'
 * ```
 */
export function asTypedJson(obj: unknown, options: JsonOptions = {}): string {
  const serialized = serialize(obj, true);
  return options.indent != null
    ? JSON.stringify(serialized, null, options.indent)
    : JSON.stringify(serialized);
}

/**
 * Serialize to standard JSON string.
 *
 * @example
 * ```ts
 * const json = asJson({ price: 99.99, date: new Date('2025-01-15') });
 * // '{"price":99.99,"date":"2025-01-15T00:00:00.000Z"}'
 * ```
 */
export function asJson(obj: unknown, options: JsonOptions = {}): string {
  const serialized = serialize(obj, false);
  return options.indent != null
    ? JSON.stringify(serialized, null, options.indent)
    : JSON.stringify(serialized);
}

/**
 * Parse JSON string and hydrate typed values.
 *
 * Supports three formats:
 * - Regular JSON: '{"price": "100::N"}' - typed strings are hydrated
 * - TYTX:// prefix: 'TYTX://{"price": "100::N"}' - same as regular
 * - XTYTX:// prefix: Extended envelope with structs and schemas
 *   'XTYTX://{"gstruct": {...}, "lstruct": {...}, "gschema": {...}, "lschema": {...}, "data": "..."}'
 *   - gstruct entries are registered globally (for type hydration)
 *   - lstruct entries are used only during this decode (for type hydration)
 *   - gschema entries are registered globally in schemaRegistry (for validation)
 *   - lschema entries are document-specific (returned in result, for validation)
 *   - data is decoded using combined struct context
 *
 * @returns For regular JSON and TYTX://: hydrated value. For XTYTX://: XtytxResult.
 *
 * @example
 * ```ts
 * const data = fromJson('{"price":"99.99::N","date":"2025-01-15::D"}');
 * // { price: 99.99, date: Date }
 *
 * const result = fromJson('XTYTX://{"gstruct": {}, "lstruct": {}, "gschema": {...}, "lschema": {...}, "data": "..."}');
 * // result is XtytxResult with data, globalSchemas, localSchemas
 * ```
 */
export function fromJson<T = TytxValue>(jsonStr: string): T | XtytxResult {
  // Check for XTYTX:// prefix
  if (jsonStr.startsWith(XTYTX_PREFIX)) {
    const envelopeJson = jsonStr.slice(XTYTX_PREFIX.length);
    const envelope = JSON.parse(envelopeJson) as XtytxEnvelope;
    return processEnvelope(envelope, hydrateJson, TYTX_PREFIX);
  }

  // Check for TYTX:// prefix
  let s = jsonStr;
  if (s.startsWith(TYTX_PREFIX)) {
    s = s.slice(TYTX_PREFIX.length);
  }

  // Regular JSON with TYTX typed values
  return hydrate(JSON.parse(s)) as T;
}

/**
 * Hydrate typed values in an already-parsed object.
 *
 * @example
 * ```ts
 * const data = hydrateObject({ price: "99.99::N" });
 * // { price: 99.99 }
 * ```
 */
export function hydrateObject<T = TytxValue>(obj: unknown): T {
  return hydrate(obj) as T;
}

/**
 * Hydrate typed values in an already-parsed array.
 */
export function hydrateArray<T = TytxValue[]>(arr: unknown[]): T {
  return hydrate(arr) as T;
}

/**
 * JSON utilities for TYTX TypeScript implementation.
 *
 * @module json
 */

import type { TytxValue, TytxObject, JsonOptions } from './types.js';
import { registry } from './registry.js';

/**
 * Recursively hydrate typed strings in parsed JSON.
 */
function hydrate(obj: unknown): TytxValue {
  if (typeof obj === 'string') {
    return registry.fromText(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(hydrate);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: TytxObject = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = hydrate(v);
    }
    return result;
  }
  return obj as TytxValue;
}

/**
 * Recursively serialize values to typed strings.
 */
function serialize(obj: unknown, typed: boolean): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Date objects
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

  // Handle primitives that need typing
  if (typed && typeof obj === 'number') {
    return registry.asTypedText(obj);
  }
  if (typed && typeof obj === 'boolean') {
    return registry.asTypedText(obj);
  }

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
 * @example
 * ```ts
 * const data = fromJson('{"price":"99.99::N","date":"2025-01-15::D"}');
 * // { price: 99.99, date: Date }
 * ```
 */
export function fromJson<T = TytxValue>(jsonStr: string): T {
  return hydrate(JSON.parse(jsonStr)) as T;
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

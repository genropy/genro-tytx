/**
 * TYTX Base - Decoding functions
 *
 * Decode TYTX JSON strings to JavaScript objects.
 *
 * @module decode
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { registry } from './registry';
import { allTypes } from './types';

// Ensure types are registered
allTypes.forEach(t => registry.register(t));

/** TYTX marker suffix */
export const TYTX_MARKER = '::JS';

/** TYTX protocol prefix */
export const TYTX_PREFIX = 'TYTX://';

/**
 * Hydrate a single typed string value.
 * @param value - String like "100.50::N"
 * @returns Parsed value or original string
 */
function hydrateValue(value: string): unknown {
    if (!value.includes('::')) {
        return value;
    }

    const idx = value.lastIndexOf('::');
    const rawValue = value.slice(0, idx);
    const suffix = value.slice(idx + 2);

    const typeDef = registry.get(suffix);
    if (typeDef) {
        return typeDef.parse(rawValue);
    }

    // Unknown suffix, return as-is
    return value;
}

/**
 * Recursively hydrate typed values in a structure.
 */
function hydrateRecursive(obj: unknown): unknown {
    if (typeof obj === 'string') {
        if (obj.includes('::')) {
            return hydrateValue(obj);
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => hydrateRecursive(item));
    }

    if (obj !== null && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = hydrateRecursive(v);
        }
        return result;
    }

    return obj;
}

/**
 * Decode a TYTX text format string.
 * Handles ::JS suffix.
 *
 * @param data - JSON string with optional ::JS suffix
 * @returns JavaScript object with typed values hydrated
 *
 * @example
 * ```typescript
 * import { fromText } from 'genro-tytx';
 *
 * const result = fromText('{"price":"100.50::N"}::JS');
 * // { price: Big("100.50") }
 * ```
 */
export function fromText<T = unknown>(data: string): T {
    let jsonStr = data;

    // Check for ::JS marker
    const hasTytx = jsonStr.endsWith(TYTX_MARKER);
    if (hasTytx) {
        jsonStr = jsonStr.slice(0, -TYTX_MARKER.length);
    }

    const parsed = JSON.parse(jsonStr) as unknown;

    if (!hasTytx) {
        return parsed as T;
    }

    return hydrateRecursive(parsed) as T;
}

/**
 * Decode a TYTX JSON format string.
 * Handles TYTX:// prefix and ::JS suffix.
 *
 * @param data - JSON string with optional TYTX:// prefix
 * @returns JavaScript object with typed values hydrated
 *
 * @example
 * ```typescript
 * import { fromJson } from 'genro-tytx';
 *
 * const result = fromJson('TYTX://{"price":"100.50::N"}::JS');
 * // { price: Big("100.50") }
 *
 * // Also works without prefix
 * const result2 = fromJson('{"price":"100.50::N"}::JS');
 * // { price: Big("100.50") }
 * ```
 */
export function fromJson<T = unknown>(data: string): T {
    let jsonStr = data;

    // Strip TYTX:// prefix if present
    if (jsonStr.startsWith(TYTX_PREFIX)) {
        jsonStr = jsonStr.slice(TYTX_PREFIX.length);
    }

    // Check for ::JS marker
    const hasTytx = jsonStr.endsWith(TYTX_MARKER);
    if (hasTytx) {
        jsonStr = jsonStr.slice(0, -TYTX_MARKER.length);
    }

    const parsed = JSON.parse(jsonStr) as unknown;

    if (!hasTytx) {
        return parsed as T;
    }

    return hydrateRecursive(parsed) as T;
}

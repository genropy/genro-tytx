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

/** Known type suffixes for scalar detection */
const KNOWN_SUFFIXES = new Set(['N', 'D', 'DH', 'DHZ', 'H', 'B', 'L', 'R', 'T']);

/**
 * Check if string ends with a valid type suffix.
 * Handles both raw JSON (ends with ::JS) and quoted scalars (ends with ::X").
 */
function hasTypeSuffix(data: string): boolean {
    // Handle quoted JSON scalar: "value::X"
    if (data.endsWith('"')) {
        const idx = data.lastIndexOf('::');
        if (idx === -1) return false;
        const suffix = data.slice(idx + 2, -1); // Strip trailing quote
        return KNOWN_SUFFIXES.has(suffix);
    }
    // Handle struct marker: {...}::JS or [...]::JS
    const idx = data.lastIndexOf('::');
    if (idx === -1) return false;
    const suffix = data.slice(idx + 2);
    return KNOWN_SUFFIXES.has(suffix) || suffix === 'JS';
}

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
 * Handles ::JS suffix and quoted scalars with type suffix.
 *
 * @param data - JSON string with optional ::JS suffix or scalar with type suffix
 * @returns JavaScript object with typed values hydrated
 *
 * @example
 * ```typescript
 * import { fromText } from 'genro-tytx';
 *
 * const result = fromText('{"price":"100.50::N"}::JS');
 * // { price: Big("100.50") }
 *
 * const scalar = fromText('"2025-01-15::D"');
 * // Date(2025, 0, 15)
 * ```
 */
export function fromText<T = unknown>(data: string): T {
    // Strip whitespace (handles trailing newlines, etc.)
    data = data.trim();

    // Check if data has any type suffix
    if (!hasTypeSuffix(data)) {
        // Plain JSON, no TYTX
        return JSON.parse(data) as T;
    }

    // Check for ::JS marker (struct)
    if (data.endsWith(TYTX_MARKER)) {
        const jsonStr = data.slice(0, -TYTX_MARKER.length);
        const parsed = JSON.parse(jsonStr) as unknown;
        return hydrateRecursive(parsed) as T;
    }

    // Scalar with type suffix (e.g., "2025-01-15::D")
    const parsed = JSON.parse(data) as unknown;
    // parsed is now a string like "2025-01-15::D", hydrate it
    return hydrateRecursive(parsed) as T;
}

/**
 * Decode a TYTX JSON format string.
 * Handles TYTX:// prefix, ::JS suffix, and quoted scalars.
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
 * const scalar = fromJson('TYTX://"2025-01-15::D"');
 * // Date(2025, 0, 15)
 * ```
 */
export function fromJson<T = unknown>(data: string): T {
    let jsonStr = data;

    // Strip TYTX:// prefix if present
    if (jsonStr.startsWith(TYTX_PREFIX)) {
        jsonStr = jsonStr.slice(TYTX_PREFIX.length);
    }

    // Delegate to fromText
    return fromText<T>(jsonStr);
}

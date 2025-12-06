/**
 * TYTX Base - Encoding functions
 *
 * Encode JavaScript objects to TYTX JSON strings.
 *
 * @module encode
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { registry } from './registry';
import { allTypes } from './types';
import type { TypeDefinition } from './types';

// Register all types
allTypes.forEach(t => registry.register(t));

/** TYTX marker suffix */
export const TYTX_MARKER = '::JS';

/** TYTX protocol prefix */
export const TYTX_PREFIX = 'TYTX://';

/** JSON-compatible value types */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue }
export type JsonArray = JsonValue[];

/** Serialization result with typed flag */
interface SerializeResult {
    value: JsonValue;
    hasTyped: boolean;
}

/**
 * Get type definition for a value
 */
function getTypeDef(value: unknown): TypeDefinition | null {
    for (const typeDef of allTypes) {
        if (typeDef.match(value)) {
            return typeDef;
        }
    }
    return null;
}

/**
 * Recursively serialize a value, tracking if any typed values were found
 */
function serializeRecursive(value: unknown): SerializeResult {
    if (value === null || value === undefined) {
        return { value: null, hasTyped: false };
    }

    // Check for typed value
    const typeDef = getTypeDef(value);
    if (typeDef) {
        const serialized = typeDef.serialize(value as never);
        return {
            value: `${serialized}::${typeDef.code}`,
            hasTyped: true
        };
    }

    // Native types pass through
    if (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') {
        return { value, hasTyped: false };
    }

    // Array
    if (Array.isArray(value)) {
        let hasTyped = false;
        const result: JsonValue[] = [];
        for (const item of value) {
            const { value: serialized, hasTyped: itemTyped } = serializeRecursive(item);
            result.push(serialized);
            if (itemTyped) hasTyped = true;
        }
        return { value: result, hasTyped };
    }

    // Object
    if (typeof value === 'object') {
        let hasTyped = false;
        const result: JsonObject = {};
        for (const [k, v] of Object.entries(value)) {
            const { value: serialized, hasTyped: itemTyped } = serializeRecursive(v);
            result[k] = serialized;
            if (itemTyped) hasTyped = true;
        }
        return { value: result, hasTyped };
    }

    // Fallback
    return { value: null, hasTyped: false };
}

/**
 * Encode a value to TYTX text format.
 * Adds ::JS suffix only if typed values are present.
 *
 * @param value - Value to encode
 * @returns JSON string with optional ::JS suffix
 *
 * @example
 * ```typescript
 * import { toTypedText } from 'genro-tytx-base';
 * import Big from 'big.js';
 *
 * const data = { price: new Big('100.50') };
 * const encoded = toTypedText(data);
 * // '{"price":"100.50::N"}::JS'
 * ```
 */
export function toTypedText(value: unknown): string {
    const { value: serialized, hasTyped } = serializeRecursive(value);
    const json = JSON.stringify(serialized);
    return hasTyped ? json + TYTX_MARKER : json;
}

/**
 * Encode a value to TYTX JSON format.
 * Always adds TYTX:// prefix, adds ::JS suffix only if typed values present.
 *
 * @param value - Value to encode
 * @returns JSON string with TYTX:// prefix and optional ::JS suffix
 *
 * @example
 * ```typescript
 * import { toTypedJson } from 'genro-tytx-base';
 * import Big from 'big.js';
 *
 * const data = { price: new Big('100.50') };
 * const encoded = toTypedJson(data);
 * // 'TYTX://{"price":"100.50::N"}::JS'
 * ```
 */
export function toTypedJson(value: unknown): string {
    const { value: serialized, hasTyped } = serializeRecursive(value);
    const json = JSON.stringify(serialized);
    if (hasTyped) {
        return TYTX_PREFIX + json + TYTX_MARKER;
    }
    return TYTX_PREFIX + json;
}

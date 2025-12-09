// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX Utilities.
 *
 * Provides:
 * - walk: recursive data structure transformation
 * - tytxEquivalent: semantic equivalence for roundtrip testing
 */

import { getTypeEntry, SUFFIX_TO_TYPE } from './registry.js';

/**
 * Encode a scalar value to TYTX string with suffix.
 *
 * @param {any} value - JavaScript scalar value (Decimal, Date, boolean, number)
 * @param {boolean} forceSuffix - If true, force suffix for all types (including int/bool/float)
 * @returns {[boolean, string]} [encoded, result]
 *   - (true, "serialized::SUFFIX") if type is registered and needs suffix
 *   - (false, String(value)) if type not registered or jsonNative without force
 */
function rawEncode(value, forceSuffix = false) {
    const entry = getTypeEntry(value);
    if (entry === null) {
        return [false, String(value)];
    }
    const [suffix, serializer, jsonNative] = entry;
    if (jsonNative && !forceSuffix) {
        return [false, String(value)];
    }
    return [true, `${serializer(value)}::${suffix}`];
}

/**
 * Decode a string with TYTX suffix.
 *
 * @param {string} s - String possibly ending with ::XX where XX is a registered suffix
 * @returns {[boolean, any]} [decoded, value]
 *   - (true, decodedValue) if suffix found and decoded
 *   - (false, originalValue) if no valid suffix
 */
function rawDecode(s) {
    if (!s.includes('::')) {
        return [false, s];
    }
    const lastIndex = s.lastIndexOf('::');
    const value = s.slice(0, lastIndex);
    const suffix = s.slice(lastIndex + 2);
    const entry = SUFFIX_TO_TYPE[suffix];
    if (entry === undefined) {
        return [false, s];
    }
    const [, decoder] = entry;
    return [true, decoder(value)];
}

/**
 * Walk a data structure and apply callback to values matching filtercb.
 *
 * @param {any} data - Data structure to walk
 * @param {function} callback - Function to apply to matching values
 * @param {function} filtercb - Filter function. Applies callback when filtercb(value) is true.
 * @returns {any} Transformed data
 */
function walk(data, callback, filtercb) {
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        const result = {};
        for (const [k, v] of Object.entries(data)) {
            result[k] = walk(v, callback, filtercb);
        }
        return result;
    }
    if (Array.isArray(data)) {
        return data.map(item => walk(item, callback, filtercb));
    }
    if (filtercb(data)) {
        return callback(data);
    }
    return data;
}

/**
 * Truncate Date to milliseconds (TYTX precision).
 * @param {Date} dt
 * @returns {Date}
 */
function _truncateToMillis(dt) {
    // JavaScript Date already has millisecond precision, no truncation needed
    return dt;
}

/**
 * Check if two Dates represent the same instant in time.
 *
 * TYTX serializes all datetimes as UTC (DHZ) with millisecond precision.
 * This function handles the semantic equivalence for roundtrip comparison.
 *
 * @param {Date} a - Original Date (before roundtrip)
 * @param {Date} b - Decoded Date (after roundtrip)
 * @returns {boolean} True if both represent the same instant in time
 */
function datetimeEquivalent(a, b) {
    // JavaScript Dates are always comparable directly in milliseconds
    return a.getTime() === b.getTime();
}

/**
 * Check if two values are semantically equivalent after TYTX roundtrip.
 *
 * Handles special cases:
 * - Date: timestamp equivalence
 * - dict/list: recursive comparison
 * - other types: standard equality
 *
 * @param {any} a - Original value (before roundtrip)
 * @param {any} b - Decoded value (after roundtrip)
 * @returns {boolean} True if values are semantically equivalent
 */
function tytxEquivalent(a, b) {
    // Fast path: identical values
    if (a === b) {
        return true;
    }

    // Date special case
    if (a instanceof Date && b instanceof Date) {
        return datetimeEquivalent(a, b);
    }

    // dict: recursive comparison (needed to find nested Dates)
    if (a !== null && typeof a === 'object' && !Array.isArray(a) &&
        b !== null && typeof b === 'object' && !Array.isArray(b)) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) {
            return false;
        }
        const keysSetB = new Set(keysB);
        for (const k of keysA) {
            if (!keysSetB.has(k)) {
                return false;
            }
        }
        return keysA.every(k => tytxEquivalent(a[k], b[k]));
    }

    // list: recursive comparison (needed to find nested Dates)
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((ai, i) => tytxEquivalent(ai, b[i]));
    }

    return false;
}

export {
    rawEncode,
    rawDecode,
    walk,
    datetimeEquivalent,
    tytxEquivalent,
    _truncateToMillis,
};

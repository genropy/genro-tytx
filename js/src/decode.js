/**
 * TYTX Base - Decoding functions
 *
 * Decode TYTX JSON strings to JavaScript objects.
 *
 * @module decode
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

const { registry } = require('./registry');
require('./types'); // Ensure types are registered

const TYTX_MARKER = '::JS';
const TYTX_PREFIX = 'TYTX://';

/**
 * Hydrate a single typed string value.
 * @param {string} value - String like "100.50::N"
 * @returns {*} Parsed value or original string
 */
function hydrateValue(value) {
    if (typeof value !== 'string' || !value.includes('::')) {
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
 * @param {*} obj
 * @returns {*}
 */
function hydrateRecursive(obj) {
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
        const result = {};
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
 * @param {string} data - JSON string with optional ::JS suffix
 * @returns {*} JavaScript object with typed values hydrated
 *
 * @example
 * fromText('{"price":"100.50::N"}::JS')
 * // {price: Big("100.50")}
 */
function fromText(data) {
    // Check for ::JS marker
    const hasTytx = data.endsWith(TYTX_MARKER);
    if (hasTytx) {
        data = data.slice(0, -TYTX_MARKER.length);
    }

    const parsed = JSON.parse(data);

    if (!hasTytx) {
        return parsed;
    }

    return hydrateRecursive(parsed);
}

/**
 * Decode a TYTX JSON format string.
 * Handles TYTX:// prefix and ::JS suffix.
 *
 * @param {string} data - JSON string with optional TYTX:// prefix
 * @returns {*} JavaScript object with typed values hydrated
 *
 * @example
 * fromJson('TYTX://{"price":"100.50::N"}::JS')
 * // {price: Big("100.50")}
 *
 * fromJson('{"price":"100.50::N"}::JS')
 * // {price: Big("100.50")}
 */
function fromJson(data) {
    // Strip TYTX:// prefix if present
    if (data.startsWith(TYTX_PREFIX)) {
        data = data.slice(TYTX_PREFIX.length);
    }

    // Check for ::JS marker
    const hasTytx = data.endsWith(TYTX_MARKER);
    if (hasTytx) {
        data = data.slice(0, -TYTX_MARKER.length);
    }

    const parsed = JSON.parse(data);

    if (!hasTytx) {
        return parsed;
    }

    return hydrateRecursive(parsed);
}

module.exports = {
    fromText,
    fromJson,
    hydrateValue,
    hydrateRecursive,
    TYTX_MARKER,
    TYTX_PREFIX
};

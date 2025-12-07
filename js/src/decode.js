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

// Known type suffixes for scalar detection
const KNOWN_SUFFIXES = new Set(['N', 'D', 'DH', 'DHZ', 'H', 'B', 'L', 'R', 'T']);

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
 * Check if string ends with a valid type suffix.
 * Handles both raw JSON (ends with ::JS) and quoted scalars (ends with ::X").
 * @param {string} data - JSON string
 * @returns {boolean}
 */
function hasTypeSuffix(data) {
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
 * Decode a TYTX text format string.
 * Handles ::JS suffix and quoted scalars with type suffix.
 *
 * @param {string} data - JSON string with optional ::JS suffix or scalar with type suffix
 * @returns {*} JavaScript object with typed values hydrated
 *
 * @example
 * fromText('{"price":"100.50::N"}::JS')
 * // {price: Big("100.50")}
 *
 * fromText('"2025-01-15::D"')
 * // Date(2025, 0, 15)
 */
function fromText(data) {
    // Strip whitespace (handles trailing newlines, etc.)
    data = data.trim();

    // Check if data has any type suffix
    if (!hasTypeSuffix(data)) {
        // Plain JSON, no TYTX
        return JSON.parse(data);
    }

    // Check for ::JS marker (struct)
    if (data.endsWith(TYTX_MARKER)) {
        data = data.slice(0, -TYTX_MARKER.length);
        const parsed = JSON.parse(data);
        return hydrateRecursive(parsed);
    }

    // Scalar with type suffix (e.g., "2025-01-15::D")
    const parsed = JSON.parse(data);
    // parsed is now a string like "2025-01-15::D", hydrate it
    return hydrateRecursive(parsed);
}

/**
 * Decode a TYTX JSON format string.
 * Handles TYTX:// prefix, ::JS suffix, and quoted scalars.
 *
 * @param {string} data - JSON string with optional TYTX:// prefix
 * @returns {*} JavaScript object with typed values hydrated
 *
 * @example
 * fromJson('TYTX://{"price":"100.50::N"}::JS')
 * // {price: Big("100.50")}
 *
 * fromJson('TYTX://"2025-01-15::D"')
 * // Date(2025, 0, 15)
 */
function fromJson(data) {
    // Strip TYTX:// prefix if present
    if (data.startsWith(TYTX_PREFIX)) {
        data = data.slice(TYTX_PREFIX.length);
    }

    // Delegate to fromText
    return fromText(data);
}

module.exports = {
    fromText,
    fromJson,
    hydrateValue,
    hydrateRecursive,
    TYTX_MARKER,
    TYTX_PREFIX
};

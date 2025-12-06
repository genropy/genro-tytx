/**
 * TYTX Base - Encoding functions
 *
 * Encode JavaScript objects to TYTX JSON strings.
 *
 * @module encode
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

const { registry, isDecimalInstance } = require('./registry');
require('./types'); // Ensure types are registered

const TYTX_MARKER = '::JS';
const TYTX_PREFIX = 'TYTX://';

/**
 * Check if a value needs TYTX encoding (non-native JSON type).
 * @param {*} value
 * @returns {boolean}
 */
function needsEncoding(value) {
    if (value instanceof Date) return true;
    if (isDecimalInstance(value)) return true;
    return false;
}

/**
 * Serialize a single value to TYTX format.
 * @param {*} value
 * @returns {string|*} Typed string or original value
 */
function serializeValue(value) {
    if (value instanceof Date) {
        const code = registry.getTypeCode(value);
        const typeDef = registry.get(code);
        if (typeDef) {
            return typeDef.serialize(value) + '::' + code;
        }
    }
    if (isDecimalInstance(value)) {
        const typeDef = registry.get('N');
        if (typeDef) {
            return typeDef.serialize(value) + '::N';
        }
    }
    return value;
}

/**
 * Recursively serialize values, tracking if any need encoding.
 * @param {*} obj
 * @returns {{value: *, hasTyped: boolean}}
 */
function serializeRecursive(obj) {
    if (obj === null || obj === undefined) {
        return { value: obj, hasTyped: false };
    }

    if (obj instanceof Date || isDecimalInstance(obj)) {
        return { value: serializeValue(obj), hasTyped: true };
    }

    if (Array.isArray(obj)) {
        let hasTyped = false;
        const result = obj.map(item => {
            const { value, hasTyped: itemHasTyped } = serializeRecursive(item);
            if (itemHasTyped) hasTyped = true;
            return value;
        });
        return { value: result, hasTyped };
    }

    if (typeof obj === 'object') {
        let hasTyped = false;
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            const { value, hasTyped: itemHasTyped } = serializeRecursive(v);
            result[k] = value;
            if (itemHasTyped) hasTyped = true;
        }
        return { value: result, hasTyped };
    }

    return { value: obj, hasTyped: false };
}

/**
 * Encode a JavaScript value to TYTX text format.
 * Uses ::JS suffix only when typed values are present.
 *
 * @param {*} value - Value to encode
 * @returns {string} JSON string with optional ::JS suffix
 *
 * @example
 * toTypedText({price: new Big("100.50")})
 * // '{"price":"100.50::N"}::JS'
 *
 * toTypedText({name: "test"})
 * // '{"name":"test"}'
 */
function toTypedText(value) {
    const { value: serialized, hasTyped } = serializeRecursive(value);
    const json = JSON.stringify(serialized);
    return hasTyped ? json + TYTX_MARKER : json;
}

/**
 * Encode a JavaScript value to TYTX JSON format.
 * Uses TYTX:// prefix and ::JS suffix.
 *
 * @param {*} value - Value to encode
 * @returns {string} JSON string with TYTX:// prefix
 *
 * @example
 * toTypedJson({price: new Big("100.50")})
 * // 'TYTX://{"price":"100.50::N"}::JS'
 *
 * toTypedJson({name: "test"})
 * // 'TYTX://{"name":"test"}'
 */
function toTypedJson(value) {
    const { value: serialized, hasTyped } = serializeRecursive(value);
    const json = JSON.stringify(serialized);
    if (hasTyped) {
        return TYTX_PREFIX + json + TYTX_MARKER;
    }
    return TYTX_PREFIX + json;
}

module.exports = {
    toTypedText,
    toTypedJson,
    serializeValue,
    TYTX_MARKER,
    TYTX_PREFIX
};

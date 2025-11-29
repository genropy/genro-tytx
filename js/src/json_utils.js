/**
 * JSON utilities for TYTX Protocol.
 *
 * Provides encoder/decoder functions for JSON serialization with typed values.
 *
 * Usage:
 *     // Typed JSON (TYTX format - reversible)
 *     as_typed_json(data)  // → '{"price": "99.50::D"}'
 *     from_json(json_str)  // → {price: 99.5}
 *
 *     // Standard JSON (for external systems - may lose precision)
 *     as_json(data)  // → '{"price": 99.5}'
 *
 * @module json_utils
 */

const { registry } = require('./registry');

/**
 * Recursively hydrate typed strings in parsed JSON.
 * @param {*} obj - Parsed JSON value.
 * @returns {*} Value with typed strings converted to JS objects.
 */
function _hydrate(obj) {
    if (typeof obj === 'string') {
        return registry.from_text(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(_hydrate);
    }
    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = _hydrate(v);
        }
        return result;
    }
    return obj;
}

/**
 * Recursively serialize values to typed strings.
 * @param {*} obj - Value to serialize.
 * @param {boolean} typed - If true, use typed format.
 * @returns {*} Value with non-JSON types converted.
 */
function _serialize(obj, typed) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle Date objects
    if (obj instanceof Date) {
        if (typed) {
            return registry.as_typed_text(obj);
        }
        return obj.toISOString();
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(v => _serialize(v, typed));
    }

    // Handle plain objects
    if (typeof obj === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = _serialize(v, typed);
        }
        return result;
    }

    // Handle primitives that need typing
    if (typed && typeof obj === 'number') {
        return registry.as_typed_text(obj);
    }
    if (typed && typeof obj === 'boolean') {
        return registry.as_typed_text(obj);
    }

    return obj;
}

/**
 * Serialize JavaScript object to JSON string with typed values (TYTX format).
 *
 * Non-native JSON types (Date, etc.) are serialized as typed strings
 * (e.g., "2024-01-15::d"). This format is reversible.
 *
 * @param {*} obj - JavaScript object to serialize.
 * @param {number} [indent] - Optional indentation for pretty-print.
 * @returns {string} JSON string with typed values.
 */
function as_typed_json(obj, indent = null) {
    const serialized = _serialize(obj, true);
    return indent !== null
        ? JSON.stringify(serialized, null, indent)
        : JSON.stringify(serialized);
}

/**
 * Serialize JavaScript object to standard JSON string.
 *
 * Non-native JSON types are converted to JSON-compatible types:
 * - Date → ISO string
 *
 * Use this for export to external systems that don't understand TYTX.
 *
 * @param {*} obj - JavaScript object to serialize.
 * @param {number} [indent] - Optional indentation for pretty-print.
 * @returns {string} Standard JSON string.
 */
function as_json(obj, indent = null) {
    const serialized = _serialize(obj, false);
    return indent !== null
        ? JSON.stringify(serialized, null, indent)
        : JSON.stringify(serialized);
}

/**
 * Parse JSON string and hydrate typed values.
 *
 * Typed strings (e.g., "123.45::D") are converted to JavaScript objects.
 * Non-typed values are returned as-is.
 *
 * @param {string} s - JSON string to parse.
 * @returns {*} JavaScript object with typed values hydrated.
 */
function from_json(s) {
    return _hydrate(JSON.parse(s));
}

module.exports = {
    as_typed_json,
    as_json,
    from_json
};

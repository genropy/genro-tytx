/**
 * JSON utilities for TYTX Protocol.
 *
 * JSON-native types (number, boolean, string, null) are NOT marked with type codes
 * because JSON already preserves their type. Only non-native types (Date) receive
 * type markers.
 *
 * Usage:
 *     // Typed JSON (TYTX format - reversible)
 *     as_typed_json({count: 5, date: new Date()})
 *     // → '{"count": 5, "date": "2025-01-15T00:00:00::DH"}'
 *
 *     from_json(json_str)  // → {count: 5, date: Date}
 *
 *     // Standard JSON (for external systems)
 *     as_json(data)  // → '{"count": 5, "date": "2025-01-15T00:00:00.000Z"}'
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
 *
 * JSON-native types (number, boolean, string, null) pass through unchanged.
 * Only Date objects get type markers (they're not JSON-native).
 *
 * @param {*} obj - Value to serialize.
 * @param {boolean} typed - If true, use typed format for non-native types.
 * @returns {*} Value with non-JSON types converted.
 */
function _serialize(obj, typed) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle Date objects - not JSON-native, needs marker
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

    // JSON-native types (number, boolean, string): pass through unchanged
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

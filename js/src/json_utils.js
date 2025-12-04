/**
 * JSON utilities for TYTX Protocol.
 *
 * JSON-native types (number, boolean, string, null) are NOT marked with type codes
 * because JSON already preserves their type. Only non-native types (Date) receive
 * type markers.
 *
 * Protocol Prefixes:
 *     TYTX://   - Standard typed payload
 *     XTYTX://  - Extended envelope with struct and validation definitions
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
 *     // XTYTX envelope with inline struct and schema definitions
 *     const result = from_json('XTYTX://{"gstruct": {...}, "lstruct": {...}, "gschema": {...}, "lschema": {...}, "data": "TYTX://..."}')
 *     // result is {data, globalSchemas, localSchemas}
 *
 * @module json_utils
 */

const { registry } = require('./registry');
const { processEnvelope } = require('./xtytx');
const { isDecimalInstance } = require('./types');

// Protocol prefix constants
const TYTX_PREFIX = 'TYTX://';
const XTYTX_PREFIX = 'XTYTX://';

/**
 * Recursively hydrate typed strings in parsed JSON.
 * @param {*} obj - Parsed JSON value.
 * @param {Object|null} localStructs - Optional local struct definitions.
 * @returns {*} Value with typed strings converted to JS objects.
 */
function _hydrate(obj, localStructs = null) {
    if (typeof obj === 'string') {
        return registry.from_text(obj, null, localStructs);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => _hydrate(item, localStructs));
    }
    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = _hydrate(v, localStructs);
        }
        return result;
    }
    return obj;
}

/**
 * Hydrate JSON string with local structs context.
 * Internal helper for processEnvelope.
 *
 * @param {string} dataStr - JSON string to parse.
 * @param {Object|null} localStructs - Optional local struct definitions.
 * @returns {*} Hydrated JavaScript object.
 */
function _hydrateJson(dataStr, localStructs) {
    const parsed = JSON.parse(dataStr);
    return _hydrate(parsed, localStructs);
}

/**
 * Recursively serialize values to typed strings.
 *
 * JSON-native types (number, boolean, string, null) pass through unchanged.
 * Only Date objects and Decimal (Big.js/Decimal.js) get type markers.
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

    // Handle Decimal (Big.js or Decimal.js) - not JSON-native, needs marker
    if (isDecimalInstance(obj)) {
        if (typed) {
            return registry.as_typed_text(obj);
        }
        return parseFloat(obj.toString());
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
 * Supports three formats:
 * - Regular JSON: '{"price": "100::N"}' - typed strings are hydrated
 * - TYTX:// prefix: 'TYTX://{"price": "100::N"}' - same as regular
 * - XTYTX:// prefix: Extended envelope with structs and schemas
 *   'XTYTX://{"gstruct": {...}, "lstruct": {...}, "gschema": {...}, "lschema": {...}, "data": "..."}'
 *   - gstruct entries are registered globally (for type hydration)
 *   - lstruct entries are used only during this decode (for type hydration)
 *   - gschema entries are registered globally in schemaRegistry (for validation)
 *   - lschema entries are document-specific (returned in result, for validation)
 *   - data is decoded using combined struct context
 *
 * @param {string} s - JSON string to parse (may have TYTX:// or XTYTX:// prefix).
 * @returns {*} For regular JSON and TYTX://: JavaScript object with typed values hydrated.
 *              For XTYTX://: {data, globalSchemas, localSchemas}
 * @throws {Error} If XTYTX envelope is missing required struct fields.
 * @throws {SyntaxError} If JSON is invalid.
 */
function from_json(s) {
    // Check for XTYTX:// prefix
    if (s.startsWith(XTYTX_PREFIX)) {
        const envelopeJson = s.slice(XTYTX_PREFIX.length);
        const envelope = JSON.parse(envelopeJson);
        return processEnvelope(envelope, _hydrateJson, TYTX_PREFIX);
    }

    // Check for TYTX:// prefix
    if (s.startsWith(TYTX_PREFIX)) {
        s = s.slice(TYTX_PREFIX.length);
    }

    // Regular JSON with TYTX typed values
    return _hydrate(JSON.parse(s));
}

module.exports = {
    as_typed_json,
    as_json,
    from_json,
    _hydrate,
    TYTX_PREFIX,
    XTYTX_PREFIX
};

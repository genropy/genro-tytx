/**
 * JSON utilities for TYTX Protocol.
 *
 * JSON-native types (number, boolean, string, null) are NOT marked with type codes
 * because JSON already preserves their type. Only non-native types (Date) receive
 * type markers.
 *
 * Protocol Prefixes:
 *     TYTX://   - Standard typed payload
 *     XTYTX://  - Extended envelope with struct definitions
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
 *     // XTYTX envelope with inline struct definitions
 *     from_json('XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "TYTX://..."}')
 *
 * @module json_utils
 */

const { registry } = require('./registry');

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
 * Process XTYTX envelope.
 *
 * 1. Register gstruct entries globally (overwrites existing)
 * 2. Build localStructs context from lstruct
 * 3. Decode data using combined context
 * 4. Return decoded data (or null if data is empty)
 *
 * @param {Object} envelope - Parsed XTYTX envelope with gstruct, lstruct, data fields.
 * @returns {*} Decoded data or null if data is empty.
 * @throws {Error} If required fields are missing.
 */
function _processXtytx(envelope) {
    const gstruct = envelope.gstruct;
    const lstruct = envelope.lstruct;
    let data = envelope.data;

    if (gstruct === undefined) {
        throw new Error('XTYTX envelope missing required field: gstruct');
    }
    if (lstruct === undefined) {
        throw new Error('XTYTX envelope missing required field: lstruct');
    }
    if (data === undefined) {
        throw new Error('XTYTX envelope missing required field: data');
    }

    // Register gstruct entries globally (overwrites existing)
    for (const [code, schema] of Object.entries(gstruct)) {
        registry.register_struct(code, schema);
    }

    // If data is empty, return null
    if (!data) {
        return null;
    }

    // Strip TYTX:// prefix from data if present
    if (data.startsWith(TYTX_PREFIX)) {
        data = data.slice(TYTX_PREFIX.length);
    }

    // Parse and hydrate data with lstruct as local context
    const parsed = JSON.parse(data);
    const localStructs = Object.keys(lstruct).length > 0 ? lstruct : null;
    return _hydrate(parsed, localStructs);
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
 * Supports three formats:
 * - Regular JSON: '{"price": "100::N"}' - typed strings are hydrated
 * - TYTX:// prefix: 'TYTX://{"price": "100::N"}' - same as regular
 * - XTYTX:// prefix: 'XTYTX://{"gstruct": {...}, "lstruct": {...}, "data": "..."}'
 *   - gstruct entries are registered globally
 *   - lstruct entries are used only during this decode
 *   - data is decoded using combined struct context
 *
 * @param {string} s - JSON string to parse (may have TYTX:// or XTYTX:// prefix).
 * @returns {*} JavaScript object with typed values hydrated.
 *              Returns null if XTYTX envelope has empty data.
 * @throws {Error} If XTYTX envelope is missing required fields.
 * @throws {SyntaxError} If JSON is invalid.
 */
function from_json(s) {
    // Check for XTYTX:// prefix
    if (s.startsWith(XTYTX_PREFIX)) {
        const envelopeJson = s.slice(XTYTX_PREFIX.length);
        const envelope = JSON.parse(envelopeJson);
        return _processXtytx(envelope);
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
    TYTX_PREFIX,
    XTYTX_PREFIX
};

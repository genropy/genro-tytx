/**
 * TYTX Type Registry
 *
 * Registry for pluggable data types.
 *
 * @module registry
 */

/**
 * @typedef {Object} DataType
 * @property {string} name - Human-readable name (e.g., "integer", "decimal")
 * @property {string} code - Short code used in TYTX syntax (e.g., "I", "D")
 * @property {string[]} aliases - Alternative codes/names
 * @property {string} js_type - JavaScript type name
 * @property {function(string): *} parse - Convert string to JS value
 * @property {function(*): string} serialize - Convert JS value to string
 */

class TypeRegistry {
    constructor() {
        /** @type {Map<string, DataType>} */
        this._types = new Map();
        /** @type {Map<string, DataType>} */
        this._codes = new Map();
        /** @type {Map<string, DataType>} */
        this._aliases = new Map();
    }

    /**
     * Register a new data type.
     * @param {DataType} type_def - Type definition object
     */
    register(type_def) {
        this._types.set(type_def.name, type_def);
        this._codes.set(type_def.code, type_def);
        if (type_def.aliases) {
            for (const alias of type_def.aliases) {
                this._aliases.set(alias, type_def);
            }
        }
    }

    /**
     * Retrieve a type by name, code, or alias.
     * @param {string} name_or_code
     * @returns {DataType|null}
     */
    get(name_or_code) {
        return this._types.get(name_or_code)
            || this._codes.get(name_or_code)
            || this._aliases.get(name_or_code)
            || null;
    }

    /**
     * Get the type code for a JavaScript value.
     * Uses Genropy-compatible codes.
     *
     * Date detection convention (JS has only Date type):
     * - Date (::D): midnight UTC (hours, minutes, seconds, ms all 0)
     * - Time (::H): epoch date (1970-01-01) - "first date in the world"
     * - DateTime (::DHZ): all other cases (timezone-aware)
     *
     * @param {*} value
     * @returns {string|null}
     */
    _get_type_code_for_value(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'boolean') {
            return 'B';
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'L' : 'R';  // Genropy: L for long/int, R for real/float
        }
        if (value instanceof Date) {
            // Use UTC for consistent cross-timezone behavior
            const hours = value.getUTCHours();
            const minutes = value.getUTCMinutes();
            const seconds = value.getUTCSeconds();
            const ms = value.getUTCMilliseconds();
            const year = value.getUTCFullYear();
            const month = value.getUTCMonth();
            const day = value.getUTCDate();

            // Time: epoch date (1970-01-01) with any time
            if (year === 1970 && month === 0 && day === 1) {
                return 'H';  // Genropy: H for time
            }

            // Date: midnight UTC (no time component)
            if (hours === 0 && minutes === 0 && seconds === 0 && ms === 0) {
                return 'D';  // Genropy: D for date
            }

            // DateTime: everything else
            return 'DHZ';  // Genropy: DHZ for datetime (timezone-aware)
        }
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            return 'JS';  // Genropy: JS for json
        }
        if (typeof value === 'string') {
            return null; // Strings don't get typed
        }
        return null;
    }

    /**
     * Check if a string contains a TYTX type suffix.
     * @param {string} text
     * @returns {boolean}
     */
    is_typed(text) {
        if (typeof text !== 'string' || !text.includes('::')) {
            return false;
        }
        const idx = text.lastIndexOf('::');
        const type_part = text.slice(idx + 2);
        return this.get(type_part) !== null;
    }

    /**
     * Parse a string to a JavaScript value.
     * @param {string} text - The string to parse. May contain embedded type (value::type).
     * @param {string} [type_code] - Optional explicit type code.
     * @returns {*} Parsed value, or original string if no type found.
     */
    from_text(text, type_code = null) {
        // If explicit type provided, use it
        if (type_code !== null) {
            const type_def = this.get(type_code);
            if (type_def) {
                return type_def.parse(text);
            }
            return text;
        }

        // Check for embedded type
        if (typeof text !== 'string' || !text.includes('::')) {
            return text;
        }

        // Split only on the last occurrence
        const idx = text.lastIndexOf('::');
        const val_part = text.slice(0, idx);
        const type_part = text.slice(idx + 2);

        const type_def = this.get(type_part);
        if (type_def) {
            return type_def.parse(val_part);
        }

        return text;
    }

    /**
     * Serialize a JavaScript object to a string (without type suffix).
     * @param {*} value - Value to serialize.
     * @param {string|boolean} [format] - Format string or true for default.
     * @param {string} [locale] - Locale string (e.g., "it-IT").
     * @returns {string}
     */
    as_text(value, format = null, locale = null) {
        if (typeof value === 'string') {
            return value;
        }

        const code = this._get_type_code_for_value(value);
        if (code) {
            const type_def = this.get(code);
            if (type_def) {
                if (format !== null && type_def.format) {
                    return type_def.format(value, format, locale);
                }
                return type_def.serialize(value);
            }
        }

        return String(value);
    }

    /**
     * Serialize a JavaScript object to a typed string (value::type).
     * @param {*} value - Value to serialize.
     * @returns {string} String in format "value::type", or plain string if no type.
     */
    as_typed_text(value) {
        if (typeof value === 'string') {
            return value;
        }

        const code = this._get_type_code_for_value(value);
        if (code) {
            const type_def = this.get(code);
            if (type_def) {
                return type_def.serialize(value) + '::' + code;
            }
        }

        return String(value);
    }
}

// Global registry instance
const registry = new TypeRegistry();

module.exports = { TypeRegistry, registry };

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
 * @property {string} code - Short code used in TYTX syntax (e.g., "L", "D")
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
    }

    /**
     * Register a new data type.
     * @param {DataType} type_def - Type definition object
     */
    register(type_def) {
        this._types.set(type_def.name, type_def);
        this._codes.set(type_def.code, type_def);
    }

    /**
     * Retrieve a type by name or code.
     * @param {string} name_or_code
     * @returns {DataType|null}
     */
    get(name_or_code) {
        return this._types.get(name_or_code)
            || this._codes.get(name_or_code)
            || null;
    }

    /**
     * Get the type code for a JavaScript value.
     * Uses mnemonic codes.
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
            return Number.isInteger(value) ? 'L' : 'R';  // L = Long integer, R = Real number
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
                return 'H';  // H = Hour
            }

            // Date: midnight UTC (no time component)
            if (hours === 0 && minutes === 0 && seconds === 0 && ms === 0) {
                return 'D';  // D = Date
            }

            // DateTime: everything else
            return 'DHZ';  // DHZ = Date Hour Zulu (timezone-aware)
        }
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            return 'JS';  // JS = JavaScript object
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
     * Supports typed arrays: "[1,2,3]::L" applies type to all leaf values.
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
            // Check if it's a typed array: starts with '['
            if (val_part.startsWith('[')) {
                return this._parseTypedArray(val_part, type_def);
            }
            return type_def.parse(val_part);
        }

        return text;
    }

    /**
     * Parse a typed array, applying the type to all leaf values.
     * @param {string} jsonStr - JSON array string
     * @param {DataType} type_def - Type definition to apply
     * @returns {Array} Parsed array with typed values
     * @private
     */
    _parseTypedArray(jsonStr, type_def) {
        const data = JSON.parse(jsonStr);

        const applyType = (item) => {
            if (Array.isArray(item)) {
                return item.map(applyType);
            }
            return type_def.parse(String(item));
        };

        return applyType(data);
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
     * @param {boolean} [compact_array=false] - If true, produce compact format "[1,2,3]::L" for homogeneous arrays.
     * @returns {string} String in format "value::type", or plain string if no type.
     */
    as_typed_text(value, compact_array = false) {
        if (typeof value === 'string') {
            return value;
        }

        // Handle compact array format
        if (compact_array && Array.isArray(value)) {
            const result = this._tryCompactArray(value);
            if (result !== null) {
                return result;
            }
            // Fallback: type each element individually
            return this._serializeArrayElements(value);
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

    /**
     * Collect all unique type codes from leaf values.
     * @param {*} value - Value to analyze
     * @returns {Set<string|null>} Set of type codes found
     * @private
     */
    _collectLeafTypes(value) {
        if (Array.isArray(value)) {
            const result = new Set();
            for (const item of value) {
                for (const t of this._collectLeafTypes(item)) {
                    result.add(t);
                }
            }
            return result;
        }
        return new Set([this._get_type_code_for_value(value)]);
    }

    /**
     * Serialize leaf values using a specific type.
     * @param {*} value - Value to serialize
     * @param {DataType} type_def - Type definition to use
     * @returns {*} Serialized value or array
     * @private
     */
    _serializeLeaf(value, type_def) {
        if (Array.isArray(value)) {
            return value.map((item) => this._serializeLeaf(item, type_def));
        }
        return type_def.serialize(value);
    }

    /**
     * Try to serialize array in compact format.
     * @param {Array} value - Array to serialize
     * @returns {string|null} Compact format string or null if not homogeneous
     * @private
     */
    _tryCompactArray(value) {
        if (value.length === 0) {
            return '[]';
        }

        const leafTypes = this._collectLeafTypes(value);

        // If there are any null (strings), array is not fully typed - fallback
        if (leafTypes.has(null)) {
            return null;
        }

        if (leafTypes.size !== 1) {
            return null; // Not homogeneous
        }

        const typeCode = [...leafTypes][0];
        const type_def = this.get(typeCode);
        if (!type_def) {
            return null;
        }

        const serialized = this._serializeLeaf(value, type_def);
        return JSON.stringify(serialized) + '::' + typeCode;
    }

    /**
     * Serialize array with each element typed individually.
     * @param {Array} value - Array to serialize
     * @returns {string} JSON array with typed elements
     * @private
     */
    _serializeArrayElements(value) {
        const serializeItem = (item) => {
            if (Array.isArray(item)) {
                return item.map(serializeItem);
            }
            return this.as_typed_text(item);
        };
        return JSON.stringify(value.map(serializeItem));
    }
}

// Global registry instance
const registry = new TypeRegistry();

module.exports = { TypeRegistry, registry };

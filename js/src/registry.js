/**
 * TYTX Type Registry
 *
 * Registry for pluggable data types.
 * Uses unified maps for both built-in and custom types.
 * Custom types use X_ prefix to avoid collisions.
 *
 * @module registry
 */

/**
 * Prefix for custom extension types.
 * @const {string}
 */
const CUSTOM_PREFIX = '~';

/**
 * Prefix for struct schema types.
 * @const {string}
 */
const STRUCT_PREFIX = '@';

/**
 * Prefix for typed arrays.
 * @const {string}
 */
const ARRAY_PREFIX = '#';

/**
 * @typedef {Object} DataType
 * @property {string} name - Human-readable name (e.g., "integer", "decimal")
 * @property {string} code - Short code used in TYTX syntax (e.g., "L", "D")
 * @property {string} js_type - JavaScript type name
 * @property {function(string): *} parse - Convert string to JS value
 * @property {function(*): string} serialize - Convert JS value to string
 */

/**
 * @typedef {Object} ExtensionType
 * @property {string} name - Name in format "custom_code"
 * @property {string} code - Full code with ~ prefix
 * @property {Function|null} cls - Constructor function for auto-detection
 * @property {function(string): *} parse - Convert string to JS value
 * @property {function(*): string} serialize - Convert JS value to string
 */

/**
 * @typedef {Object} StringSchemaField
 * @property {string} name - Field name (empty string if anonymous)
 * @property {string} typeCode - Type code for this field
 */

/**
 * @typedef {Object} StructType
 * @property {string} code - Full code with @ prefix
 * @property {string} name - Struct name without prefix
 * @property {Array|Object|string} schema - Schema definition
 * @property {StringSchemaField[]|null} stringFields - Parsed fields for string schema
 * @property {boolean} stringHasNames - Whether string schema has named fields
 */

class TypeRegistry {
    constructor() {
        /** @type {Map<string, DataType|ExtensionType>} */
        this._types = new Map();
        /** @type {Map<string, DataType|ExtensionType>} */
        this._codes = new Map();
        /** @type {Map<Function, ExtensionType>} */
        this._constructors = new Map();
        /** @type {Map<string, StructType>} */
        this._structs = new Map();
    }

    /**
     * Register a new data type (internal, for built-in types).
     * @param {DataType} type_def - Type definition object
     */
    register(type_def) {
        this._types.set(type_def.name, type_def);
        this._codes.set(type_def.code, type_def);
    }

    /**
     * Register a custom extension type with ~ prefix.
     *
     * If serialize/parse are not provided, the class must implement:
     * - as_typed_text(): instance method for serialization
     * - static from_typed_text(s): static method for parsing
     *
     * @param {string} code - Type code (will be prefixed with ~)
     * @param {Function} cls - Constructor function (required for auto-detection)
     * @param {function(*): string} [serialize] - Function to convert value to string
     * @param {function(string): *} [parse] - Function to convert string to value
     * @throws {Error} If serialize/parse not provided and class lacks required methods
     */
    register_class(code, cls, serialize = null, parse = null) {
        // Auto-detect serialize from class method
        if (serialize === null) {
            if (cls.prototype && typeof cls.prototype.as_typed_text === 'function') {
                serialize = (v) => v.as_typed_text();
            } else {
                throw new Error(
                    `Class ${cls.name || 'unknown'} must have as_typed_text() method ` +
                    'or provide serialize parameter'
                );
            }
        }

        // Auto-detect parse from class static method
        if (parse === null) {
            if (typeof cls.from_typed_text === 'function') {
                parse = cls.from_typed_text;
            } else {
                throw new Error(
                    `Class ${cls.name || 'unknown'} must have static from_typed_text() method ` +
                    'or provide parse parameter'
                );
            }
        }

        const ext_type = {
            code: CUSTOM_PREFIX + code,
            name: 'custom_' + code.toLowerCase(),
            cls: cls,
            serialize: serialize,
            parse: parse
        };

        // Register in unified maps
        this._types.set(ext_type.name, ext_type);
        this._codes.set(ext_type.code, ext_type);
        this._constructors.set(cls, ext_type);
    }

    /**
     * Remove a previously registered custom extension type.
     * @param {string} code - Type code without ~ prefix
     */
    unregister_class(code) {
        const full_code = CUSTOM_PREFIX + code;
        const ext_type = this._codes.get(full_code);
        if (ext_type) {
            this._codes.delete(full_code);
            this._types.delete(ext_type.name);
            if (ext_type.cls !== null) {
                this._constructors.delete(ext_type.cls);
            }
        }
    }

    /**
     * Retrieve a type by name or code.
     * @param {string} name_or_code
     * @returns {DataType|ExtensionType|StructType|null}
     */
    get(name_or_code) {
        return this._types.get(name_or_code)
            || this._codes.get(name_or_code)
            || null;
    }

    /**
     * Register a struct schema.
     * @param {string} name - Struct name (without @ prefix)
     * @param {Array|Object|string} schema - Schema definition
     */
    register_struct(name, schema) {
        const code = STRUCT_PREFIX + name;
        let stringFields = null;
        let stringHasNames = false;

        if (typeof schema === 'string') {
            const parsed = this._parseStringSchema(schema);
            stringFields = parsed.fields;
            stringHasNames = parsed.hasNames;
        }

        const struct_type = {
            code: code,
            name: name,
            schema: schema,
            stringFields: stringFields,
            stringHasNames: stringHasNames
        };

        this._structs.set(name, struct_type);
        this._codes.set(code, struct_type);
    }

    /**
     * Parse a string schema like "x:R,y:R" or "R,R".
     * @param {string} schema - String schema definition
     * @returns {{fields: StringSchemaField[], hasNames: boolean}}
     * @private
     */
    _parseStringSchema(schema) {
        const fields = [];
        let hasNames = false;

        const parts = schema.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes(':')) {
                const [name, typeCode] = trimmed.split(':').map(s => s.trim());
                fields.push({ name, typeCode });
                hasNames = true;
            } else {
                fields.push({ name: '', typeCode: trimmed });
            }
        }

        return { fields, hasNames };
    }

    /**
     * Remove a previously registered struct.
     * @param {string} name - Struct name without @ prefix
     */
    unregister_struct(name) {
        const code = STRUCT_PREFIX + name;
        this._structs.delete(name);
        this._codes.delete(code);
    }

    /**
     * Get a struct schema by name.
     * @param {string} name - Struct name without @ prefix
     * @returns {Array|Object|string|null} Schema or null if not found
     */
    get_struct(name) {
        const struct_type = this._structs.get(name);
        return struct_type ? struct_type.schema : null;
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
        if (typeof value === 'string') {
            return null; // Strings don't get typed
        }

        // Check custom types (registered via register_class)
        if (typeof value === 'object' && value !== null && value.constructor) {
            const ext_type = this._constructors.get(value.constructor);
            if (ext_type) {
                return ext_type.code;
            }
        }

        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            return 'JS';  // JS = JavaScript object
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
     * Supports structs: "data::@STRUCT" and arrays of structs: "data::#@STRUCT"
     * @param {string} text - The string to parse. May contain embedded type (value::type).
     * @param {string} [type_code] - Optional explicit type code.
     * @param {Object|null} [localStructs] - Optional local struct definitions that take
     *                                       precedence over registry during hydration.
     * @returns {*} Parsed value, or original string if no type found.
     */
    from_text(text, type_code = null, localStructs = null) {
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

        // Check for array of structs: #@STRUCT
        if (type_part.startsWith(ARRAY_PREFIX + STRUCT_PREFIX)) {
            const struct_name = type_part.slice(2); // Remove #@
            const struct_type = this._getStructType(struct_name, localStructs);
            if (struct_type) {
                return this._parseStructArray(val_part, struct_type);
            }
            return text;
        }

        // Check for struct: @STRUCT
        if (type_part.startsWith(STRUCT_PREFIX)) {
            const struct_name = type_part.slice(1); // Remove @
            const struct_type = this._getStructType(struct_name, localStructs);
            if (struct_type) {
                const data = JSON.parse(val_part);
                return this._applySchema(data, struct_type);
            }
            return text;
        }

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
     * Get a struct type by name, checking localStructs first.
     * @param {string} name - Struct name without @ prefix
     * @param {Object|null} localStructs - Optional local struct definitions
     * @returns {StructType|null} Struct type or null if not found
     * @private
     */
    _getStructType(name, localStructs = null) {
        // Check localStructs first (higher precedence)
        if (localStructs && name in localStructs) {
            // Create temporary struct type for local schema
            const schema = localStructs[name];
            let stringFields = null;
            let stringHasNames = false;

            if (typeof schema === 'string') {
                const parsed = this._parseStringSchema(schema);
                stringFields = parsed.fields;
                stringHasNames = parsed.hasNames;
            }

            return {
                code: STRUCT_PREFIX + name,
                name: name,
                schema: schema,
                stringFields: stringFields,
                stringHasNames: stringHasNames
            };
        }

        // Fall back to registry
        return this._structs.get(name) || null;
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
     * Parse array of structs with #@STRUCT syntax.
     * @param {string} jsonStr - JSON array string
     * @param {StructType} struct_type - Struct type definition
     * @returns {Array} Array of hydrated objects
     * @private
     */
    _parseStructArray(jsonStr, struct_type) {
        const data = JSON.parse(jsonStr);
        if (!Array.isArray(data)) {
            return this._applySchema(data, struct_type);
        }
        return data.map(item => this._applySchema(item, struct_type));
    }

    /**
     * Apply struct schema to parsed JSON data.
     * @param {*} data - Parsed JSON data
     * @param {StructType} struct_type - Struct type definition
     * @returns {*} Hydrated data
     * @private
     */
    _applySchema(data, struct_type) {
        const schema = struct_type.schema;

        if (typeof schema === 'string') {
            return this._applyStringSchema(data, struct_type);
        }

        if (Array.isArray(schema)) {
            return this._applyListSchema(data, schema);
        }

        if (typeof schema === 'object' && schema !== null) {
            return this._applyDictSchema(data, schema);
        }

        return data;
    }

    /**
     * Apply string schema to data.
     * @param {*} data - Data (should be array)
     * @param {StructType} struct_type - Struct type with parsed stringFields
     * @returns {Object|Array} Dict if named, list if anonymous
     * @private
     */
    _applyStringSchema(data, struct_type) {
        const fields = struct_type.stringFields;
        const hasNames = struct_type.stringHasNames;

        if (!Array.isArray(data)) {
            return data;
        }

        if (hasNames) {
            // Named fields → return object
            const result = {};
            for (let i = 0; i < fields.length && i < data.length; i++) {
                const field = fields[i];
                result[field.name] = this._hydrateValue(data[i], field.typeCode);
            }
            return result;
        } else {
            // Anonymous fields → return array
            return data.map((item, i) => {
                if (i < fields.length) {
                    return this._hydrateValue(item, fields[i].typeCode);
                }
                return item;
            });
        }
    }

    /**
     * Apply dict schema to data.
     * @param {Object} data - Object data
     * @param {Object} schema - Dict schema {key: typeCode}
     * @returns {Object} Hydrated object
     * @private
     */
    _applyDictSchema(data, schema) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return data;
        }

        const result = { ...data };
        for (const [key, typeCode] of Object.entries(schema)) {
            if (key in result) {
                result[key] = this._hydrateValue(result[key], typeCode);
            }
        }
        return result;
    }

    /**
     * Apply list schema to data.
     * @param {*} data - Array data
     * @param {Array} schema - List schema
     * @returns {Array} Hydrated array
     * @private
     */
    _applyListSchema(data, schema) {
        if (!Array.isArray(data)) {
            return data;
        }

        if (schema.length === 1) {
            // Homogeneous: apply single type to all elements
            return this._applyHomogeneous(data, schema[0]);
        } else {
            // Positional: apply type at index i to data[i]
            return this._applyPositional(data, schema);
        }
    }

    /**
     * Apply homogeneous schema (single type to all leaves).
     * @param {*} data - Data to hydrate
     * @param {string} typeCode - Type code to apply
     * @returns {*} Hydrated data
     * @private
     */
    _applyHomogeneous(data, typeCode) {
        if (Array.isArray(data)) {
            return data.map(item => this._applyHomogeneous(item, typeCode));
        }
        return this._hydrateValue(data, typeCode);
    }

    /**
     * Apply positional schema (type at index i to data[i]).
     * @param {Array} data - Array data
     * @param {Array} schema - List of type codes
     * @returns {Array} Hydrated array
     * @private
     */
    _applyPositional(data, schema) {
        // If data is array of arrays, apply to each sub-array
        if (data.length > 0 && Array.isArray(data[0])) {
            return data.map(row => this._applyPositional(row, schema));
        }

        return data.map((item, i) => {
            if (i < schema.length) {
                return this._hydrateValue(item, schema[i]);
            }
            return item;
        });
    }

    /**
     * Hydrate a single value with a type code.
     * Handles nested struct references (@STRUCT).
     * @param {*} value - Value to hydrate
     * @param {string} typeCode - Type code
     * @returns {*} Hydrated value
     * @private
     */
    _hydrateValue(value, typeCode) {
        // Handle nested struct reference
        if (typeCode.startsWith(STRUCT_PREFIX)) {
            const struct_name = typeCode.slice(1);
            const struct_type = this._structs.get(struct_name);
            if (struct_type) {
                return this._applySchema(value, struct_type);
            }
            return value;
        }

        // Regular type
        const type_def = this.get(typeCode);
        if (type_def && type_def.parse) {
            return type_def.parse(String(value));
        }
        return value;
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

module.exports = { TypeRegistry, registry, CUSTOM_PREFIX, STRUCT_PREFIX, ARRAY_PREFIX };

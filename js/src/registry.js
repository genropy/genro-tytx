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
 * @typedef {Object} FieldValidate
 * @property {number} [min] - Minimum value
 * @property {number} [max] - Maximum value
 * @property {number} [length] - Exact length
 * @property {string} [pattern] - Regex pattern
 * @property {string[]} [enum] - Allowed values
 * @property {string} [validation] - Named validation reference
 * @property {boolean} [required] - Field is required
 * @property {*} [default] - Default value
 */

/**
 * @typedef {Object} FieldUI
 * @property {string} [label] - Display label
 * @property {string} [placeholder] - Placeholder text
 * @property {string} [hint] - Help text
 * @property {boolean|string} [readonly] - Read-only field
 * @property {boolean|string} [hidden] - Hidden field
 * @property {string} [format] - Display format
 * @property {number|string} [width] - Field width
 * @property {number} [rows] - Number of rows for textarea
 */

/**
 * @typedef {Object} FieldDef
 * @property {string} [type] - Type code (defaults to 'T')
 * @property {FieldValidate} [validate] - Validation constraints
 * @property {FieldUI} [ui] - UI hints
 */

/**
 * @typedef {string|FieldDef} FieldValue
 */

/**
 * Get the type code from a field value.
 * For string fields, returns the string directly.
 * For object fields, returns the 'type' property or 'T' as default.
 * @param {FieldValue} field - Field definition
 * @returns {string} Type code
 */
function getFieldType(field) {
    if (typeof field === 'string') {
        return field;
    }
    return field.type ?? 'T';
}

/**
 * Get validation constraints from a field value.
 * Returns undefined for string fields.
 * @param {FieldValue} field - Field definition
 * @returns {FieldValidate|undefined}
 */
function getFieldValidate(field) {
    if (typeof field === 'string') {
        return undefined;
    }
    return field.validate;
}

/**
 * Get UI hints from a field value.
 * Returns undefined for string fields.
 * @param {FieldValue} field - Field definition
 * @returns {FieldUI|undefined}
 */
function getFieldUI(field) {
    if (typeof field === 'string') {
        return undefined;
    }
    return field.ui;
}

/**
 * @typedef {Object} StructType
 * @property {string} code - Full code with @ prefix
 * @property {string} name - Struct name without prefix
 * @property {Array|Object} schema - Parsed schema (always object or array, never string)
 * @property {string} schemaJson - Original JSON string representation
 * @property {string[]|null} fieldOrder - Field order for dict schemas (null for arrays)
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
        /** @type {Map<string, Map<string, string>>} Struct metadata: code -> field_name -> hash */
        this._structMetadata = new Map();
        /** @type {Map<string, Object>} Metadata content: hash -> metadata (deduplicated) */
        this._metadataContent = new Map();
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
     * @param {Array|Object|string} schema - Schema definition (JSON string preferred):
     *        - string: JSON '{"name": "T", "age": "L"}' or '["T", "L"]'
     *        - Array: list schema (legacy)
     *        - Object: dict schema (legacy)
     * @param {Object|null} [metadata] - Optional field metadata (validation, UI hints)
     *        Maps field names to FieldMetadata objects:
     *        {"name": {"validate": {"min": 1}, "ui": {"label": "Name"}}}
     */
    register_struct(name, schema, metadata = null) {
        const code = STRUCT_PREFIX + name;
        let parsedSchema;
        let schemaJson;
        let fieldOrder = null;

        if (typeof schema === 'string') {
            const parsed = this._parseJsonSchema(schema);
            parsedSchema = parsed.schema;
            schemaJson = schema;
            fieldOrder = parsed.fieldOrder;
        } else {
            parsedSchema = schema;
            schemaJson = JSON.stringify(schema);
            if (!Array.isArray(schema)) {
                fieldOrder = Object.keys(schema);
            }
        }

        const struct_type = {
            code: code,
            name: name,
            schema: parsedSchema,
            schemaJson: schemaJson,
            fieldOrder: fieldOrder
        };

        this._structs.set(name, struct_type);
        this._codes.set(code, struct_type);

        // Process and store metadata if provided
        if (metadata) {
            this._registerStructMetadata(name, metadata);
        }
    }

    /**
     * Register metadata for a struct, with hash-based deduplication.
     * @param {string} code - Struct code (without @ prefix)
     * @param {Object} metadata - Dict mapping field names to FieldMetadata
     * @private
     */
    _registerStructMetadata(code, metadata) {
        const fieldHashes = new Map();

        for (const [fieldName, fieldMeta] of Object.entries(metadata)) {
            if (!fieldMeta || Object.keys(fieldMeta).length === 0) {
                continue;
            }
            // Compute hash of metadata content
            const metaHash = this._computeMetadataHash(fieldMeta);
            fieldHashes.set(fieldName, metaHash);
            // Store content if not already present (deduplication)
            if (!this._metadataContent.has(metaHash)) {
                this._metadataContent.set(metaHash, fieldMeta);
            }
        }

        if (fieldHashes.size > 0) {
            this._structMetadata.set(code, fieldHashes);
        }
    }

    /**
     * Compute a stable hash for metadata content.
     * @param {Object} metadata - FieldMetadata object
     * @returns {string} Short hash string (first 8 chars)
     * @private
     */
    _computeMetadataHash(metadata) {
        // Deep sort keys for stable serialization
        const sortedStringify = (obj) => {
            if (obj === null || typeof obj !== 'object') {
                return JSON.stringify(obj);
            }
            if (Array.isArray(obj)) {
                return '[' + obj.map(sortedStringify).join(',') + ']';
            }
            const keys = Object.keys(obj).sort();
            return '{' + keys.map(k => JSON.stringify(k) + ':' + sortedStringify(obj[k])).join(',') + '}';
        };
        const serialized = sortedStringify(metadata);
        // Simple hash function (djb2)
        let hash = 5381;
        for (let i = 0; i < serialized.length; i++) {
            hash = ((hash << 5) + hash) + serialized.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
    }

    /**
     * Get metadata for a struct or specific field.
     * @param {string} code - Struct code (without @ prefix)
     * @param {string|null} [fieldName] - Optional field name. If null, returns all field metadata.
     * @returns {Object|null} FieldMetadata for the field, or dict of all fields, or null if not found
     */
    get_struct_metadata(code, fieldName = null) {
        if (!this._structMetadata.has(code)) {
            return null;
        }

        const fieldHashes = this._structMetadata.get(code);

        if (fieldName !== null) {
            // Return specific field metadata
            const metaHash = fieldHashes.get(fieldName);
            if (!metaHash) {
                return null;
            }
            return this._metadataContent.get(metaHash) || null;
        }

        // Return all field metadata
        const result = {};
        for (const [fname, metaHash] of fieldHashes) {
            const content = this._metadataContent.get(metaHash);
            if (content) {
                result[fname] = content;
            }
        }
        return result;
    }

    /**
     * Parse a JSON schema string, preserving field order.
     * @param {string} jsonStr - JSON schema string like '{"name": "T"}' or '["T", "L"]'
     * @returns {{schema: Array|Object, fieldOrder: string[]|null}}
     * @throws {Error} If not valid JSON
     * @private
     */
    _parseJsonSchema(jsonStr) {
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            throw new Error(`Invalid JSON schema: ${e.message}`);
        }

        if (Array.isArray(parsed)) {
            return { schema: parsed, fieldOrder: null };
        }

        if (typeof parsed === 'object' && parsed !== null) {
            // Object.keys preserves insertion order from JSON.parse
            const fieldOrder = Object.keys(parsed);
            return { schema: parsed, fieldOrder };
        }

        throw new Error(`Schema must be JSON object or array, got ${typeof parsed}`);
    }

    /**
     * Remove a previously registered struct.
     * @param {string} name - Struct name without @ prefix
     */
    unregister_struct(name) {
        const code = STRUCT_PREFIX + name;
        this._structs.delete(name);
        this._codes.delete(code);
        this._structMetadata.delete(name);
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
            return 'NN';
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
            let parsedSchema;
            let schemaJson;
            let fieldOrder = null;

            if (typeof schema === 'string') {
                const parsed = this._parseJsonSchema(schema);
                parsedSchema = parsed.schema;
                schemaJson = schema;
                fieldOrder = parsed.fieldOrder;
            } else {
                parsedSchema = schema;
                schemaJson = JSON.stringify(schema);
                if (!Array.isArray(schema)) {
                    fieldOrder = Object.keys(schema);
                }
            }

            return {
                code: STRUCT_PREFIX + name,
                name: name,
                schema: parsedSchema,
                schemaJson: schemaJson,
                fieldOrder: fieldOrder
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
     * Schema is always parsed (object or array), never a string.
     * @param {*} data - Parsed JSON data
     * @param {StructType} struct_type - Struct type definition
     * @returns {*} Hydrated data
     * @private
     */
    _applySchema(data, struct_type) {
        const schema = struct_type.schema;

        if (Array.isArray(schema)) {
            return this._applyListSchema(data, schema);
        }

        if (typeof schema === 'object' && schema !== null) {
            return this._applyDictSchema(data, schema);
        }

        return data;
    }

    /**
     * Apply dict schema to data.
     * @param {Object} data - Object data
     * @param {Object} schema - Dict schema {key: FieldValue}
     * @returns {Object} Hydrated object
     * @private
     */
    _applyDictSchema(data, schema) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return data;
        }

        const result = { ...data };
        for (const [key, fieldDef] of Object.entries(schema)) {
            if (key in result) {
                const typeCode = getFieldType(fieldDef);
                result[key] = this._hydrateValue(result[key], typeCode);
            }
        }
        return result;
    }

    /**
     * Apply list schema to data.
     * @param {*} data - Array data
     * @param {Array<FieldValue>} schema - List schema
     * @returns {Array} Hydrated array
     * @private
     */
    _applyListSchema(data, schema) {
        if (!Array.isArray(data)) {
            return data;
        }

        if (schema.length === 1) {
            // Homogeneous: apply single type to all elements
            const typeCode = getFieldType(schema[0]);
            return this._applyHomogeneous(data, typeCode);
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
     * @param {Array<FieldValue>} schema - List of field definitions
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
                const typeCode = getFieldType(schema[i]);
                return this._hydrateValue(item, typeCode);
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

module.exports = {
    TypeRegistry,
    registry,
    CUSTOM_PREFIX,
    STRUCT_PREFIX,
    ARRAY_PREFIX,
    getFieldType,
    getFieldValidate,
    getFieldUI
};

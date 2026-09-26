// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Type Registry for TYTX Base.
 *
 * Maps JavaScript types to/from TYTX suffixes.
 * Only scalar types are supported in base version.
 */

import { fromQs } from './qs.js';
import { BigJS, DecimalJS } from '#dependencies';

// =============================================================================
// DECIMAL LIBRARY DETECTION
// =============================================================================

// Import all decimal libraries at startup
// Current active class and library name
let DecimalClass = DecimalJS || BigJS || Number;
let decimalLibrary = DecimalJS ? 'decimal.js' : BigJS ? 'big.js' : 'number';

/**
 * Set the decimal library to use.
 * @param {'decimal.js'|'big.js'|'number'} name
 */
function setDecimalLibrary(name) {
    if (name === 'decimal.js' && DecimalJS) {
        DecimalClass = DecimalJS;
        decimalLibrary = 'decimal.js';
    } else if (name === 'big.js' && BigJS) {
        DecimalClass = BigJS;
        decimalLibrary = 'big.js';
    } else {
        DecimalClass = Number;
        decimalLibrary = 'number';
    }
}

/**
 * Get current decimal library name.
 * @returns {'decimal.js'|'big.js'|'number'}
 */
function getDecimalLibrary() {
    return decimalLibrary;
}

/**
 * Create a Decimal value using the current library.
 * @param {string|number} value
 * @returns {Decimal|Big|number}
 */
function createDecimal(value) {
    return new DecimalClass(value);
}

/**
 * Check if a value is a Decimal instance.
 * @param {any} value
 * @returns {boolean}
 */
function isDecimal(value) {
    if (decimalLibrary === 'number') {
        return false;  // Cannot distinguish from regular Number
    }
    return value instanceof DecimalClass;
}

// =============================================================================
// DATE TYPE DETECTION
// =============================================================================

/**
 * Determine the TYTX type for a Date object based on its content.
 * @param {Date} d
 * @returns {'D'|'H'|'DHZ'}
 */
function getDateType(d) {
    const isEpochDate = d.getUTCFullYear() === 1970 &&
                        d.getUTCMonth() === 0 &&
                        d.getUTCDate() === 1;
    const isMidnight = d.getUTCHours() === 0 &&
                       d.getUTCMinutes() === 0 &&
                       d.getUTCSeconds() === 0 &&
                       d.getUTCMilliseconds() === 0;

    if (isEpochDate && !isMidnight) return 'H';   // time only
    if (isMidnight && !isEpochDate) return 'D';   // date only
    return 'DHZ';                                  // full datetime
}

// =============================================================================
// SERIALIZERS (JavaScript type -> string)
// =============================================================================

function _serializeDecimal(v) {
    return v.toString();
}

function _serializeDate(v) {
    // Format: YYYY-MM-DD
    const year = v.getUTCFullYear();
    const month = String(v.getUTCMonth() + 1).padStart(2, '0');
    const day = String(v.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function _serializeDatetime(v) {
    // Format: YYYY-MM-DDTHH:MM:SS.mmmZ (millisecond precision)
    return v.toISOString();
}

function _serializeTime(v) {
    // Format: HH:MM:SS.mmm
    const hours = String(v.getUTCHours()).padStart(2, '0');
    const minutes = String(v.getUTCMinutes()).padStart(2, '0');
    const seconds = String(v.getUTCSeconds()).padStart(2, '0');
    const millis = String(v.getUTCMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
}

function _serializeBool(v) {
    return v ? 'true' : 'false';
}

function _serializeInt(v) {
    return v.toString();
}

function _serializeFloat(v) {
    return v.toString();
}

function _serializeRaw(v) {
    // Standard base64 (RFC 4648, padded), built from a binary string in
    // chunks so a large view does not overflow the argument list. Text
    // transports only: msgpack carries bytes as its native bin type.
    let binary = '';
    for (let i = 0; i < v.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, v.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

// =============================================================================
// TYPE REGISTRY
// =============================================================================

// Type detection and serialization
// For JS we need functions to detect types since we can't use type() like Python

// Custom types registered at runtime: [cls, suffix, serializer, jsonNative].
let CUSTOM_TYPES = [];

// Suffix -> subtype dictionary. TYTX stores it and never reads it: the type
// that owns the suffix decides its content (for "X": symbolic name -> class).
const SUBTYPE_DICTS = new Map();

/**
 * Get the registered custom-type entry for a value, or null.
 *
 * The prototype chain is walked from the value up, mirroring Python's MRO
 * lookup: the exact class wins, otherwise the nearest registered ancestor,
 * so an unregistered subclass travels under that ancestor's suffix.
 *
 * @param {any} value
 * @returns {[string, function, boolean]|null} [suffix, serializer, jsonNative] or null
 */
function getCustomTypeEntry(value) {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
        for (const [cls, suffix, serializer, jsonNative] of CUSTOM_TYPES) {
            if (cls.prototype === proto) {
                return [suffix, serializer, jsonNative];
            }
        }
    }
    return null;
}

/**
 * Get type entry for a value.
 * @param {any} value
 * @returns {[string, function, boolean]|null} [suffix, serializer, jsonNative] or null
 */
function getTypeEntry(value) {
    if (value === null) {
        return ['NN', () => '', true];
    }
    if (isDecimal(value)) {
        return ['N', _serializeDecimal, false];
    }
    if (value instanceof Uint8Array) {
        // Node's Buffer is a Uint8Array too, so it travels as RAW as well.
        return ['RAW', _serializeRaw, false];
    }
    if (value instanceof Date) {
        const dateType = getDateType(value);
        if (dateType === 'D') {
            return ['D', _serializeDate, false];
        } else if (dateType === 'H') {
            return ['H', _serializeTime, false];
        } else {
            return ['DHZ', _serializeDatetime, false];
        }
    }
    if (typeof value === 'boolean') {
        return ['B', _serializeBool, true];
    }
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return ['L', _serializeInt, true];
        } else {
            return ['R', _serializeFloat, true];
        }
    }
    return getCustomTypeEntry(value);
}

// =============================================================================
// DESERIALIZERS (string -> JavaScript type)
// =============================================================================

function _deserializeDecimal(s) {
    return createDecimal(s);
}

function _deserializeDate(s) {
    // Input: YYYY-MM-DD
    const [year, month, day] = s.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function _deserializeDatetime(s) {
    return new Date(s);
}

function _deserializeTime(s) {
    // Input: HH:MM:SS.mmm
    const [h, m, rest] = s.split(':');
    const [sec, ms] = rest.split('.');
    return new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), Number(sec), Number(ms || 0)));
}

function _deserializeBool(s) {
    return s.toLowerCase() === 'true';
}

function _deserializeInt(s) {
    return parseInt(s, 10);
}

function _deserializeFloat(s) {
    return parseFloat(s);
}

function _deserializeStr(s) {
    return s;
}

function _deserializeNone(s) {
    return null;
}

// Standard base64 with padding, whole string: atob alone accepts missing
// padding and whitespace, which Python's strict decoder refuses.
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function _deserializeRaw(s) {
    if (!BASE64_PATTERN.test(s)) {
        throw new Error(`RAW payload is not standard padded base64: '${s}'`);
    }
    const binary = atob(s);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

function _deserializeQs(s) {
    return fromQs(s);
}

// A type code is one or more uppercase ASCII letters ("N", "QS", "DHZ"). No
// length limit. The grammar rules out ":" so a code can never be confused with
// the "::" suffix separator or with the ":" that splits the msgpack ext-4
// payload.
const SUFFIX_PATTERN = /^[A-Z]+$/;

// Suffix -> [type, deserializer] - includes all for decoding
// Accepts both DH (deprecated) and DHZ (canonical) for datetime
const SUFFIX_TO_TYPE = {
    'N': [Object, _deserializeDecimal],  // Object as placeholder for Decimal type
    'D': [Date, _deserializeDate],
    'DH': [Date, _deserializeDatetime],  // deprecated, still accepted
    'DHZ': [Date, _deserializeDatetime], // canonical
    'H': [Date, _deserializeTime],
    'L': [Number, _deserializeInt],
    'R': [Number, _deserializeFloat],
    'T': [String, _deserializeStr],
    'B': [Boolean, _deserializeBool],
    'QS': [Object, _deserializeQs],
    'NN': [null, _deserializeNone],
    'RAW': [Uint8Array, _deserializeRaw],
};

// =============================================================================
// CUSTOM TYPE REGISTRATION
// =============================================================================

/** Return the constructor registered for a suffix, without running its decoder. */
function getRegisteredType(suffix) {
    return Object.hasOwn(SUFFIX_TO_TYPE, suffix) ? SUFFIX_TO_TYPE[suffix][0] : null;
}

/**
 * Register a custom type for TYTX serialization.
 *
 * Lets external code extend TYTX with its own types. The encode side matches
 * the exact constructor first; an unregistered subclass travels under the
 * suffix of its nearest registered ancestor, written by the serializer (for
 * registerClass, the subclass's own toTytx). The concrete class of a subclass
 * is the type's own business, carried through its subtype dictionary
 * (setSubtypeDict). The decode side maps the suffix back via SUFFIX_TO_TYPE.
 * Re-registering the same class replaces its hooks; reusing a suffix owned by
 * a different type throws.
 *
 * @param {Function} cls - the class/constructor to register
 * @param {string} suffix - the TYTX suffix: uppercase ASCII letters (e.g. "X")
 * @param {function(any): string} serializer - instance -> string
 * @param {function(string): any} deserializer - string -> instance
 * @param {boolean} [jsonNative=false] - if true, skip suffix when JSON-native
 * @throws {Error} if the suffix does not match SUFFIX_PATTERN, or is already
 *   registered for a different type
 */
function registerType(cls, suffix, serializer, deserializer, jsonNative = false) {
    if (typeof suffix !== 'string' || !SUFFIX_PATTERN.test(suffix)) {
        throw new Error(
            `TYTX suffix '${suffix}' is invalid: expected uppercase ASCII letters only`);
    }
    const existing = SUFFIX_TO_TYPE[suffix];
    if (existing !== undefined && existing[0] !== cls) {
        const owner = existing[0] === null ? 'null' : existing[0].name;
        throw new Error(`TYTX suffix '${suffix}' is already registered for ${owner}`);
    }
    // Replace semantics: drop any previous entry for the same class so the
    // encode loop cannot keep serving stale hooks.
    CUSTOM_TYPES = CUSTOM_TYPES.filter(([c]) => c !== cls);
    CUSTOM_TYPES.push([cls, suffix, serializer, jsonNative]);
    SUFFIX_TO_TYPE[suffix] = [cls, deserializer];
}

/**
 * Register a class that declares its own TYTX hooks.
 *
 * Reads from the class:
 *   static tytxSuffix: the TYTX suffix (e.g. "X")
 *   toTytx(): instance -> string
 *   static fromTytx(s): string -> instance (must be static: decode starts
 *     from the suffix and rebuilds the instance from scratch)
 *   static tytxJsonNative: optional boolean, default false
 *
 * @param {Function} cls
 * @returns {Function} the class, so it can be used as a decorator
 */
function registerClass(cls) {
    if (!cls.tytxSuffix) {
        throw new Error(`registerClass: ${cls.name} is missing a static tytxSuffix`);
    }
    if (typeof cls.prototype?.toTytx !== 'function') {
        throw new Error(`registerClass: ${cls.name} is missing a toTytx method`);
    }
    if (typeof cls.fromTytx !== 'function') {
        throw new Error(`registerClass: ${cls.name} is missing a static fromTytx method`);
    }
    registerType(
        cls,
        cls.tytxSuffix,
        obj => obj.toTytx(),
        s => cls.fromTytx(s),
        cls.tytxJsonNative || false,
    );
    return cls;
}

/**
 * Store the subtype dictionary of a suffix, replacing the previous one.
 *
 * Nothing is checked: the suffix need not be registered and the content is up
 * to the type that owns the suffix. To extend it, read it with getSubtypeDict,
 * add the entries and set it again.
 *
 * @param {string} suffix
 * @param {Object} subtypes
 */
function setSubtypeDict(suffix, subtypes) {
    SUBTYPE_DICTS.set(suffix, subtypes);
}

/**
 * Return the subtype dictionary stored for a suffix, or {} if none was set.
 *
 * @param {string} suffix
 * @returns {Object}
 */
function getSubtypeDict(suffix) {
    return SUBTYPE_DICTS.has(suffix) ? SUBTYPE_DICTS.get(suffix) : {};
}

/**
 * Remove all custom type registrations and subtype dictionaries (test helper).
 */
function _resetCustomTypes() {
    for (const [, suffix] of CUSTOM_TYPES) {
        delete SUFFIX_TO_TYPE[suffix];
    }
    CUSTOM_TYPES = [];
    SUBTYPE_DICTS.clear();
}

export {
    // Decimal utilities
    decimalLibrary,
    createDecimal,
    isDecimal,
    setDecimalLibrary,
    getDecimalLibrary,
    // Date type detection
    getDateType,
    // Type registry
    getTypeEntry,
    getRegisteredType,
    getCustomTypeEntry,
    SUFFIX_TO_TYPE,
    SUFFIX_PATTERN,
    // Custom type registration
    registerType,
    registerClass,
    setSubtypeDict,
    getSubtypeDict,
    _resetCustomTypes,
    // Serializers (exported for testing)
    _serializeDecimal,
    _serializeDate,
    _serializeDatetime,
    _serializeTime,
    _serializeBool,
    _serializeInt,
    _serializeFloat,
    _serializeRaw,
    // Deserializers (exported for testing)
    _deserializeDecimal,
    _deserializeDate,
    _deserializeDatetime,
    _deserializeTime,
    _deserializeBool,
    _deserializeInt,
    _deserializeFloat,
    _deserializeStr,
    _deserializeNone,
    _deserializeRaw,
};

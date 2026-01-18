// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Type Registry for TYTX Base.
 *
 * Maps JavaScript types to/from TYTX suffixes.
 * Only scalar types are supported in base version.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// =============================================================================
// DECIMAL LIBRARY DETECTION
// =============================================================================

// Import all decimal libraries at startup
let DecimalJS = null;
let BigJS = null;

try { DecimalJS = require('decimal.js'); } catch {}
try { BigJS = require('big.js'); } catch {}

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

// =============================================================================
// TYPE REGISTRY
// =============================================================================

// Type detection and serialization
// For JS we need functions to detect types since we can't use type() like Python

/**
 * Get type entry for a value.
 * @param {any} value
 * @returns {[string, function, boolean]|null} [suffix, serializer, jsonNative] or null
 */
function getTypeEntry(value) {
    if (isDecimal(value)) {
        return ['N', _serializeDecimal, false];
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
    return null;
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
    // Handle Z suffix
    let str = s;
    if (str.endsWith('Z')) {
        str = str.slice(0, -1) + '+00:00';
    }
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

function _deserializeQs(s) {
    // Lazy import to avoid circular dependency
    const { fromQs } = require('./qs.js');
    return fromQs(s);
}

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
};

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
    SUFFIX_TO_TYPE,
    // Serializers (exported for testing)
    _serializeDecimal,
    _serializeDate,
    _serializeDatetime,
    _serializeTime,
    _serializeBool,
    _serializeInt,
    _serializeFloat,
    // Deserializers (exported for testing)
    _deserializeDecimal,
    _deserializeDate,
    _deserializeDatetime,
    _deserializeTime,
    _deserializeBool,
    _deserializeInt,
    _deserializeFloat,
    _deserializeStr,
};

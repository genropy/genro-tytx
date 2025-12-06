/**
 * TYTX Base - Type Registry
 *
 * Minimal registry for scalar types only.
 * No custom types, structs, or typed arrays.
 *
 * @module registry
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

/**
 * Decimal library detection.
 * @private
 */
let _DecimalLib = null;
let _decimalLibName = 'number';

try {
    _DecimalLib = require('big.js');
    _decimalLibName = 'big.js';
} catch {
    try {
        _DecimalLib = require('decimal.js');
        _decimalLibName = 'decimal.js';
    } catch {
        // No decimal library
    }
}

/**
 * Check if a value is a Decimal instance.
 * @param {*} value
 * @returns {boolean}
 */
function isDecimalInstance(value) {
    if (!_DecimalLib) return false;
    return value instanceof _DecimalLib ||
           (value && value.constructor && value.constructor.name === _DecimalLib.name);
}

/**
 * Type registry for TYTX Base.
 * Manages built-in scalar types only.
 */
class TypeRegistry {
    constructor() {
        /** @type {Map<string, Object>} */
        this._codes = new Map();
    }

    /**
     * Register a type definition.
     * @param {Object} typeDef
     */
    register(typeDef) {
        this._codes.set(typeDef.code, typeDef);
    }

    /**
     * Get type by code.
     * @param {string} code
     * @returns {Object|null}
     */
    get(code) {
        return this._codes.get(code) || null;
    }

    /**
     * Get the type code for a JavaScript value.
     * @param {*} value
     * @returns {string|null}
     */
    getTypeCode(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'boolean') {
            return 'B';
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'L' : 'R';
        }
        if (isDecimalInstance(value)) {
            return 'N';
        }
        if (value instanceof Date) {
            const hours = value.getUTCHours();
            const minutes = value.getUTCMinutes();
            const seconds = value.getUTCSeconds();
            const ms = value.getUTCMilliseconds();
            const year = value.getUTCFullYear();
            const month = value.getUTCMonth();
            const day = value.getUTCDate();

            // Time: epoch date (1970-01-01)
            if (year === 1970 && month === 0 && day === 1) {
                return 'H';
            }
            // Date: midnight UTC
            if (hours === 0 && minutes === 0 && seconds === 0 && ms === 0) {
                return 'D';
            }
            // DateTime
            return 'DHZ';
        }
        if (typeof value === 'string') {
            return 'T';
        }
        return null;
    }
}

// Global registry instance
const registry = new TypeRegistry();

module.exports = {
    TypeRegistry,
    registry,
    isDecimalInstance,
    DecimalLib: _DecimalLib,
    decimalLibName: _decimalLibName
};

/**
 * TYTX Base - Minimal Typed Text Protocol for Scalar Types
 *
 * Public API:
 *     // Text format (suffix only)
 *     toTypedText(data)     → '{"price":"100.50::N"}::JS'
 *     fromText(str)         → {price: Decimal("100.50")}
 *
 *     // JSON format (with TYTX:// prefix)
 *     toTypedJson(data)     → 'TYTX://{"price":"100.50::N"}::JS'
 *     fromJson(str)         → {price: Decimal("100.50")}
 *
 * @module genro-tytx
 * @version 0.7.0
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

// Ensure types are registered
require('./types');

// Import registry
const { registry, TypeRegistry, isDecimalInstance, DecimalLib, decimalLibName } = require('./registry');

// Import type definitions
const {
    IntType,
    FloatType,
    BoolType,
    StrType,
    DecimalType,
    DateType,
    DateTimeType,
    NaiveDateTimeType,
    TimeType
} = require('./types');

// Import encode/decode functions
const { toTypedText, toTypedJson, TYTX_MARKER, TYTX_PREFIX } = require('./encode');
const { fromText, fromJson } = require('./decode');

// Import fetch utilities
const {
    createDate,
    createTime,
    createDateTime,
    encodeQueryString,
    decodeQueryString,
    tytx_fetch
} = require('./fetch');

const VERSION = '0.7.0';

module.exports = {
    // Version
    VERSION,

    // Text format API
    toTypedText,
    fromText,

    // JSON format API (with TYTX:// prefix)
    toTypedJson,
    fromJson,

    // Registry
    registry,
    TypeRegistry,

    // Type definitions
    IntType,
    FloatType,
    BoolType,
    StrType,
    DecimalType,
    DateType,
    DateTimeType,
    NaiveDateTimeType,
    TimeType,

    // Utilities
    isDecimalInstance,
    DecimalLib,
    decimalLibName,

    // Constants
    TYTX_MARKER,
    TYTX_PREFIX,

    // Fetch utilities
    createDate,
    createTime,
    createDateTime,
    encodeQueryString,
    decodeQueryString,
    tytx_fetch
};

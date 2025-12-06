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

// Re-export types
export type {
    TypeCode,
    TypeDefinition,
    DecimalValue
} from './types';

export {
    IntType,
    FloatType,
    BoolType,
    StrType,
    DecimalType,
    DateType,
    DateTimeType,
    NaiveDateTimeType,
    TimeType,
    IntAliasType,
    allTypes
} from './types';

// Re-export registry
export type { DecimalConstructor } from './registry';
export {
    TypeRegistry,
    registry,
    DecimalLib,
    decimalLibName,
    isDecimalInstance
} from './registry';

// Re-export encode functions
export type { JsonValue, JsonObject, JsonArray } from './encode';
export {
    toTypedText,
    toTypedJson,
    TYTX_MARKER,
    TYTX_PREFIX
} from './encode';

// Re-export decode functions
export {
    fromText,
    fromJson
} from './decode';

/** Library version */
export const VERSION = '0.7.0';

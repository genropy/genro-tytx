/**
 * TYTX Base - Type Definitions
 *
 * Core type definitions for the TYTX protocol.
 *
 * @module types
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { DecimalLib, decimalLibName } from './registry';

/** Type codes supported by TYTX protocol */
export type TypeCode = 'N' | 'D' | 'DHZ' | 'DH' | 'H' | 'L' | 'R' | 'B' | 'T';

/** Represents a Decimal value (from big.js or decimal.js) */
export interface DecimalValue {
    toString(): string;
    toFixed(dp?: number): string;
}

/** Type definition interface */
export interface TypeDefinition<T = unknown> {
    /** Type code (e.g., 'N', 'D', 'DHZ') */
    code: TypeCode;
    /** Human-readable name */
    name: string;
    /** Check if value matches this type */
    match(value: unknown): boolean;
    /** Serialize value to string */
    serialize(value: T): string;
    /** Parse string to value */
    parse(raw: string): T;
}

/** Integer type (L) - Native in JSON, never matches for encoding */
export const IntType: TypeDefinition<number> = {
    code: 'L',
    name: 'integer',
    match: (_value: unknown): boolean => false, // Native JSON type - don't encode
    serialize: (value: number): string => String(value),
    parse: (raw: string): number => parseInt(raw, 10)
};

/** Float type (R) - Native in JSON, never matches for encoding */
export const FloatType: TypeDefinition<number> = {
    code: 'R',
    name: 'float',
    match: (_value: unknown): boolean => false, // Native JSON type - don't encode
    serialize: (value: number): string => String(value),
    parse: (raw: string): number => parseFloat(raw)
};

/** Boolean type (B) - Native in JSON, never matches for encoding */
export const BoolType: TypeDefinition<boolean> = {
    code: 'B',
    name: 'boolean',
    match: (_value: unknown): boolean => false, // Native JSON type - don't encode
    serialize: (value: boolean): string => value ? '1' : '0',
    parse: (raw: string): boolean => raw === '1' || raw.toLowerCase() === 'true'
};

/** String type (T) - Native in JSON, never matches for encoding */
export const StrType: TypeDefinition<string> = {
    code: 'T',
    name: 'string',
    match: (_value: unknown): boolean => false, // Native JSON type - don't encode
    serialize: (value: string): string => value,
    parse: (raw: string): string => raw
};

/**
 * Decimal type (N = Numeric)
 *
 * Uses big.js or decimal.js if available for arbitrary precision.
 * Without a decimal library, falls back to JavaScript's native Number type:
 * - parse() returns parseFloat(value) - may lose precision for large/precise numbers
 * - serialize() uses String(value) - may produce scientific notation
 *
 * For financial or scientific applications requiring exact decimal arithmetic,
 * install big.js or decimal.js: `npm install big.js` or `npm install decimal.js`
 *
 * @example
 * // With big.js installed:
 * parse("12345678901234567890.123456789") → Big("12345678901234567890.123456789")
 *
 * // Without decimal library (PRECISION LOSS):
 * parse("12345678901234567890.123456789") → 12345678901234567000 (!)
 */
export const DecimalType: TypeDefinition<DecimalValue | number> = {
    code: 'N',
    name: 'decimal',
    match: (value: unknown): boolean => {
        if (!DecimalLib) return false;
        if (value instanceof DecimalLib) return true;
        if (value && typeof value === 'object' && 'constructor' in value) {
            return (value as { constructor: { name: string } }).constructor.name === decimalLibName;
        }
        return false;
    },
    serialize: (value: DecimalValue | number): string => {
        if (typeof value === 'number') return String(value);
        return value.toString();
    },
    parse: (raw: string): DecimalValue | number => {
        if (DecimalLib) {
            return new DecimalLib(raw) as DecimalValue;
        }
        return parseFloat(raw);
    }
};

/**
 * Check if a Date represents a date-only value (midnight UTC)
 */
function isDateOnly(d: Date): boolean {
    return d.getUTCHours() === 0 &&
           d.getUTCMinutes() === 0 &&
           d.getUTCSeconds() === 0 &&
           d.getUTCMilliseconds() === 0;
}

/**
 * Check if a Date represents a time-only value (epoch date: 1970-01-01)
 */
function isTimeOnly(d: Date): boolean {
    return d.getUTCFullYear() === 1970 &&
           d.getUTCMonth() === 0 &&
           d.getUTCDate() === 1;
}

/**
 * Format number with leading zero
 */
function pad2(n: number): string {
    return n < 10 ? '0' + n : String(n);
}

/** Date type (D) - date only, no time component */
export const DateType: TypeDefinition<Date> = {
    code: 'D',
    name: 'date',
    match: (value: unknown): boolean => {
        return value instanceof Date && isDateOnly(value) && !isTimeOnly(value);
    },
    serialize: (value: Date): string => {
        const y = value.getUTCFullYear();
        const m = pad2(value.getUTCMonth() + 1);
        const d = pad2(value.getUTCDate());
        return `${y}-${m}-${d}`;
    },
    parse: (raw: string): Date => {
        const parts = raw.split('-').map(Number);
        const y = parts[0] ?? 1970;
        const m = parts[1] ?? 1;
        const d = parts[2] ?? 1;
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
};

/**
 * DateTime type (DHZ) - full datetime with timezone (UTC)
 * Serializes with millisecond precision per spec 6.3.
 * Always outputs .sssZ format (e.g., 2025-01-15T10:30:00.000Z)
 */
export const DateTimeType: TypeDefinition<Date> = {
    code: 'DHZ',
    name: 'datetime',
    match: (value: unknown): boolean => {
        return value instanceof Date && !isDateOnly(value) && !isTimeOnly(value);
    },
    serialize: (value: Date): string => {
        // Use toISOString() for millisecond precision (always includes .sss)
        return value.toISOString();
    },
    parse: (raw: string): Date => {
        return new Date(raw);
    }
};

/** Naive DateTime type (DH) - datetime without timezone (deprecated) */
export const NaiveDateTimeType: TypeDefinition<Date> = {
    code: 'DH',
    name: 'naive_datetime',
    match: (_value: unknown): boolean => false, // Never matches for encoding
    serialize: (value: Date): string => {
        const y = value.getUTCFullYear();
        const mo = pad2(value.getUTCMonth() + 1);
        const d = pad2(value.getUTCDate());
        const h = pad2(value.getUTCHours());
        const mi = pad2(value.getUTCMinutes());
        const s = pad2(value.getUTCSeconds());
        return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    },
    parse: (raw: string): Date => {
        // Naive datetime - parse as UTC
        const isoStr = raw.endsWith('Z') ? raw : raw + 'Z';
        return new Date(isoStr);
    }
};

/**
 * Time type (H = Hour)
 * Serializes with millisecond precision per spec 6.4.
 */
export const TimeType: TypeDefinition<Date> = {
    code: 'H',
    name: 'time',
    match: (value: unknown): boolean => {
        return value instanceof Date && isTimeOnly(value);
    },
    serialize: (value: Date): string => {
        const h = pad2(value.getUTCHours());
        const m = pad2(value.getUTCMinutes());
        const s = pad2(value.getUTCSeconds());
        const ms = value.getUTCMilliseconds();
        if (ms === 0) {
            return `${h}:${m}:${s}`;
        }
        return `${h}:${m}:${s}.${String(ms).padStart(3, '0')}`;
    },
    parse: (raw: string): Date => {
        // Handle both HH:MM:SS and HH:MM:SS.mmm formats
        const [timePart, msPart] = raw.split('.');
        const parts = timePart.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const s = parts[2] ?? 0;
        const ms = msPart ? parseInt(msPart.padEnd(3, '0').slice(0, 3), 10) : 0;
        return new Date(Date.UTC(1970, 0, 1, h, m, s, ms));
    }
};

/** All type definitions */
export const allTypes: TypeDefinition[] = [
    DecimalType,
    DateType,
    DateTimeType,
    NaiveDateTimeType,
    TimeType,
    IntType,
    FloatType,
    BoolType,
    StrType
];

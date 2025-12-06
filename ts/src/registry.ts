/**
 * TYTX Base - Type Registry
 *
 * Registry for type definitions and Decimal library detection.
 *
 * @module registry
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import type { TypeCode, TypeDefinition, DecimalValue } from './types';

/** Decimal library constructor type */
export interface DecimalConstructor {
    new (value: string | number): DecimalValue;
    name: string;
}

// Decimal library detection
let _DecimalLib: DecimalConstructor | null = null;
let _decimalLibName: string = 'number';

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _DecimalLib = require('big.js');
    _decimalLibName = 'big.js';
} catch {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        _DecimalLib = require('decimal.js');
        _decimalLibName = 'decimal.js';
    } catch {
        // No decimal library available
    }
}

/** Detected Decimal library (big.js, decimal.js, or null) */
export const DecimalLib = _DecimalLib;

/** Name of detected decimal library */
export const decimalLibName = _decimalLibName;

/**
 * Check if a value is an instance of the Decimal library
 */
export function isDecimalInstance(value: unknown): value is DecimalValue {
    if (!DecimalLib) return false;
    if (value instanceof DecimalLib) return true;
    if (value && typeof value === 'object' && 'constructor' in value) {
        return (value as { constructor: { name: string } }).constructor.name === decimalLibName;
    }
    return false;
}

/**
 * Type Registry - manages type definitions
 */
export class TypeRegistry {
    private _codes: Map<TypeCode, TypeDefinition> = new Map();

    /**
     * Register a type definition
     */
    register(typeDef: TypeDefinition): void {
        this._codes.set(typeDef.code, typeDef);
    }

    /**
     * Get type definition by code
     */
    get(code: string): TypeDefinition | null {
        return this._codes.get(code as TypeCode) || null;
    }

    /**
     * Check if a type code is registered
     */
    has(code: string): boolean {
        return this._codes.has(code as TypeCode);
    }

    /**
     * Get all registered type codes
     */
    codes(): TypeCode[] {
        return Array.from(this._codes.keys());
    }

    /**
     * Get type code for a value (if it needs typing)
     * Returns null for native JSON types
     */
    getTypeCode(value: unknown): TypeCode | null {
        if (value === null || value === undefined) return null;

        // Check Decimal first (before number check)
        if (isDecimalInstance(value)) return 'N';

        // Native JSON types - no typing needed
        if (typeof value === 'string') return null;
        if (typeof value === 'boolean') return null;
        if (typeof value === 'number') return null;

        // Date handling
        if (value instanceof Date) {
            // Time only (epoch date 1970-01-01)
            if (value.getUTCFullYear() === 1970 &&
                value.getUTCMonth() === 0 &&
                value.getUTCDate() === 1) {
                return 'H';
            }
            // Date only (midnight UTC)
            if (value.getUTCHours() === 0 &&
                value.getUTCMinutes() === 0 &&
                value.getUTCSeconds() === 0 &&
                value.getUTCMilliseconds() === 0) {
                return 'D';
            }
            // Full datetime
            return 'DHZ';
        }

        return null;
    }
}

/** Global registry instance */
export const registry = new TypeRegistry();

/**
 * Type registry for TYTX TypeScript implementation.
 *
 * @module registry
 */

import type { DataType, TytxValue, TypeCode } from './types.js';
import { isTypedString, extractTypeCode, extractValue } from './types.js';

/**
 * Built-in type handlers.
 */

const IntType: DataType<number> = {
  code: 'L',
  name: 'int',
  jsType: 'number',
  parse: (value: string) => parseInt(value, 10),
  serialize: (value: number) => String(Math.trunc(value)),
  isType: (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value),
};

const FloatType: DataType<number> = {
  code: 'R',
  name: 'float',
  jsType: 'number',
  parse: (value: string) => parseFloat(value),
  serialize: (value: number) => String(value),
  isType: (value: unknown): value is number =>
    typeof value === 'number' && !Number.isInteger(value),
};

let bigLoader: (() => unknown) | null = null;

const DecimalType: DataType<number | bigint> = {
  code: 'N',
  name: 'decimal',
  jsType: 'number | Big',
  parse: (value: string): number | bigint => {
    // Try to use big.js if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Big = (bigLoader ?? (() => require('big.js'))) as () => unknown;
      const BigCtor = Big() as { new (v: string): number | bigint };
      return new BigCtor(value);
    } catch {
      return parseFloat(value);
    }
  },
  serialize: (value: number | bigint) => String(value),
  isType: (value: unknown): value is number | bigint =>
    typeof value === 'number' || typeof value === 'bigint',
};

const BoolType: DataType<boolean> = {
  code: 'B',
  name: 'bool',
  jsType: 'boolean',
  parse: (value: string) => {
    const lower = value.toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(lower);
  },
  serialize: (value: boolean) => String(value),
  isType: (value: unknown): value is boolean => typeof value === 'boolean',
};

const StrType: DataType<string> = {
  code: 'T',
  name: 'str',
  jsType: 'string',
  parse: (value: string) => value,
  serialize: (value: string) => value,
  isType: (value: unknown): value is string => typeof value === 'string',
};

/**
 * Date type - calendar date without time.
 * In JS, dates are stored as Date objects at midnight UTC.
 */
const DateType: DataType<Date> = {
  code: 'D',
  name: 'date',
  jsType: 'Date',
  parse: (value: string) => new Date(value + 'T00:00:00.000Z'),
  serialize: (value: Date) => {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  isType: (value: unknown): value is Date => {
    if (!(value instanceof Date)) return false;
    // Date is midnight UTC
    return (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0 &&
      // Not epoch (that's time)
      !(value.getUTCFullYear() === 1970 && value.getUTCMonth() === 0 && value.getUTCDate() === 1)
    );
  },
};

/**
 * DateTime type - date with time (timezone-aware).
 * DHZ preserves timezone information. When serialized, always outputs
 * with Z suffix for UTC. This allows cross-timezone operations:
 * America -> Paris (save as UTC) -> Tokyo (view as local or UTC).
 */
const DateTimeType: DataType<Date> = {
  code: 'DHZ',
  name: 'datetime',
  jsType: 'Date',
  parse: (value: string) => new Date(value),
  serialize: (value: Date) => {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    const seconds = String(value.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  },
  isType: (value: unknown): value is Date => {
    if (!(value instanceof Date)) return false;
    // Not midnight UTC and not epoch date
    const isMidnightUtc =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;
    const isEpoch =
      value.getUTCFullYear() === 1970 && value.getUTCMonth() === 0 && value.getUTCDate() === 1;
    return !isMidnightUtc && !isEpoch;
  },
};

/**
 * Naive DateTime type - date with time (no timezone).
 * DEPRECATED: Use DateTimeType (DHZ) instead.
 * DH is for naive datetimes without timezone info.
 * Serializes as ISO format without Z suffix.
 */
const NaiveDateTimeType: DataType<Date> = {
  code: 'DH',
  name: 'naive_datetime',
  jsType: 'Date',
  parse: (value: string) => new Date(value),
  serialize: (value: Date) => {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    const seconds = String(value.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  },
  isType: (_value: unknown): _value is Date => false, // Never auto-detected
};

/**
 * Time type - time without date.
 * In JS, time is stored as Date on epoch (1970-01-01) UTC.
 */
const TimeType: DataType<Date> = {
  code: 'H',
  name: 'time',
  jsType: 'Date',
  parse: (value: string) => new Date('1970-01-01T' + value + 'Z'),
  serialize: (value: Date) => {
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    const seconds = String(value.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  },
  isType: (value: unknown): value is Date => {
    if (!(value instanceof Date)) return false;
    // Time is epoch date (1970-01-01)
    return (
      value.getUTCFullYear() === 1970 && value.getUTCMonth() === 0 && value.getUTCDate() === 1
    );
  },
};

const JsonType: DataType<object> = {
  code: 'JS',
  name: 'json',
  jsType: 'object',
  parse: (value: string) => JSON.parse(value) as object,
  serialize: (value: object) => JSON.stringify(value),
  isType: (value: unknown): value is object =>
    typeof value === 'object' && value !== null && !(value instanceof Date),
};

/**
 * Type registry class.
 */
export class TypeRegistry {
  private readonly types: Map<string, DataType> = new Map();
  private readonly codeToType: Map<string, DataType> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    const builtins = [
      IntType,
      FloatType,
      DecimalType,
      BoolType,
      StrType,
      DateType,
      DateTimeType,
      NaiveDateTimeType, // DH - deprecated
      TimeType,
      JsonType,
    ];

    for (const type of builtins) {
      this.register(type);
    }
  }

  /**
   * Register a type handler.
   */
  register(type: DataType): void {
    this.types.set(type.name, type);
    this.codeToType.set(type.code, type);
  }

  /**
   * Get type handler by code or name.
   */
  get(codeOrName: string): DataType | undefined {
    return this.codeToType.get(codeOrName.toUpperCase()) ?? this.types.get(codeOrName);
  }

  /**
   * Parse typed string to value.
   * Supports typed arrays: "[1,2,3]::L" applies type to all leaf values.
   */
  fromText(value: string, typeCode?: TypeCode): TytxValue {
    if (typeCode) {
      const type = this.get(typeCode);
      return type ? (type.parse(value) as TytxValue) : value;
    }

    if (!isTypedString(value)) {
      return value;
    }

    const code = extractTypeCode(value);
    const rawValue = extractValue(value);
    const type = this.get(code);

    if (type) {
      // Check if it's a typed array: starts with '['
      if (rawValue.startsWith('[')) {
        return this.parseTypedArray(rawValue, type) as TytxValue;
      }
      return type.parse(rawValue) as TytxValue;
    }

    return value;
  }

  /**
   * Parse a typed array, applying the type to all leaf values.
   */
  private parseTypedArray(jsonStr: string, type: DataType): unknown[] {
    const data = JSON.parse(jsonStr) as unknown[];

    const applyType = (item: unknown): unknown => {
      if (Array.isArray(item)) {
        return item.map(applyType);
      }
      return type.parse(String(item));
    };

    return applyType(data) as unknown[];
  }

  /**
   * Serialize value to string.
   */
  asText(value: TytxValue): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (value instanceof Date) {
      // Smart detection: time, date, or datetime
      if (TimeType.isType(value)) {
        return TimeType.serialize(value);
      }
      if (DateType.isType(value)) {
        return DateType.serialize(value);
      }
      return DateTimeType.serialize(value);
    }
    return String(value);
  }

  /**
   * Serialize value to typed string with ::code suffix.
   *
   * Date detection convention (JS has only Date type):
   * - Date (::D): midnight UTC (hours, minutes, seconds, ms all 0)
   * - Time (::H): epoch date (1970-01-01) - "first date in the world"
   * - DateTime (::DHZ): all other cases (timezone-aware)
   *
   * @param value - Value to serialize
   * @param compactArray - If true, produce compact format "[1,2,3]::L" for homogeneous arrays
   */
  asTypedText(value: TytxValue, compactArray = false): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    // Handle compact array format
    if (compactArray && Array.isArray(value)) {
      const result = this.tryCompactArray(value);
      if (result !== null) {
        return result;
      }
      // Fallback: type each element individually
      return this.serializeArrayElements(value);
    }

    // Date/DateTime/Time - smart detection using UTC
    if (value instanceof Date) {
      // Check if it's time (epoch date: 1970-01-01)
      if (TimeType.isType(value)) {
        return `${TimeType.serialize(value)}::H`;
      }
      // Check if it's date-only (midnight UTC)
      if (DateType.isType(value)) {
        return `${DateType.serialize(value)}::D`;
      }
      // Otherwise it's datetime (timezone-aware)
      return `${DateTimeType.serialize(value)}::DHZ`;
    }

    // Boolean
    if (typeof value === 'boolean') {
      return `${BoolType.serialize(value)}::B`;
    }

    // Number
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? `${IntType.serialize(value)}::L`
        : `${FloatType.serialize(value)}::R`;
    }

    // BigInt
    if (typeof value === 'bigint') {
      return `${String(value)}::L`;
    }

    // Object/Array
    if (typeof value === 'object' && value !== null) {
      return `${JsonType.serialize(value)}::JS`;
    }

    // String - return as-is
    return String(value);
  }

  /**
   * Get type code for a leaf value.
   */
  private getTypeCodeForValue(value: unknown): string | null {
    if (value instanceof Date) {
      if (TimeType.isType(value)) return 'H';
      if (DateType.isType(value)) return 'D';
      return 'DHZ';
    }
    if (typeof value === 'boolean') return 'B';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'L' : 'R';
    }
    if (typeof value === 'bigint') return 'L';
    return null; // strings and other types
  }

  /**
   * Collect all unique type codes from leaf values.
   */
  private collectLeafTypes(value: unknown): Set<string | null> {
    if (Array.isArray(value)) {
      const result = new Set<string | null>();
      for (const item of value) {
        for (const t of this.collectLeafTypes(item)) {
          result.add(t);
        }
      }
      return result;
    }
    return new Set([this.getTypeCodeForValue(value)]);
  }

  /**
   * Serialize leaf values using a specific type.
   */
  private serializeLeaf(value: unknown, type: DataType): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeLeaf(item, type));
    }
    return type.serialize(value as never);
  }

  /**
   * Try to serialize array in compact format.
   */
  private tryCompactArray(value: unknown[]): string | null {
    if (value.length === 0) {
      return '[]';
    }

    const leafTypes = this.collectLeafTypes(value);

    // If there are any null (strings), array is not fully typed - fallback
    if (leafTypes.has(null)) {
      return null;
    }

    if (leafTypes.size !== 1) {
      return null; // Not homogeneous
    }

    const typeCode = [...leafTypes][0]!;
    const type = this.get(typeCode);
    if (!type) {
      return null;
    }

    const serialized = this.serializeLeaf(value, type);
    return JSON.stringify(serialized) + '::' + typeCode;
  }

  /**
   * Serialize array with each element typed individually.
   */
  private serializeArrayElements(value: unknown[]): string {
    const serializeItem = (item: unknown): unknown => {
      if (Array.isArray(item)) {
        return item.map(serializeItem);
      }
      return this.asTypedText(item as TytxValue);
    };
    return JSON.stringify(value.map(serializeItem));
  }

  /**
   * Check if string has type suffix.
   */
  isTyped(value: string): boolean {
    if (!isTypedString(value)) return false;
    const code = extractTypeCode(value);
    return this.get(code) !== undefined;
  }
}

/**
 * Default registry instance.
 */
export const registry = new TypeRegistry();

/**
 * Override Big loader (testing only).
 */
export function __setBigLoader(loader: (() => unknown) | null): void {
  bigLoader = loader;
}

/**
 * Re-export built-in types for custom type creation.
 */
export { IntType, FloatType, DecimalType, BoolType, StrType, DateType, DateTimeType, NaiveDateTimeType, TimeType, JsonType };

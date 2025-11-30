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
  aliases: ['I', 'INT', 'INTEGER', 'LONG'],
  jsType: 'number',
  parse: (value: string) => parseInt(value, 10),
  serialize: (value: number) => String(Math.trunc(value)),
  isType: (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value),
};

const FloatType: DataType<number> = {
  code: 'R',
  name: 'float',
  aliases: ['F', 'REAL', 'FLOAT'],
  jsType: 'number',
  parse: (value: string) => parseFloat(value),
  serialize: (value: number) => String(value),
  isType: (value: unknown): value is number =>
    typeof value === 'number' && !Number.isInteger(value),
};

const DecimalType: DataType<number | bigint> = {
  code: 'N',
  name: 'decimal',
  aliases: ['NUMERIC', 'DECIMAL'],
  jsType: 'number | Big',
  parse: (value: string) => {
    // Try to use big.js if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Big = require('big.js');
      return new Big(value);
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
  aliases: ['BOOL', 'BOOLEAN'],
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
  aliases: ['S', 'TEXT', 'STRING'],
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
  aliases: ['DATE', 'd', 'date'],
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
  aliases: [],
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
  aliases: [],
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
  aliases: ['TIME', 'HZ'],
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
  aliases: ['JSON'],
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
    for (const alias of type.aliases) {
      this.codeToType.set(alias, type);
    }
  }

  /**
   * Get type handler by code or name.
   */
  get(codeOrName: string): DataType | undefined {
    return this.codeToType.get(codeOrName.toUpperCase()) ?? this.types.get(codeOrName);
  }

  /**
   * Parse typed string to value.
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

    return type ? (type.parse(rawValue) as TytxValue) : value;
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
   */
  asTypedText(value: TytxValue): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

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
 * Re-export built-in types for custom type creation.
 */
export { IntType, FloatType, DecimalType, BoolType, StrType, DateType, DateTimeType, NaiveDateTimeType, TimeType, JsonType };

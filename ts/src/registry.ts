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

const DateType: DataType<Date> = {
  code: 'D',
  name: 'date',
  aliases: ['DATE'],
  jsType: 'Date',
  parse: (value: string) => new Date(value + 'T00:00:00'),
  serialize: (value: Date) => value.toISOString().split('T')[0],
  isType: (value: unknown): value is Date => {
    if (!(value instanceof Date)) return false;
    return value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0;
  },
};

const DateTimeType: DataType<Date> = {
  code: 'DH',
  name: 'datetime',
  aliases: ['DT', 'DHZ', 'DATETIME'],
  jsType: 'Date',
  parse: (value: string) => new Date(value),
  serialize: (value: Date) => value.toISOString().replace('Z', '').split('.')[0],
  isType: (value: unknown): value is Date => {
    if (!(value instanceof Date)) return false;
    return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
  },
};

const TimeType: DataType<string> = {
  code: 'H',
  name: 'time',
  aliases: ['TIME', 'HZ'],
  jsType: 'string',
  parse: (value: string) => value,
  serialize: (value: string) => value,
  isType: (_value: unknown): _value is string => false, // Time is always explicit
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
      return DateTimeType.isType(value)
        ? DateTimeType.serialize(value)
        : DateType.serialize(value);
    }
    return String(value);
  }

  /**
   * Serialize value to typed string with ::code suffix.
   */
  asTypedText(value: TytxValue): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    // Date/DateTime
    if (value instanceof Date) {
      const isDateTime = value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
      return isDateTime
        ? `${DateTimeType.serialize(value)}::DH`
        : `${DateType.serialize(value)}::D`;
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
export { IntType, FloatType, DecimalType, BoolType, StrType, DateType, DateTimeType, TimeType, JsonType };

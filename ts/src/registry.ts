/**
 * Type registry for TYTX TypeScript implementation.
 *
 * Uses unified maps for both built-in and custom types.
 * Custom types use ~ prefix to avoid collisions.
 *
 * @module registry
 */

import type { DataType, TytxValue, TypeCode } from './types.js';
import { isTypedString, extractTypeCode, extractValue } from './types.js';

/**
 * Prefix for custom extension types.
 */
export const CUSTOM_PREFIX = '~';

/**
 * Prefix for struct schema types.
 */
export const STRUCT_PREFIX = '@';

/**
 * Prefix for typed arrays.
 */
export const ARRAY_PREFIX = '#';

/**
 * Interface for classes that can be registered with TYTX.
 * Classes implementing this interface can be registered without
 * providing explicit serialize/parse functions.
 */
export interface TytxSerializable {
  /** Serialize this instance to a TYTX string (without the ::~CODE suffix) */
  as_typed_text(): string;
}

/**
 * Static interface for TYTX-serializable classes.
 */
export interface TytxSerializableClass<T> {
  /** Parse a TYTX string to create an instance */
  from_typed_text(s: string): T;
  new (...args: unknown[]): T;
}

/**
 * Extension type for custom classes registered via register_class.
 */
export interface ExtensionType<T = unknown> {
  code: string;
  name: string;
  cls: TytxSerializableClass<T> | (new (...args: unknown[]) => T);
  serialize: (value: T) => string;
  parse: (s: string) => T;
}

/**
 * Schema type for struct registration.
 * - string[]: positional types ['T', 'L', 'N'] or homogeneous ['N']
 * - Record<string, string>: keyed types {name: 'T', balance: 'N'}
 * - string: ordered types "x:R,y:R" (named → object) or "R,R" (anonymous → array)
 */
export type StructSchema = string[] | Record<string, string> | string;

/**
 * Parsed string schema field.
 */
interface StringSchemaField {
  name: string;
  typeCode: string;
}

/**
 * Struct type for schema-based hydration.
 */
interface StructType {
  code: string;
  name: string;
  schema: StructSchema;
  stringFields: StringSchemaField[] | null;
  stringHasNames: boolean;
}

/**
 * Built-in type handlers.
 */

const IntType: DataType<number> = {
  code: 'L',
  name: 'int',
  parse: (value: string) => parseInt(value, 10),
  serialize: (value: number) => String(Math.trunc(value)),
  isType: (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value),
};

const FloatType: DataType<number> = {
  code: 'R',
  name: 'float',
  parse: (value: string) => parseFloat(value),
  serialize: (value: number) => String(value),
  isType: (value: unknown): value is number =>
    typeof value === 'number' && !Number.isInteger(value),
};

let bigLoader: (() => unknown) | null = null;

const DecimalType: DataType<number | bigint> = {
  code: 'N',
  name: 'decimal',
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
  parse: (value: string) => JSON.parse(value) as object,
  serialize: (value: object) => JSON.stringify(value),
  isType: (value: unknown): value is object =>
    typeof value === 'object' && value !== null && !(value instanceof Date),
};

/**
 * Type registry class.
 */
export class TypeRegistry {
  private readonly types: Map<string, DataType | ExtensionType> = new Map();
  private readonly codeToType: Map<string, DataType | ExtensionType> = new Map();
  private readonly constructors: Map<new (...args: unknown[]) => unknown, ExtensionType> = new Map();
  private readonly structs: Map<string, StructType> = new Map();

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
   * Register a type handler (internal, for built-in types).
   */
  register(type: DataType): void {
    this.types.set(type.name, type);
    this.codeToType.set(type.code, type);
  }

  /**
   * Register a custom extension type with ~ prefix.
   *
   * If serialize/parse are not provided, the class must implement:
   * - as_typed_text(): instance method for serialization
   * - static from_typed_text(s: string): static method for parsing
   *
   * @param code - Type code (will be prefixed with ~)
   * @param cls - Constructor function (required for auto-detection)
   * @param serialize - Function to convert value to string (optional)
   * @param parse - Function to convert string to value (optional)
   * @throws Error if serialize/parse not provided and class lacks required methods
   */
  register_class<T>(
    code: string,
    cls: TytxSerializableClass<T> | (new (...args: unknown[]) => T),
    serialize?: (value: T) => string,
    parse?: (s: string) => T,
  ): void {
    // Auto-detect serialize from class method
    let actualSerialize = serialize;
    if (actualSerialize === undefined) {
      if ('prototype' in cls && typeof (cls.prototype as TytxSerializable).as_typed_text === 'function') {
        actualSerialize = (v: T) => (v as TytxSerializable).as_typed_text();
      } else {
        throw new Error(
          `Class ${cls.name || 'unknown'} must have as_typed_text() method ` +
          'or provide serialize parameter'
        );
      }
    }

    // Auto-detect parse from class static method
    let actualParse = parse;
    if (actualParse === undefined) {
      if ('from_typed_text' in cls && typeof cls.from_typed_text === 'function') {
        actualParse = (cls as TytxSerializableClass<T>).from_typed_text.bind(cls);
      } else {
        throw new Error(
          `Class ${cls.name || 'unknown'} must have static from_typed_text() method ` +
          'or provide parse parameter'
        );
      }
    }

    const extType: ExtensionType<T> = {
      code: CUSTOM_PREFIX + code,
      name: 'x_' + code.toLowerCase(),
      cls: cls,
      serialize: actualSerialize,
      parse: actualParse,
    };

    // Register in unified maps
    this.types.set(extType.name, extType as ExtensionType);
    this.codeToType.set(extType.code, extType as ExtensionType);
    this.constructors.set(cls, extType as ExtensionType);
  }

  /**
   * Remove a previously registered custom extension type.
   * @param code - Type code without ~ prefix
   */
  unregister_class(code: string): void {
    const fullCode = CUSTOM_PREFIX + code;
    const extType = this.codeToType.get(fullCode) as ExtensionType | undefined;
    if (extType) {
      this.codeToType.delete(fullCode);
      this.types.delete(extType.name);
      if (extType.cls) {
        this.constructors.delete(extType.cls);
      }
    }
  }

  /**
   * Register a struct schema for schema-based hydration.
   *
   * @param code - Struct code (will be prefixed with @)
   * @param schema - Type schema:
   *   - string[]: positional ['T', 'L', 'N'] or homogeneous ['N']
   *   - Record<string, string>: keyed {name: 'T', balance: 'N'}
   *   - string: ordered "x:R,y:R" (named → object) or "R,R" (anonymous → array)
   */
  register_struct(code: string, schema: StructSchema): void {
    let stringFields: StringSchemaField[] | null = null;
    let stringHasNames = false;

    // Parse string schema
    if (typeof schema === 'string') {
      const parsed = this.parseStringSchema(schema);
      stringFields = parsed.fields;
      stringHasNames = parsed.hasNames;
    }

    const structType: StructType = {
      code: STRUCT_PREFIX + code,
      name: `struct_${code.toLowerCase()}`,
      schema,
      stringFields,
      stringHasNames,
    };

    this.structs.set(code, structType);
  }

  /**
   * Parse a string schema definition.
   */
  private parseStringSchema(schema: string): { fields: StringSchemaField[]; hasNames: boolean } {
    const fields: StringSchemaField[] = [];
    let hasNames = false;

    for (const part of schema.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if (trimmed.includes(':')) {
        const [name, typeCode] = trimmed.split(':').map((s) => s.trim());
        fields.push({ name, typeCode });
        hasNames = true;
      } else {
        fields.push({ name: '', typeCode: trimmed });
      }
    }

    return { fields, hasNames };
  }

  /**
   * Remove a previously registered struct schema.
   * @param code - Struct code without @ prefix
   */
  unregister_struct(code: string): void {
    this.structs.delete(code);
  }

  /**
   * Get a struct schema by code.
   * @param code - Struct code without @ prefix
   * @returns Schema or undefined if not found
   */
  get_struct(code: string): StructSchema | undefined {
    const structType = this.structs.get(code);
    return structType?.schema;
  }

  /**
   * Get type handler by code or name.
   */
  get(codeOrName: string): DataType | ExtensionType | undefined {
    return this.codeToType.get(codeOrName.toUpperCase()) ?? this.codeToType.get(codeOrName) ?? this.types.get(codeOrName);
  }

  /**
   * Get extension type by constructor.
   */
  getByConstructor(ctor: new (...args: unknown[]) => unknown): ExtensionType | undefined {
    return this.constructors.get(ctor);
  }

  /**
   * Parse typed string to value.
   * Supports typed arrays: "[1,2,3]::#L" applies type to all leaf values.
   * Supports struct schemas: '{"a":1}::@CODE' applies schema to data.
   * Supports array of structs: '[...]::@#CODE' applies schema to each element.
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

    // Handle # prefix for typed arrays (each element #i is of type X)
    // Supports both ::#L (built-in) and ::#@ROW (struct)
    if (code.startsWith(ARRAY_PREFIX)) {
      const baseTypeCode = code.slice(ARRAY_PREFIX.length);

      // Check if it's a struct reference (#@STRUCT)
      if (baseTypeCode.startsWith(STRUCT_PREFIX)) {
        const structCode = baseTypeCode.slice(STRUCT_PREFIX.length);
        const structType = this.structs.get(structCode);
        if (structType) {
          return this.parseStructArray(rawValue, structType) as TytxValue;
        }
        return value;
      }

      // Regular typed array (#L, #N, etc.)
      const type = this.get(baseTypeCode);
      if (type) {
        return this.parseTypedArray(rawValue, type) as TytxValue;
      }
      return value;
    }

    // Handle @ prefix (struct)
    if (code.startsWith(STRUCT_PREFIX)) {
      const structCode = code.slice(STRUCT_PREFIX.length);
      const structType = this.structs.get(structCode);
      if (structType) {
        const data = JSON.parse(rawValue) as unknown;
        return this.applySchema(data, structType) as TytxValue;
      }
      return value;
    }

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
  private parseTypedArray(jsonStr: string, type: DataType | ExtensionType): unknown[] {
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
   * Parse an array of structs, applying the struct schema to each element.
   */
  private parseStructArray(jsonStr: string, structType: StructType): unknown[] {
    const data = JSON.parse(jsonStr) as unknown[];
    return data.map((item) => this.applySchema(item, structType));
  }

  /**
   * Apply schema to hydrate data.
   */
  private applySchema(data: unknown, structType: StructType): unknown {
    // String schema: use parsed fields
    if (structType.stringFields !== null) {
      return this.applyStringSchema(data, structType);
    }
    // Dict schema (object)
    if (!Array.isArray(structType.schema) && typeof structType.schema === 'object') {
      return this.applyDictSchema(data, structType.schema);
    }
    // List schema (array)
    if (Array.isArray(structType.schema)) {
      return this.applyListSchema(data, structType.schema);
    }
    return data;
  }

  /**
   * Apply string schema to data (array input).
   */
  private applyStringSchema(data: unknown, structType: StructType): unknown {
    if (!Array.isArray(data)) {
      return data;
    }
    return this.applyStringSchemaToSingleRecord(data, structType);
  }

  /**
   * Apply string schema to a single array record.
   */
  private applyStringSchemaToSingleRecord(
    data: unknown[],
    structType: StructType,
  ): Record<string, unknown> | unknown[] {
    const fields = structType.stringFields!;
    const resultList: unknown[] = [];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (i < data.length) {
        resultList.push(this.hydrateValue(data[i], field.typeCode));
      } else {
        resultList.push(null);
      }
    }

    // If schema has names, return object; otherwise return array
    if (structType.stringHasNames) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < fields.length; i++) {
        result[fields[i].name] = resultList[i];
      }
      return result;
    }
    return resultList;
  }

  /**
   * Apply dict schema to data.
   */
  private applyDictSchema(data: unknown, schema: Record<string, string>): unknown {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return data;
    }
    const result: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    for (const [key, typeCode] of Object.entries(schema)) {
      if (key in result) {
        result[key] = this.hydrateValue(result[key], typeCode);
      }
    }
    return result;
  }

  /**
   * Apply list schema to data.
   */
  private applyListSchema(data: unknown, schema: string[]): unknown {
    if (!Array.isArray(data)) {
      return data;
    }

    if (schema.length === 1) {
      // Homogeneous: apply single type to all elements
      const typeCode = schema[0];
      return data.map((item) => this.applyHomogeneous(item, typeCode));
    } else {
      // Positional: apply type at index i to data[i]
      // If data is array of arrays, apply positionally to each sub-array
      if (data.length > 0 && Array.isArray(data[0])) {
        return data.map((item) => this.applyPositional(item as unknown[], schema));
      }
      return this.applyPositional(data, schema);
    }
  }

  /**
   * Apply homogeneous type recursively.
   */
  private applyHomogeneous(item: unknown, typeCode: string): unknown {
    if (Array.isArray(item)) {
      return item.map((i) => this.applyHomogeneous(i, typeCode));
    }
    return this.hydrateValue(item, typeCode);
  }

  /**
   * Apply positional schema to a single array.
   */
  private applyPositional(data: unknown[], schema: string[]): unknown[] {
    const result: unknown[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < schema.length) {
        result.push(this.hydrateValue(data[i], schema[i]));
      } else {
        result.push(data[i]);
      }
    }
    return result;
  }

  /**
   * Hydrate a single value using type code.
   */
  private hydrateValue(value: unknown, typeCode: string): unknown {
    // Check if it's a struct reference (recursive)
    if (typeCode.startsWith(STRUCT_PREFIX)) {
      const structCode = typeCode.slice(STRUCT_PREFIX.length);
      const structType = this.structs.get(structCode);
      if (structType) {
        return this.applySchema(value, structType);
      }
      return value;
    }

    // Regular type
    const type = this.get(typeCode);
    if (type) {
      const strValue = typeof value === 'string' ? value : String(value);
      return type.parse(strValue);
    }

    return value;
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
    if (typeof value === 'string') return null;

    // Check custom types (registered via register_class)
    if (typeof value === 'object' && value !== null && value.constructor) {
      const extType = this.constructors.get(value.constructor as new (...args: unknown[]) => unknown);
      if (extType) {
        return extType.code;
      }
    }

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
  private serializeLeaf(value: unknown, type: DataType | ExtensionType): unknown {
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

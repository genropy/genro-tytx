/**
 * Core type definitions for TYTX TypeScript implementation.
 *
 * @module types
 */

/**
 * Supported TYTX type codes.
 */
export type TypeCode =
  | 'L'    // Integer
  | 'R'    // Float
  | 'N'    // Decimal
  | 'B'    // Boolean
  | 'T'    // String
  | 'D'    // Date
  | 'DHZ'  // DateTime (timezone-aware, canonical)
  | 'DH'   // DateTime (naive, deprecated)
  | 'H'    // Time
  | 'TYTX' // TYTX (JSON with typed values)
  | 'NN';  // None/Null

/**
 * Primary type codes (canonical forms).
 * DHZ = timezone-aware datetime (canonical)
 * DH = naive datetime (deprecated)
 */
export type PrimaryTypeCode = 'L' | 'R' | 'N' | 'B' | 'T' | 'D' | 'DHZ' | 'DH' | 'H' | 'TYTX' | 'NN';

/**
 * TYTX value types that can be serialized.
 */
export type TytxValue =
  | number
  | bigint
  | boolean
  | string
  | Date
  | null
  | undefined
  | TytxObject
  | TytxArray;

export interface TytxObject {
  [key: string]: TytxValue;
}

export type TytxArray = TytxValue[];

/**
 * Interface for custom type handlers.
 */
export interface DataType<T = unknown> {
  /** Primary type code */
  readonly code: PrimaryTypeCode;
  /** Type name */
  readonly name: string;
  /** Parse string value to typed value */
  parse(value: string): T;
  /** Serialize typed value to string */
  serialize(value: T): string;
  /** Check if value is of this type */
  isType(value: unknown): value is T;
}

/**
 * Typed string with ::code suffix.
 */
export type TypedString = `${string}::${TypeCode}`;

/**
 * Result of parsing a typed string.
 */
export interface ParseResult<T = unknown> {
  value: T;
  code: PrimaryTypeCode;
  raw: string;
}

/**
 * XML element structure.
 */
export interface XmlElement {
  attrs: Record<string, TytxValue>;
  value: TytxValue | Record<string, XmlElement>;
}

/**
 * Options for JSON serialization.
 */
export interface JsonOptions {
  /** Pretty print with indentation */
  indent?: number;
  /** Use typed format (default: true) */
  typed?: boolean;
}

/**
 * Options for fetch operations.
 */
export interface FetchOptions extends RequestInit {
  /** Base URL for relative paths */
  baseUrl?: string;
}

/**
 * Validation constraints for field definitions (struct v2).
 */
export interface FieldValidate {
  min?: number;
  max?: number;
  length?: number;
  pattern?: string;
  enum?: string[];
  validation?: string;
  required?: boolean;
  default?: unknown;
}

/**
 * UI hints for field definitions (struct v2).
 */
export interface FieldUI {
  label?: string;
  placeholder?: string;
  hint?: string;
  readonly?: boolean | string;
  hidden?: boolean | string;
  format?: string;
  width?: number | string;
  rows?: number;
}

/**
 * Extended field definition (struct v2).
 * Allows specifying type, validation, and UI metadata separately.
 */
export interface FieldDef {
  type?: string;
  validate?: FieldValidate;
  ui?: FieldUI;
}

/**
 * Field value can be a simple type code string or extended object definition.
 */
export type FieldValue = string | FieldDef;

/**
 * Schema type for struct registration.
 *
 * Accepts JSON string (preferred) or object/array:
 * - string: JSON string '{"name": "T", "age": "L"}' or '["T", "L"]'
 *   Field order is preserved from the JSON string.
 * - FieldValue[]: list schema (legacy)
 * - Record<string, FieldValue>: dict schema (legacy)
 *
 * Type codes:
 * - "": passthrough (no conversion, JSON-native types)
 * - "T", "L", "N", etc.: TYTX type codes
 * - "@CODE": reference to another struct
 */
export type StructSchema = FieldValue[] | Record<string, FieldValue> | string;

/**
 * Get the type code from a field value.
 * For string fields, returns the string directly.
 * For object fields, returns the 'type' property or 'T' as default.
 */
export function getFieldType(field: FieldValue): string {
  if (typeof field === 'string') {
    return field;
  }
  return field.type ?? 'T';
}

/**
 * Get validation constraints from a field value.
 * Returns undefined for string fields.
 */
export function getFieldValidate(field: FieldValue): FieldValidate | undefined {
  if (typeof field === 'string') {
    return undefined;
  }
  return field.validate;
}

/**
 * Get UI hints from a field value.
 * Returns undefined for string fields.
 */
export function getFieldUI(field: FieldValue): FieldUI | undefined {
  if (typeof field === 'string') {
    return undefined;
  }
  return field.ui;
}

/**
 * Type guard for typed strings.
 */
export function isTypedString(value: unknown): value is TypedString {
  if (typeof value !== 'string') return false;
  const idx = value.lastIndexOf('::');
  return idx > 0 && idx < value.length - 2;
}

/**
 * Extract type code from typed string.
 */
export function extractTypeCode(value: TypedString): TypeCode {
  const idx = value.lastIndexOf('::');
  return value.slice(idx + 2) as TypeCode;
}

/**
 * Extract value part from typed string.
 */
export function extractValue(value: TypedString): string {
  const idx = value.lastIndexOf('::');
  return value.slice(0, idx);
}

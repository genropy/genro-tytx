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
  | 'JS';  // JSON

/**
 * Primary type codes (canonical forms).
 * DHZ = timezone-aware datetime (canonical)
 * DH = naive datetime (deprecated)
 */
export type PrimaryTypeCode = 'L' | 'R' | 'N' | 'B' | 'T' | 'D' | 'DHZ' | 'DH' | 'H' | 'JS';

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
 * Schema type for struct registration.
 * - string[]: positional types ['T', 'L', 'N'] or homogeneous ['N']
 * - Record<string, string>: keyed types {name: 'T', balance: 'N'}
 * - string: ordered types "x:R,y:R" (named → object) or "R,R" (anonymous → array)
 */
export type StructSchema = string[] | Record<string, string> | string;

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

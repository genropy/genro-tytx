/**
 * TYTX (Typed Text) - TypeScript implementation.
 *
 * A protocol for exchanging typed data over text-based formats
 * with full TypeScript type safety.
 *
 * @packageDocumentation
 *
 * @example
 * ```ts
 * import { TytxModel, fromJson, asTypedJson } from 'genro-tytx-ts';
 *
 * // Define a typed model
 * interface OrderData {
 *   price: number;
 *   date: Date;
 *   quantity: number;
 * }
 *
 * class Order extends TytxModel<OrderData> {
 *   price!: number;
 *   date!: Date;
 *   quantity!: number;
 * }
 *
 * // Parse TYTX JSON with full type inference
 * const order = Order.fromTytx('{"price":"99.99::N","date":"2025-01-15::D","quantity":"5::L"}');
 *
 * // Type-safe access
 * console.log(order.price);  // number
 * console.log(order.date);   // Date
 *
 * // Serialize back to TYTX JSON
 * const json = order.toTytx();
 *
 * // Fetch from API with types
 * const orders = await Order.fetchTytxArray('/api/orders');
 * ```
 */

// Types
export type {
  TypeCode,
  PrimaryTypeCode,
  TytxValue,
  TytxObject,
  TytxArray,
  DataType,
  TypedString,
  ParseResult,
  XmlElement,
  JsonOptions,
  FetchOptions,
} from './types.js';

export { isTypedString, extractTypeCode, extractValue } from './types.js';

// Registry
export {
  TypeRegistry,
  registry,
  IntType,
  FloatType,
  DecimalType,
  BoolType,
  StrType,
  DateType,
  DateTimeType,
  TimeType,
  JsonType,
} from './registry.js';

// JSON utilities
export { asTypedJson, asJson, fromJson, hydrateObject } from './json.js';

// MessagePack utilities
export { TYTX_EXT_TYPE, packb, unpackb } from './msgpack.js';

// Model
export { TytxModel } from './model.js';

// Version
export const VERSION = '0.2.0';

// Convenience re-exports from registry
import { registry } from './registry.js';

/**
 * Parse typed string to value.
 *
 * @example
 * ```ts
 * fromText("99.99::N")     // → 99.99
 * fromText("2025-01-15::D") // → Date
 * fromText("true::B")       // → true
 * ```
 */
export const fromText = registry.fromText.bind(registry);

/**
 * Serialize value to string.
 *
 * @example
 * ```ts
 * asText(99.99)      // → "99.99"
 * asText(new Date()) // → "2025-01-15"
 * ```
 */
export const asText = registry.asText.bind(registry);

/**
 * Serialize value to typed string with ::code suffix.
 *
 * @example
 * ```ts
 * asTypedText(99.99)      // → "99.99::R"
 * asTypedText(new Date()) // → "2025-01-15::D"
 * asTypedText(true)       // → "true::B"
 * ```
 */
export const asTypedText = registry.asTypedText.bind(registry);

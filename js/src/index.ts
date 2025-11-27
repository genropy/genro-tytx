/**
 * TYTX (Typed Text) - A protocol for exchanging typed data over text-based formats.
 *
 * TYTX solves the "stringly typed" problem of JSON and other text formats by
 * encoding type information directly into value strings using a concise syntax.
 *
 * @example
 * ```typescript
 * import { hydrate, serialize } from 'genro-tytx';
 *
 * // Hydrate TYTX values to JavaScript objects
 * const data = hydrate({ price: "100.50::D", date: "2025-01-15::d" });
 * // { price: Decimal("100.50"), date: Date("2025-01-15") }
 *
 * // Serialize JavaScript objects to TYTX values
 * const tytx = serialize({ price: new Decimal("100.50"), date: new Date("2025-01-15") });
 * // { price: "100.50::D", date: "2025-01-15::d" }
 * ```
 *
 * @packageDocumentation
 */

/**
 * TYTX version
 */
export const VERSION = "0.1.0";

/**
 * TYTX global marker suffix
 */
export const TYTX_MARKER = "::TYTX";

/**
 * MessagePack ExtType code for TYTX
 */
export const MSGPACK_EXT_CODE = 42;

// Core functions (to be implemented)
// export { hydrate } from './hydrate';
// export { serialize } from './serialize';
// export { registry } from './registry';
// export type { TypeHandler, TypeCode } from './types';

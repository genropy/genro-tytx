/**
 * MessagePack utilities for TYTX TypeScript implementation.
 *
 * @module msgpack
 */

import { asTypedJson, fromJson } from './json.js';

/**
 * TYTX ExtType code (reserved).
 */
export const TYTX_EXT_TYPE = 42;

/**
 * Check if @msgpack/msgpack is available.
 */
function getMsgpack(): typeof import('@msgpack/msgpack') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@msgpack/msgpack');
  } catch {
    throw new Error(
      '@msgpack/msgpack is required for MessagePack support. ' +
      'Install it with: npm install @msgpack/msgpack'
    );
  }
}

/**
 * Check if object contains types that need TYTX encoding.
 */
function hasTytxTypes(obj: unknown): boolean {
  if (obj instanceof Date) return true;
  if (Array.isArray(obj)) return obj.some(hasTytxTypes);
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj).some(hasTytxTypes);
  }
  if (typeof obj === 'number') return true;
  return false;
}

/**
 * Pack to MessagePack bytes with TYTX types preserved.
 *
 * @example
 * ```ts
 * const packed = packb({ price: 99.99, date: new Date() });
 * ```
 */
export function packb(obj: unknown): Uint8Array {
  const msgpack = getMsgpack();

  if (hasTytxTypes(obj)) {
    const tytxStr = asTypedJson(obj) + '::TYTX';
    const data = new TextEncoder().encode(tytxStr);
    const ext = new msgpack.ExtData(TYTX_EXT_TYPE, data);
    return msgpack.encode(ext);
  }

  return msgpack.encode(obj);
}

/**
 * Unpack MessagePack bytes with TYTX types restored.
 *
 * @example
 * ```ts
 * const data = unpackb(packed);
 * // data.date is a Date object
 * ```
 */
export function unpackb<T = unknown>(packed: Uint8Array | ArrayBuffer): T {
  const msgpack = getMsgpack();

  const codec = new msgpack.ExtensionCodec();
  codec.register({
    type: TYTX_EXT_TYPE,
    encode: () => new Uint8Array(0), // Not used for decoding
    decode: (data: Uint8Array) => {
      const tytxStr = new TextDecoder().decode(data);
      const jsonStr = tytxStr.endsWith('::TYTX')
        ? tytxStr.slice(0, -6)
        : tytxStr;
      return fromJson(jsonStr);
    },
  });

  const input = packed instanceof ArrayBuffer ? new Uint8Array(packed) : packed;
  return msgpack.decode(input, { extensionCodec: codec }) as T;
}

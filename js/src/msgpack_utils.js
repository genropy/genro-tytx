/**
 * MessagePack utilities for TYTX Protocol.
 *
 * TYTX uses MessagePack ExtType code 42 for typed payloads.
 * The content is a UTF-8 encoded JSON string with typed values.
 * No TYTX:: prefix needed - ExtType(42) itself is the marker.
 *
 * Usage:
 *     npm install @msgpack/msgpack
 *
 *     const { packb, unpackb } = require('genro-tytx/src/msgpack_utils');
 *
 *     const data = { price: 99.99, date: new Date('2025-01-15') };
 *
 *     // Pack with TYTX types preserved
 *     const packed = packb(data);
 *
 *     // Unpack with types restored
 *     const restored = unpackb(packed);
 *
 * Alternative usage with @msgpack/msgpack directly:
 *     const { encode, decode } = require('@msgpack/msgpack');
 *     const { tytxExtensionCodec } = require('genro-tytx/src/msgpack_utils');
 *
 *     const packed = encode(data, { extensionCodec: tytxExtensionCodec });
 *     const restored = decode(packed, { extensionCodec: tytxExtensionCodec });
 *
 * @module msgpack_utils
 */

const { as_typed_json, from_json } = require('./json_utils');

/**
 * TYTX ExtType code (reserved).
 * @constant {number}
 */
const TYTX_EXT_TYPE = 42;

/**
 * Check if @msgpack/msgpack is available.
 * @returns {{encode: Function, decode: Function, ExtensionCodec: Function}} msgpack module
 * @throws {Error} If @msgpack/msgpack is not installed.
 */
function _getMsgpack() {
    try {
        return require('@msgpack/msgpack');
    } catch (e) {
        throw new Error(
            '@msgpack/msgpack is required for MessagePack support. ' +
            'Install it with: npm install @msgpack/msgpack'
        );
    }
}

/**
 * Check if object contains types that need TYTX encoding.
 *
 * MessagePack natively handles: int, float, bool, str, bytes, null, array, map.
 * Only Date needs TYTX encoding (msgpack doesn't have native Date support).
 *
 * @param {*} obj - Object to check.
 * @returns {boolean} True if object contains Date.
 */
function _hasTytxTypes(obj) {
    if (obj instanceof Date) {
        return true;
    }
    if (Array.isArray(obj)) {
        return obj.some(_hasTytxTypes);
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.values(obj).some(_hasTytxTypes);
    }
    // Numbers, booleans, strings are msgpack-native - no TYTX needed
    return false;
}

/**
 * Create TYTX extension codec for @msgpack/msgpack.
 * @returns {Object} ExtensionCodec instance configured for TYTX.
 */
function _createExtensionCodec() {
    const msgpack = _getMsgpack();
    const codec = new msgpack.ExtensionCodec();

    // Register TYTX extension type
    codec.register({
        type: TYTX_EXT_TYPE,
        encode: (obj) => {
            // This is called by the custom encoder, not directly
            const jsonStr = as_typed_json(obj);
            return new TextEncoder().encode(jsonStr);
        },
        decode: (data) => {
            const jsonStr = new TextDecoder().decode(data);
            return from_json(jsonStr);
        }
    });

    return codec;
}

// Lazy-loaded extension codec
let _extensionCodec = null;

/**
 * Get or create the TYTX extension codec.
 * @returns {Object} ExtensionCodec instance.
 */
function getTytxExtensionCodec() {
    if (_extensionCodec === null) {
        _extensionCodec = _createExtensionCodec();
    }
    return _extensionCodec;
}

/**
 * Pack JavaScript object to MessagePack bytes with TYTX type support.
 *
 * Objects containing TYTX types (Date, numbers that need precision)
 * are preserved using ExtType(42, ...) with UTF-8 encoded TYTX JSON content.
 *
 * @param {*} obj - JavaScript object to pack.
 * @returns {Uint8Array} MessagePack bytes.
 * @throws {Error} If @msgpack/msgpack is not installed.
 *
 * @example
 * const data = { price: 99.99, date: new Date('2025-01-15') };
 * const packed = packb(data);
 * const restored = unpackb(packed);
 */
function packb(obj) {
    const msgpack = _getMsgpack();
    const codec = getTytxExtensionCodec();

    // Custom encoder that wraps TYTX types in ExtType
    const extensionCodec = new msgpack.ExtensionCodec();

    extensionCodec.register({
        type: TYTX_EXT_TYPE,
        encode: (input) => {
            const jsonStr = as_typed_json(input);
            return new TextEncoder().encode(jsonStr);
        },
        decode: codec.decode
    });

    // We need to intercept objects with TYTX types
    if (_hasTytxTypes(obj)) {
        // Encode as ExtType - no TYTX:: prefix needed, ExtType(42) is the marker
        const jsonStr = as_typed_json(obj);
        const data = new TextEncoder().encode(jsonStr);
        const ext = new msgpack.ExtData(TYTX_EXT_TYPE, data);
        return msgpack.encode(ext);
    }

    // Plain data without TYTX types
    return msgpack.encode(obj);
}

/**
 * Unpack MessagePack bytes to JavaScript object with TYTX type support.
 *
 * ExtType(42, ...) is decoded and hydrated to restore TYTX types.
 *
 * @param {Uint8Array|ArrayBuffer} packed - MessagePack bytes to unpack.
 * @returns {*} JavaScript object with TYTX types restored.
 * @throws {Error} If @msgpack/msgpack is not installed.
 *
 * @example
 * const restored = unpackb(packed);
 * // restored.date is a Date object
 */
function unpackb(packed) {
    const msgpack = _getMsgpack();
    const codec = getTytxExtensionCodec();
    return msgpack.decode(packed, { extensionCodec: codec });
}

/**
 * TYTX extension codec for direct use with @msgpack/msgpack.
 *
 * @example
 * const { encode, decode } = require('@msgpack/msgpack');
 * const { tytxExtensionCodec } = require('genro-tytx/src/msgpack_utils');
 *
 * // Note: You need to handle TYTX wrapping manually
 * const packed = encode(data, { extensionCodec: tytxExtensionCodec });
 * const restored = decode(packed, { extensionCodec: tytxExtensionCodec });
 */
const tytxExtensionCodec = {
    get codec() {
        return getTytxExtensionCodec();
    }
};

module.exports = {
    TYTX_EXT_TYPE,
    packb,
    unpackb,
    tytxExtensionCodec,
    // Internal exports for testing
    _hasTytxTypes,
    _getMsgpack
};

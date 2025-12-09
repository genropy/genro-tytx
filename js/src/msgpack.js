// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX MessagePack Encoding/Decoding.
 *
 * MessagePack serializes typed values as strings with type suffix (e.g., "100.50::N").
 * On decode, these strings are hydrated back to JavaScript types.
 */

import { walk, rawDecode } from './utils.js';
import { isString } from './decode.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Check for msgpack availability
let msgpack = null;
let HAS_MSGPACK = false;

try {
    msgpack = require('msgpack-lite');
    HAS_MSGPACK = true;
} catch {
    HAS_MSGPACK = false;
}

function _checkMsgpack() {
    if (!HAS_MSGPACK) {
        throw new Error(
            'msgpack-lite is required for MessagePack support. ' +
            'Install with: npm install msgpack-lite'
        );
    }
}

/**
 * Default encoder for msgpack - converts typed values to TYTX strings.
 * @param {any} obj
 * @returns {string}
 */
function _defaultEncoder(obj) {
    const { toTytx } = require('./encode.js');
    return toTytx(obj);
}

/**
 * Encode a JavaScript value to TYTX MessagePack bytes.
 *
 * @param {any} value - JavaScript object to encode
 * @returns {Uint8Array} MessagePack bytes with typed values as TYTX strings
 *
 * @example
 * toMsgpack({"price": createDecimal("100.50")})
 * // Uint8Array[...]  // MessagePack bytes
 */
function toMsgpack(value) {
    _checkMsgpack();

    const { getTypeEntry } = require('./registry.js');

    // Pre-process value to convert special types to TYTX strings
    function encodeValue(v) {
        if (v === null || v === undefined) {
            return v;
        }
        if (Array.isArray(v)) {
            return v.map(encodeValue);
        }
        if (typeof v === 'object' && !(v instanceof Date)) {
            // Check for Decimal
            const entry = getTypeEntry(v);
            if (entry !== null) {
                const [suffix, serializer] = entry;
                return `${serializer(v)}::${suffix}`;
            }
            // Regular object
            const result = {};
            for (const [k, val] of Object.entries(v)) {
                result[k] = encodeValue(val);
            }
            return result;
        }
        // Check for Date or other typed values
        const entry = getTypeEntry(v);
        if (entry !== null) {
            const [suffix, serializer, jsonNative] = entry;
            if (!jsonNative) {
                return `${serializer(v)}::${suffix}`;
            }
        }
        return v;
    }

    const encoded = encodeValue(value);
    return msgpack.encode(encoded);
}

/**
 * Decode TYTX MessagePack bytes to JavaScript objects.
 *
 * @param {Uint8Array} data - MessagePack bytes
 * @returns {any} JavaScript object with typed values hydrated
 *
 * @example
 * fromMsgpack(packedBytes)
 * // {"price": Decimal("100.50")}
 */
function fromMsgpack(data) {
    _checkMsgpack();
    const parsed = msgpack.decode(data);
    return walk(parsed, s => rawDecode(s)[1], isString);
}

export {
    toMsgpack,
    fromMsgpack,
    HAS_MSGPACK,
    _checkMsgpack,
    _defaultEncoder,
};

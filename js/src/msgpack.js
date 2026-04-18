// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX MessagePack Encoding/Decoding.
 *
 * Uses MessagePack extension types to carry TYTX type information directly in the protocol:
 * - Ext -1: datetime (native Timestamp, handled by @msgpack/msgpack)
 * - Ext  1: Decimal  (payload: UTF-8 string, e.g. "100.50")
 * - Ext  2: date     (payload: ISO "YYYY-MM-DD")
 * - Ext  3: time     (payload: ISO "HH:MM:SS.mmm")
 */

import { getDateType, createDecimal, isDecimal } from './registry.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Check for @msgpack/msgpack availability
let msgpack = null;
let HAS_MSGPACK = false;

try {
    msgpack = require('@msgpack/msgpack');
    HAS_MSGPACK = true;
} catch {
    HAS_MSGPACK = false;
}

function _checkMsgpack() {
    if (!HAS_MSGPACK) {
        throw new Error(
            '@msgpack/msgpack is required for MessagePack support. ' +
            'Install with: npm install @msgpack/msgpack'
        );
    }
}

// Build the ExtensionCodec once at module load (if msgpack is available).
// The encode/decode functions close over isDecimal/createDecimal/getDateType
// which read the current decimal library state at call time.
const _extensionCodec = _buildCodec();

function _buildCodec() {
    if (!HAS_MSGPACK) {
        return null;
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const codec = new msgpack.ExtensionCodec();

    // Override built-in Timestamp encoder (-1) to skip date-only and time-only
    // Date objects so they can be handled by ext 2 and ext 3 below.
    // DHZ datetimes fall through to the native Timestamp encoding.
    codec.register({
        type: -1,
        encode: (v) => {
            if (v instanceof Date) {
                const dt = getDateType(v);
                if (dt === 'D' || dt === 'H') {
                    return null;  // let custom encoders (2, 3) handle these
                }
            }
            return msgpack.encodeTimestampExtension(v);
        },
        decode: (data) => msgpack.decodeTimestampExtension(data),
    });

    // Ext 1: Decimal
    codec.register({
        type: 1,
        encode: (v) => {
            if (isDecimal(v)) {
                return enc.encode(v.toString());
            }
            return null;
        },
        decode: (data) => createDecimal(dec.decode(data)),
    });

    // Ext 2: date-only (midnight UTC)
    codec.register({
        type: 2,
        encode: (v) => {
            if (v instanceof Date && getDateType(v) === 'D') {
                const y = v.getUTCFullYear();
                const m = String(v.getUTCMonth() + 1).padStart(2, '0');
                const d = String(v.getUTCDate()).padStart(2, '0');
                return enc.encode(`${y}-${m}-${d}`);
            }
            return null;
        },
        decode: (data) => new Date(dec.decode(data) + 'T00:00:00.000Z'),
    });

    // Ext 3: time-only (epoch-based Date)
    codec.register({
        type: 3,
        encode: (v) => {
            if (v instanceof Date && getDateType(v) === 'H') {
                const h = String(v.getUTCHours()).padStart(2, '0');
                const m = String(v.getUTCMinutes()).padStart(2, '0');
                const s = String(v.getUTCSeconds()).padStart(2, '0');
                const ms = String(v.getUTCMilliseconds()).padStart(3, '0');
                return enc.encode(`${h}:${m}:${s}.${ms}`);
            }
            return null;
        },
        decode: (data) => {
            const str = dec.decode(data);
            // Accept "HH:MM:SS", "HH:MM:SS.mmm", or "HH:MM:SS.ffffff"
            const dotIdx = str.indexOf('.');
            const timePart = dotIdx >= 0 ? str.substring(0, dotIdx) : str;
            const fracStr = dotIdx >= 0 ? str.substring(dotIdx + 1) : '0';
            const [h, m, s] = timePart.split(':');
            // Truncate fractional part to 3 digits (milliseconds)
            const ms = Math.round(+fracStr.substring(0, 3));
            return new Date(Date.UTC(1970, 0, 1, +h, +m, +s, ms));
        },
    });

    return codec;
}

/**
 * Encode a JavaScript value to TYTX MessagePack bytes.
 *
 * @param {any} value - JavaScript object to encode
 * @returns {Uint8Array} MessagePack bytes with TYTX types as extension types
 *
 * @example
 * toMsgpack({"price": createDecimal("100.50")})
 * // Uint8Array[...]  // MessagePack bytes
 */
function toMsgpack(value) {
    _checkMsgpack();
    return msgpack.encode(value, { extensionCodec: _extensionCodec });
}

/**
 * Decode TYTX MessagePack bytes to JavaScript objects.
 *
 * @param {Uint8Array} data - MessagePack bytes
 * @returns {any} JavaScript object with TYTX extension types hydrated
 *
 * @example
 * fromMsgpack(packedBytes)
 * // {"price": Decimal("100.50")}
 */
function fromMsgpack(data) {
    _checkMsgpack();
    return msgpack.decode(data, { extensionCodec: _extensionCodec });
}

export {
    toMsgpack,
    fromMsgpack,
    HAS_MSGPACK,
    _checkMsgpack,
};

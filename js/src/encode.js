// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX Encoding - JavaScript objects to TYTX format.
 *
 * Supports multiple transports: json, xml, msgpack.
 */

import { rawEncode } from './utils.js';
import { getTypeEntry } from './registry.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Pre-process a value recursively, converting typed values to TYTX strings.
 * Returns [processedValue, hasSpecial].
 *
 * @param {any} value
 * @returns {[any, boolean]}
 */
function _preprocessValue(value) {
    // Check if value is a typed value that needs encoding
    const entry = getTypeEntry(value);
    if (entry !== null) {
        const [suffix, serializer, jsonNative] = entry;
        if (!jsonNative) {
            return [`${serializer(value)}::${suffix}`, true];
        }
        // jsonNative types (bool, int, float) are kept as-is
        return [value, false];
    }

    // Handle arrays
    if (Array.isArray(value)) {
        let hasSpecial = false;
        const result = value.map(item => {
            const [processed, special] = _preprocessValue(item);
            if (special) hasSpecial = true;
            return processed;
        });
        return [result, hasSpecial];
    }

    // Handle objects (but not null)
    if (value !== null && typeof value === 'object') {
        let hasSpecial = false;
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            const [processed, special] = _preprocessValue(v);
            if (special) hasSpecial = true;
            result[k] = processed;
        }
        return [result, hasSpecial];
    }

    // Primitive values (string, number, boolean, null)
    return [value, false];
}

/**
 * Encode a JavaScript value to TYTX JSON string (internal).
 *
 * @param {any} value - JavaScript object to encode
 * @param {boolean} forceSuffix - If true, add suffix for all types (int/bool/float)
 * @returns {string} JSON string. For dict/list with typed values: adds ::JS suffix.
 */
function _toJson(value, forceSuffix = false) {
    const [encoded, result] = rawEncode(value, forceSuffix);
    if (encoded) {
        return result;
    }

    const [processed, hasSpecial] = _preprocessValue(value);
    const jsonResult = JSON.stringify(processed);

    if (hasSpecial) {
        return `${jsonResult}::JS`;
    }
    return jsonResult;
}

/**
 * Encode a JavaScript value to TYTX MessagePack bytes (internal).
 * @param {any} value
 * @returns {Uint8Array}
 */
async function _toMsgpack(value) {
    const { toMsgpack } = await import('./msgpack.js');
    return toMsgpack(value);
}

/**
 * Encode a JavaScript value to raw JSON string (no TYTX suffix).
 * @param {any} value
 * @returns {string}
 */
function _toRawJson(value) {
    return JSON.stringify(value);
}

/**
 * Encode a JavaScript value to raw MessagePack bytes (no TYTX processing).
 * @param {any} value
 * @returns {Uint8Array}
 */
function _toRawMsgpack(value) {
    const msgpack = require('msgpack-lite');
    return msgpack.encode(value);
}

/**
 * Encode a JavaScript value to TYTX format.
 *
 * @param {any} value - JavaScript object to encode
 * @param {string|null} transport - Output format: "json", "xml", "msgpack", or null
 * @param {Object} options - Options object
 * @param {boolean} options.raw - If true, output raw format without TYTX type suffixes
 * @param {boolean} options.qs - If true, output as query string format (flat object or array only)
 * @param {boolean} options._forceSuffix - Internal: force suffix for all types
 * @returns {string|Uint8Array} Encoded data (string for json/xml, Uint8Array for msgpack)
 *
 * @example
 * toTytx({"price": createDecimal("100.50")})
 * // '{"price": "100.50::N"}::JS'
 *
 * toTytx({"price": 100.50}, null, { raw: true })
 * // '{"price": 100.5}'
 *
 * toTytx({"alfa": 33, "date": new Date(Date.UTC(2025, 11, 14))}, null, { qs: true })
 * // 'alfa=33::L&date=2025-12-14::D::QS'
 *
 * toTytx({"root": {"value": createDecimal("100")}}, "xml")
 * // '<?xml version="1.0" ?><root>100::N</root>'
 */
function toTytx(value, transport = null, { raw = false, qs = false, _forceSuffix = false } = {}) {
    if (qs) {
        const { toQs } = require('./qs.js');
        return `${toQs(value)}::QS`;
    }

    if (raw) {
        if (transport === null || transport === 'json') {
            return _toRawJson(value);
        } else if (transport === 'msgpack') {
            return _toRawMsgpack(value);
        } else if (transport === 'xml') {
            throw new Error('raw=true is not supported for XML transport');
        } else {
            throw new Error(`Unknown transport: ${transport}`);
        }
    }

    if (transport === null || transport === 'json') {
        const result = _toJson(value, _forceSuffix);
        if (transport === 'json') {
            return `"${result}"`;
        }
        return result;
    } else if (transport === 'xml') {
        // Lazy import to avoid circular dependency
        const { toXml } = require('./xml.js');
        const result = toXml(value);
        return `<?xml version="1.0" ?><tytx_root>${result}</tytx_root>`;
    } else if (transport === 'msgpack') {
        // Lazy import to avoid circular dependency
        const { toMsgpack } = require('./msgpack.js');
        return toMsgpack(value);
    } else {
        throw new Error(`Unknown transport: ${transport}`);
    }
}

export {
    toTytx,
    _toJson,
    _toMsgpack,
};

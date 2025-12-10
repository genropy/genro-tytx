// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX Decoding - TYTX format to JavaScript objects.
 *
 * Supports multiple transports: json, xml, msgpack.
 */

import { walk, rawDecode } from './utils.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const TYTX_MARKER = '::JS';

/**
 * Filter for string values.
 * @param {any} v
 * @returns {boolean}
 */
function isString(v) {
    return typeof v === 'string';
}

/**
 * Decode a TYTX JSON string to JavaScript objects (internal).
 *
 * @param {string} data - JSON string with ::JS suffix (struct) or ::T suffix (scalar)
 * @returns {any} JavaScript object with typed values hydrated
 */
function _fromJson(data) {
    // Try rawDecode first (scalar with type suffix)
    const [decoded, value] = rawDecode(data);
    if (decoded) {
        return value;
    }

    let jsonData = data;
    if (jsonData.endsWith('::JS')) {
        jsonData = jsonData.slice(0, -4);
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonData);
    } catch {
        return data;
    }

    return walk(parsed, _decodeItem, isString);
}

/**
 * Decode a single item with TYTX suffix.
 * @param {string} s
 * @returns {any}
 */
function _decodeItem(s) {
    if (!s.includes('::')) {
        return s;
    }
    return rawDecode(s)[1];
}

/**
 * Decode a TYTX XML string to JavaScript objects (internal).
 * @param {string} data
 * @returns {any}
 */
function _fromXml(data) {
    const { fromXml } = require('./xml.js');
    const result = fromXml(data);
    // If result is a string with TYTX suffix, hydrate it via JSON decoder
    if (typeof result === 'string') {
        return fromTytx(result);
    }
    return result;
}

/**
 * Decode TYTX MessagePack bytes to JavaScript objects (internal).
 * @param {Uint8Array} data
 * @returns {any}
 */
function _fromMsgpack(data) {
    const { fromMsgpack } = require('./msgpack.js');
    return fromMsgpack(data);
}

/**
 * Decode TYTX format to JavaScript objects.
 *
 * @param {string|Uint8Array|null} data - Encoded data (string for json/xml, Uint8Array for msgpack), or null
 * @param {string|null} transport - Input format: "json", "xml", "msgpack", or null
 * @returns {any} JavaScript object with typed values hydrated, or null if data is null
 *
 * @example
 * fromTytx('{"price": "100.50::N"}::JS')
 * // {"price": Decimal("100.50")}
 *
 * fromTytx('<root>100::N</root>', "xml")
 * // {"root": {"attrs": {}, "value": Decimal("100")}}
 */
function fromTytx(data, transport = null) {
    if (data === null) {
        return null;
    }

    if (transport === null || transport === 'json') {
        let jsonData = data;
        if (transport === 'json') {
            jsonData = data.slice(1, -1);  // Remove surrounding quotes
        }
        return _fromJson(jsonData);
    } else if (transport === 'xml') {
        return _fromXml(data);
    } else if (transport === 'msgpack') {
        return _fromMsgpack(data);
    } else {
        throw new Error(`Unknown transport: ${transport}`);
    }
}

export {
    fromTytx,
    TYTX_MARKER,
    isString,
    _fromJson,
    _fromXml,
    _fromMsgpack,
    _decodeItem,
};

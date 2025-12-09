// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX Base - Typed Text Protocol for Scalar Types
 *
 * Minimal implementation supporting:
 * - Scalar types: Decimal, date, datetime, time, bool, int
 * - Encoders/Decoders: JSON, XML, MessagePack
 *
 * Usage:
 *     import { toTytx, fromTytx, createDecimal } from 'genro-tytx';
 *
 *     // Encode
 *     const data = {"price": createDecimal("100.50"), "date": new Date(Date.UTC(2025, 0, 15))};
 *     const jsonStr = toTytx(data);
 *     // '{"price": "100.50::N", "date": "2025-01-15::D"}::JS'
 *
 *     // Decode
 *     const result = fromTytx(jsonStr);
 *     // {"price": Decimal("100.50"), "date": Date}
 */

import {
    SUFFIX_TO_TYPE,
    decimalLibrary,
    createDecimal,
    isDecimal,
    setDecimalLibrary,
    getDecimalLibrary,
    getDateType,
    getTypeEntry,
} from './registry.js';

import { toTytx } from './encode.js';
import { fromTytx, TYTX_MARKER, TYTX_PREFIX } from './decode.js';
import { toXml, fromXml, fromXmlnode } from './xml.js';
import { toMsgpack, fromMsgpack, HAS_MSGPACK } from './msgpack.js';
import { datetimeEquivalent, tytxEquivalent, walk, rawEncode, rawDecode } from './utils.js';

const __version__ = '0.7.0';

export {
    // Unified API
    toTytx,
    fromTytx,
    // XML
    toXml,
    fromXml,
    fromXmlnode,
    // MessagePack
    toMsgpack,
    fromMsgpack,
    HAS_MSGPACK,
    // Registry
    SUFFIX_TO_TYPE,
    decimalLibrary,
    createDecimal,
    isDecimal,
    setDecimalLibrary,
    getDecimalLibrary,
    getDateType,
    getTypeEntry,
    // Utilities
    datetimeEquivalent,
    tytxEquivalent,
    walk,
    rawEncode,
    rawDecode,
    // Constants
    TYTX_MARKER,
    TYTX_PREFIX,
    // Version
    __version__,
};

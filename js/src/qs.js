// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX Query String Encoding/Decoding.
 *
 * QS format is a flat key=value structure separated by &:
 *   alfa=33::L&date=2025-12-14::D::QS → {"alfa": 33, "date": Date(2025, 12, 14)}
 *   alfa&beta&gamma::QS → ["alfa", "beta", "gamma"]
 *
 * Rules:
 * - All items with = → object
 * - All items without = → array
 * - Mixed → error (use ::JS embedded for complex structures)
 */

import { rawEncode } from './utils.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Encode a JavaScript object or array to TYTX QS string.
 *
 * @param {Object|Array} value - Object with scalar values or array of strings
 * @returns {string} QS string with typed values marked (without ::QS suffix)
 *
 * @example
 * toQs({"alfa": 33, "date": new Date(Date.UTC(2025, 11, 14))})
 * // 'alfa=33::L&date=2025-12-14::D'
 *
 * toQs(["alfa", "beta", "gamma"])
 * // 'alfa&beta&gamma'
 */
function toQs(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item)).join('&');
    }

    if (value !== null && typeof value === 'object') {
        const parts = [];
        for (const [k, v] of Object.entries(value)) {
            const [encoded, result] = rawEncode(v, true);  // force_suffix=true
            if (encoded) {
                parts.push(`${k}=${result}`);
            } else {
                parts.push(`${k}=${v}`);
            }
        }
        return parts.join('&');
    }

    throw new TypeError(`toQs expects object or array, got ${typeof value}`);
}

/**
 * Decode a TYTX QS string to JavaScript object or array.
 *
 * @param {string} data - QS string (without ::QS suffix)
 * @returns {Object|Array} Object if all items have =, array if none have =
 * @throws {Error} If mixed (some with =, some without)
 *
 * @example
 * fromQs('alfa=33::L&date=2025-12-14::D')
 * // {"alfa": 33, "date": Date(2025, 11, 14)}
 *
 * fromQs('alfa&beta&gamma')
 * // ["alfa", "beta", "gamma"]
 */
function fromQs(data) {
    // Lazy import to avoid circular dependency
    const { fromTytx } = require('./decode.js');

    if (!data) {
        return [];
    }

    const parts = data.split('&');
    const hasEq = parts.map(p => p.includes('='));

    const allWithEq = hasEq.every(Boolean);
    const noneWithEq = !hasEq.some(Boolean);

    if (!allWithEq && !noneWithEq) {
        throw new Error("QS format error: mixed items with and without '='");
    }

    if (noneWithEq) {
        // Array mode: decode each item
        return parts.map(p => fromTytx(p));
    }

    // Object mode: split key=value and decode values
    const result = {};
    for (const part of parts) {
        const eqIndex = part.indexOf('=');
        const key = part.slice(0, eqIndex);
        const value = part.slice(eqIndex + 1);
        result[key] = fromTytx(value);
    }
    return result;
}

export { toQs, fromQs };

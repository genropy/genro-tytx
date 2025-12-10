/**
 * Full interoperability test suite (JS side).
 * Shared dataset with Python, focused on JSON encode/decode.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const { buildDataset, hasDecimal } = require('./dataset_builder');
const { toTypedText, fromText, toTypedJson, fromJson, isDecimalInstance } = require('../../js/src/index.js');

const DATASET = buildDataset();

function measure(fn, ...args) {
    const start = performance.now();
    const result = fn(...args);
    return { result, duration: (performance.now() - start) / 1000 };
}

function sizeOf(data) {
    if (typeof data === 'string') return Buffer.byteLength(data);
    return 0;
}

function eq(a, b) {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (hasDecimal && isDecimalInstance(a) && isDecimalInstance(b)) {
        return a.eq ? a.eq(b) : a.toString() === b.toString();
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((v, i) => eq(v, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object' && a && b) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every((k) => eq(a[k], b[k]));
    }
    return false;
}

for (const payload of DATASET.payloads) {
    test(`json roundtrip (text) payload type=${typeof payload}`, () => {
        const { result: encoded, duration: tEnc } = measure(toTypedText, payload);
        const { result: decoded, duration: tDec } = measure(fromText, encoded);
        assert.ok(eq(payload, decoded), 'Roundtrip should be equivalent');
        console.error(`[json] size=${sizeOf(encoded)}B enc=${tEnc.toFixed(6)}s dec=${tDec.toFixed(6)}s`);
    });

    test(`json roundtrip (prefix) payload type=${typeof payload}`, () => {
        const { result: encoded, duration: tEnc } = measure(toTypedJson, payload);
        const { result: decoded, duration: tDec } = measure(fromJson, encoded);
        assert.ok(eq(payload, decoded), 'Roundtrip with prefix should be equivalent');
        console.error(`[json+prefix] size=${sizeOf(encoded)}B enc=${tEnc.toFixed(6)}s dec=${tDec.toFixed(6)}s`);
    });
}

test('performance snapshot heavy recordset', () => {
    const payload = { records: DATASET.recordset };
    const { result: encoded, duration: tEnc } = measure(toTypedText, payload);
    const { result: decoded, duration: tDec } = measure(fromText, encoded);
    assert.ok(eq(payload, decoded));
    console.error(`[heavy/json] size=${sizeOf(encoded)}B enc=${tEnc.toFixed(6)}s dec=${tDec.toFixed(6)}s`);
});

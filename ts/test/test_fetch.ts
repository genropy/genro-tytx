/**
 * TYTX Fetch Tests (TypeScript)
 *
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    createDate,
    createTime,
    createDateTime,
    encodeQueryString,
    decodeQueryString,
} from '../src/fetch';
import { DecimalLib } from '../src/registry';

describe('TYTX Fetch TypeScript - Date Helpers', () => {
    it('should create date-only (midnight UTC)', () => {
        const d = createDate(2025, 1, 15);
        assert.equal(d.getUTCFullYear(), 2025);
        assert.equal(d.getUTCMonth(), 0); // January
        assert.equal(d.getUTCDate(), 15);
        assert.equal(d.getUTCHours(), 0);
        assert.equal(d.getUTCMinutes(), 0);
        assert.equal(d.getUTCSeconds(), 0);
    });

    it('should create time-only (epoch date)', () => {
        const t = createTime(10, 30, 45);
        assert.equal(t.getUTCFullYear(), 1970);
        assert.equal(t.getUTCMonth(), 0);
        assert.equal(t.getUTCDate(), 1);
        assert.equal(t.getUTCHours(), 10);
        assert.equal(t.getUTCMinutes(), 30);
        assert.equal(t.getUTCSeconds(), 45);
    });

    it('should create time with milliseconds', () => {
        const t = createTime(10, 30, 0, 500);
        assert.equal(t.getUTCMilliseconds(), 500);
    });

    it('should create full datetime', () => {
        const dt = createDateTime(2025, 1, 15, 10, 30, 45);
        assert.equal(dt.getUTCFullYear(), 2025);
        assert.equal(dt.getUTCMonth(), 0);
        assert.equal(dt.getUTCDate(), 15);
        assert.equal(dt.getUTCHours(), 10);
        assert.equal(dt.getUTCMinutes(), 30);
        assert.equal(dt.getUTCSeconds(), 45);
    });
});

describe('TYTX Fetch TypeScript - Query String Encoding', () => {
    it('should encode date', () => {
        const result = encodeQueryString({ date: createDate(2025, 1, 15) });
        assert.ok(result.includes('date='));
        assert.ok(result.includes('2025-01-15'));
        assert.ok(result.includes('%3A%3AD')); // URL-encoded ::D
    });

    it('should encode time', () => {
        const result = encodeQueryString({ t: createTime(10, 30, 0) });
        assert.ok(result.includes('t='));
        assert.ok(result.includes('10%3A30%3A00')); // URL-encoded 10:30:00
        assert.ok(result.includes('%3A%3AH')); // URL-encoded ::H
    });

    it('should encode decimal', () => {
        if (!DecimalLib) {
            console.log('Skipping - no decimal library');
            return;
        }
        const result = encodeQueryString({ price: new DecimalLib('100.50') });
        assert.ok(result.includes('price='));
        assert.ok(result.includes('100.5'));
        assert.ok(result.includes('%3A%3AN')); // URL-encoded ::N
    });

    it('should encode mixed values', () => {
        const result = encodeQueryString({
            date: createDate(2025, 1, 15),
            limit: 10,
            name: 'test',
        });
        assert.ok(result.includes('date='));
        assert.ok(result.includes('limit=10'));
        assert.ok(result.includes('name=test'));
    });

    it('should skip null and undefined', () => {
        const result = encodeQueryString({ a: 1, b: null, c: undefined, d: 2 });
        assert.ok(result.includes('a=1'));
        assert.ok(result.includes('d=2'));
        assert.ok(!result.includes('b='));
        assert.ok(!result.includes('c='));
    });

    it('should handle empty object', () => {
        const result = encodeQueryString({});
        assert.equal(result, '');
    });
});

describe('TYTX Fetch TypeScript - Query String Decoding', () => {
    it('should decode date', () => {
        const result = decodeQueryString('date=2025-01-15::D');
        const date = result.date as Date;
        assert.ok(date instanceof Date);
        assert.equal(date.getUTCFullYear(), 2025);
        assert.equal(date.getUTCMonth(), 0);
        assert.equal(date.getUTCDate(), 15);
    });

    it('should decode time', () => {
        const result = decodeQueryString('t=10:30:00::H');
        const t = result.t as Date;
        assert.ok(t instanceof Date);
        assert.equal(t.getUTCHours(), 10);
        assert.equal(t.getUTCMinutes(), 30);
    });

    it('should decode decimal', () => {
        const result = decodeQueryString('price=100.50::N');
        if (DecimalLib) {
            assert.equal(Number((result.price as { toString(): string }).toString()), 100.50);
        } else {
            assert.equal(result.price, 100.50);
        }
    });

    it('should keep plain values as strings', () => {
        const result = decodeQueryString('limit=10&name=test');
        assert.equal(result.limit, '10');
        assert.equal(result.name, 'test');
    });

    it('should decode mixed values', () => {
        const result = decodeQueryString('date=2025-01-15::D&limit=10');
        assert.ok(result.date instanceof Date);
        assert.equal(result.limit, '10');
    });

    it('should handle empty string', () => {
        const result = decodeQueryString('');
        assert.deepEqual(result, {});
    });

    it('should roundtrip date', () => {
        const original = { date: createDate(2025, 1, 15) };
        const encoded = encodeQueryString(original);
        const decoded = decodeQueryString(decodeURIComponent(encoded));
        const date = decoded.date as Date;
        assert.equal(date.getUTCFullYear(), 2025);
        assert.equal(date.getUTCMonth(), 0);
        assert.equal(date.getUTCDate(), 15);
    });
});

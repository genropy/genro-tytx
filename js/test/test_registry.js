// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Tests for custom type registration hooks (registerType / registerClass).
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';

import { toTytx, fromTytx } from '../src/index.js';
import { registerType, registerClass, _resetCustomTypes } from '../src/registry.js';

// A minimal custom type local to the test (no external dependency).
class Point {
    constructor(x, y) { this.x = x; this.y = y; }
    equals(o) { return o instanceof Point && o.x === this.x && o.y === this.y; }
}

describe('registerType', () => {
    afterEach(() => _resetCustomTypes());

    test('scalar roundtrip', () => {
        registerType(Point, 'PT', p => `${p.x},${p.y}`,
            s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });
        const encoded = toTytx(new Point(3, 4));
        assert.ok(encoded.endsWith('::PT'));
        assert.ok(fromTytx(encoded).equals(new Point(3, 4)));
    });

    test('inside structure roundtrip', () => {
        registerType(Point, 'PT', p => `${p.x},${p.y}`,
            s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });
        const encoded = toTytx([1, new Point(5, 6), 'k']);
        assert.ok(encoded.includes('::PT'));
        assert.ok(encoded.endsWith('::JS'));
        const decoded = fromTytx(encoded);
        assert.strictEqual(decoded[0], 1);
        assert.ok(decoded[1].equals(new Point(5, 6)));
        assert.strictEqual(decoded[2], 'k');
    });

    test('inside object roundtrip', () => {
        registerType(Point, 'PT', p => `${p.x},${p.y}`,
            s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });
        const encoded = toTytx({ origin: new Point(0, 0), name: 'test' });
        const decoded = fromTytx(encoded);
        assert.ok(decoded.origin.equals(new Point(0, 0)));
        assert.strictEqual(decoded.name, 'test');
    });

    test('unregistered type is not hydrated', () => {
        // Without registration a Point is not a known TYTX type; it round-trips
        // through JSON as a plain object, not back into a Point.
        const decoded = fromTytx(toTytx({ p: { x: 1, y: 2 } }));
        assert.ok(!(decoded.p instanceof Point));
    });
});

describe('registerClass', () => {
    afterEach(() => _resetCustomTypes());

    class Vec {
        static tytxSuffix = 'VC';
        constructor(a, b) { this.a = a; this.b = b; }
        toTytx() { return `${this.a}|${this.b}`; }
        static fromTytx(s) { const [a, b] = s.split('|').map(Number); return new Vec(a, b); }
        equals(o) { return o instanceof Vec && o.a === this.a && o.b === this.b; }
    }

    test('registers from class hooks and round-trips', () => {
        registerClass(Vec);
        const encoded = toTytx([1, new Vec(3, 4), 'k']);
        assert.ok(encoded.includes('::VC'));
        const decoded = fromTytx(encoded);
        assert.ok(decoded[1].equals(new Vec(3, 4)));
    });

    test('fromTytx is a static factory (one string arg)', () => {
        registerClass(Vec);
        const rebuilt = fromTytx('7|8::VC');
        assert.ok(rebuilt instanceof Vec);
        assert.strictEqual(rebuilt.a, 7);
        assert.strictEqual(rebuilt.b, 8);
    });

    test('missing tytxSuffix throws', () => {
        class Broken {
            toTytx() { return ''; }
            static fromTytx(s) { return new Broken(); }
        }
        assert.throws(() => registerClass(Broken), /tytxSuffix/);
    });
});

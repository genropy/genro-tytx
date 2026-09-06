// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Tests for custom type registration hooks (registerType / registerClass).
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';

import { toTytx, fromTytx } from '../src/index.js';
import {
    registerType,
    registerClass,
    _resetCustomTypes,
    SUFFIX_TO_TYPE,
    SUFFIX_PATTERN,
    createDecimal,
} from '../src/registry.js';

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

    test('re-registration replaces both hooks coherently', () => {
        registerType(Point, 'PT', p => `${p.x},${p.y}`,
            s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });
        registerType(Point, 'PT', p => `${p.x};${p.y}`,
            s => { const [x, y] = s.split(';').map(Number); return new Point(x, y); });
        const encoded = toTytx(new Point(1, 2));
        assert.strictEqual(encoded, '1;2::PT');
        assert.ok(fromTytx(encoded).equals(new Point(1, 2)));
    });

    test('suffix collision with a different type throws', () => {
        // 'N' is the builtin Decimal suffix
        assert.throws(
            () => registerType(Point, 'N', p => '', () => null),
            /already registered/,
        );
        registerType(Point, 'PT', p => `${p.x},${p.y}`, () => null);
        class Other {}
        assert.throws(
            () => registerType(Other, 'PT', () => '', () => null),
            /already registered/,
        );
    });

    test('subclass is not matched (exact constructor)', () => {
        registerType(Point, 'PT', p => `${p.x},${p.y}`,
            s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });
        class Point3 extends Point {}
        const encoded = toTytx({ p: new Point3(1, 2) });
        assert.ok(!encoded.includes('::PT'));
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

    test('missing toTytx throws at registration', () => {
        class Broken {
            static tytxSuffix = 'BK';
            static fromTytx(s) { return new Broken(); }
        }
        assert.throws(() => registerClass(Broken), /toTytx/);
    });

    test('missing fromTytx throws at registration', () => {
        class Broken {
            static tytxSuffix = 'BK';
            toTytx() { return ''; }
        }
        assert.throws(() => registerClass(Broken), /fromTytx/);
    });
});

describe('msgpack custom types (ext code 4)', () => {
    afterEach(() => _resetCustomTypes());

    const registerPoint = () => registerType(Point, 'PT', p => `${p.x},${p.y}`,
        s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });

    test('roundtrip scalar and nested', () => {
        registerPoint();
        const scalar = fromTytx(toTytx(new Point(3, 4), 'msgpack'), 'msgpack');
        assert.ok(scalar.equals(new Point(3, 4)));

        const value = { origin: new Point(0, 0), path: [new Point(1, 2), 'k', 5] };
        const decoded = fromTytx(toTytx(value, 'msgpack'), 'msgpack');
        assert.ok(decoded.origin.equals(new Point(0, 0)));
        assert.ok(decoded.path[0].equals(new Point(1, 2)));
        assert.strictEqual(decoded.path[1], 'k');
        assert.strictEqual(decoded.path[2], 5);
    });

    test('unknown suffix degrades to "<payload>::<suffix>" string', () => {
        registerPoint();
        const packed = toTytx({ p: new Point(3, 4) }, 'msgpack');
        delete SUFFIX_TO_TYPE.PT;  // simulate a receiver without the registration
        const decoded = fromTytx(packed, 'msgpack');
        assert.deepStrictEqual(decoded, { p: '3,4::PT' });
    });

    test('payload containing colons splits at the first ":" only', () => {
        class Clockish {
            constructor(text) { this.text = text; }
        }
        registerType(Clockish, 'CK', c => c.text, s => new Clockish(s));
        const decoded = fromTytx(toTytx({ t: new Clockish('12:30:45') }, 'msgpack'), 'msgpack');
        assert.strictEqual(decoded.t.text, '12:30:45');
    });

    test('builtin ext types keep working alongside code 4', () => {
        registerPoint();
        const value = { price: createDecimal('100.50'), p: new Point(1, 2) };
        const decoded = fromTytx(toTytx(value, 'msgpack'), 'msgpack');
        assert.strictEqual(decoded.price.toString(), '100.5');
        assert.ok(decoded.p.equals(new Point(1, 2)));
    });
});

// A container type owning its wire format, standing in for Bag ("X").
class Branch {
    static tytxSuffix = 'XB';
    constructor(items = {}) { this.items = { ...items }; }
    toTytx() { return Object.entries(this.items).map(([k, v]) => `${k}=${v}`).join(','); }
    static fromTytx(s) {
        // `this` is the class the code was registered for, so a subclass
        // inheriting this factory rebuilds an instance of itself.
        const items = s ? Object.fromEntries(s.split(',').map(p => p.split('='))) : {};
        return new this(items);
    }
    equals(o) { return o.constructor === this.constructor
        && JSON.stringify(o.items) === JSON.stringify(this.items); }
}

// A subclass with its own code, standing in for SourceBag ("XS").
class SourceBranch extends Branch {
    static tytxSuffix = 'XSB';
}

describe('registered subclass protocol', () => {
    afterEach(() => _resetCustomTypes());

    const registerBoth = () => { registerClass(Branch); registerClass(SourceBranch); };

    test('subclass under the parent code is refused', () => {
        registerClass(Branch);
        class Clone extends Branch { static tytxSuffix = 'XB'; }
        assert.throws(() => registerClass(Clone), /already registered/);
    });

    test('unregistered subclass is walked as a plain object, not encoded', () => {
        // Inheriting the hooks is not enough: without its own registration the
        // encoder sees an ordinary object and never emits the parent code.
        registerClass(Branch);
        const encoded = toTytx({ source: new SourceBranch({ a: '1' }) });
        assert.ok(!encoded.includes('::XB'));
        assert.deepStrictEqual(fromTytx(encoded), { source: { items: { a: '1' } } });
    });

    test('each class emits its own code', () => {
        registerBoth();
        const encoded = toTytx({ data: new Branch({ a: '1' }), source: new SourceBranch({ b: '2' }) });
        assert.ok(encoded.includes('"a=1::XB"'));
        assert.ok(encoded.includes('"b=2::XSB"'));
    });

    for (const transport of [null, 'json', 'msgpack']) {
        test(`identity survives object and array (transport=${transport})`, () => {
            registerBoth();
            const value = {
                data: new Branch({ a: '1' }),
                source: new SourceBranch({ b: '2' }),
                mixed: [new Branch(), new SourceBranch(), 'k'],
            };
            const decoded = fromTytx(toTytx(value, transport), transport);
            assert.ok(decoded.data.equals(value.data));
            assert.ok(decoded.source.equals(value.source));
            assert.strictEqual(decoded.data.constructor, Branch);
            assert.strictEqual(decoded.source.constructor, SourceBranch);
            assert.deepStrictEqual(decoded.mixed.map(v => v.constructor), [Branch, SourceBranch, String]);
        });
    }

    test('identity survives xml', () => {
        registerBoth();
        const value = { root: { value: { data: new Branch({ a: '1' }), source: new SourceBranch() } } };
        const decoded = fromTytx(toTytx(value, 'xml'), 'xml');
        const inner = decoded.root.value;
        assert.strictEqual(inner.data.constructor, Branch);
        assert.ok(inner.data.equals(new Branch({ a: '1' })));
        assert.strictEqual(inner.source.constructor, SourceBranch);
    });

    test('inherited static fromTytx must build the subclass', () => {
        // registerClass stores `s => cls.fromTytx(s)`: a factory hardcoding
        // `new Parent()` would rebuild the wrong class under the child code.
        registerBoth();
        assert.strictEqual(SourceBranch.fromTytx('').constructor, SourceBranch);
        assert.strictEqual(fromTytx('::XSB').constructor, SourceBranch);
    });

    test('empty marker hydrates through the public API', () => {
        registerBoth();
        assert.ok(fromTytx('::XB').equals(new Branch()));
        const decoded = fromTytx(toTytx({ rows: [['', 'n', null, '::XSB', {}]] }));
        assert.strictEqual(decoded.rows[0][3].constructor, SourceBranch);
    });

    test('unknown marker is returned untouched', () => {
        registerBoth();
        assert.strictEqual(fromTytx('::ZZ'), '::ZZ');
        assert.deepStrictEqual(fromTytx('{"v": "::ZZ"}::JS'), { v: '::ZZ' });
        assert.deepStrictEqual(fromTytx(toTytx({ v: '::ZZ' }, 'msgpack'), 'msgpack'), { v: '::ZZ' });
    });

    test('msgpack does not rescan strings', () => {
        registerBoth();
        assert.deepStrictEqual(fromTytx(toTytx({ v: '::XB' }, 'msgpack'), 'msgpack'), { v: '::XB' });
        assert.strictEqual(fromTytx('{"v": "::XB"}::JS').v.constructor, Branch);
    });
});

describe('suffix grammar', () => {
    afterEach(() => _resetCustomTypes());

    test('uppercase ASCII letters of any length are accepted', () => {
        for (const suffix of ['X', 'XS', 'BAG', 'SOURCE']) {
            assert.ok(SUFFIX_PATTERN.test(suffix));
            registerType(Point, suffix, () => '', () => null);
            assert.strictEqual(SUFFIX_TO_TYPE[suffix][0], Point);
            _resetCustomTypes();
        }
    });

    test('anything else is refused whole and leaves no trace', () => {
        // A trailing newline must not slip through the end anchor.
        for (const suffix of ['', 'x', 'Xs', 'X:S', 'X::S', 'X1', 'X S', '::X', 'ZZ\n', '\nZZ', 'ZZ\r\n', null, 7]) {
            assert.throws(() => registerType(Point, suffix, () => '', () => null), /invalid/);
            assert.ok(!(suffix in SUFFIX_TO_TYPE));
            assert.ok(!toTytx({ p: new Point(1, 2) }).includes('::'));
        }
    });

    for (const suffix of ['SOURCE', 'SOURCEBRANCH']) {
        for (const transport of [null, 'json', 'xml', 'msgpack']) {
            test(`long code ${suffix} round-trips (transport=${transport})`, () => {
                registerType(Point, suffix, p => `${p.x},${p.y}`,
                    s => { const [x, y] = s.split(',').map(Number); return new Point(x, y); });
                const value = { root: { value: [new Point(1, 2), 'k'] } };
                const encoded = toTytx(value, transport);
                if (transport !== 'msgpack') {
                    assert.ok(encoded.includes(`::${suffix}`));
                }
                const inner = fromTytx(encoded, transport).root.value;
                assert.ok(inner[0].equals(new Point(1, 2)));
                assert.strictEqual(inner[1], 'k');
                _resetCustomTypes();
            });
        }
    }

    test('registerClass validates too', () => {
        class Bad {
            static tytxSuffix = 'bad';
            toTytx() { return ''; }
            static fromTytx() { return new Bad(); }
        }
        assert.throws(() => registerClass(Bad), /invalid/);
    });
});

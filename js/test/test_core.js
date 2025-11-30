/**
 * TYTX Core Tests
 *
 * Tests for the JavaScript implementation of TYTX protocol.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    from_text,
    as_text,
    as_typed_text,
    as_json,
    as_typed_json,
    from_json,
    as_xml,
    as_typed_xml,
    from_xml,
    registry
} = require('../src/index');

// =============================================================================
// Text API Tests
// =============================================================================

describe('from_text', () => {
    test('parses integer', () => {
        assert.strictEqual(from_text('42::L'), 42);
    });

    test('parses float', () => {
        assert.strictEqual(from_text('3.14::R'), 3.14);
    });

    test('parses decimal', () => {
        const result = from_text('99.99::N');
        // Result is either Big object (if big.js installed) or number
        assert.strictEqual(Number(result), 99.99);
    });

    test('parses boolean true', () => {
        assert.strictEqual(from_text('true::B'), true);
    });

    test('parses boolean false', () => {
        assert.strictEqual(from_text('false::B'), false);
    });

    test('parses date', () => {
        const result = from_text('2024-01-15::D');
        assert.ok(result instanceof Date);
        assert.strictEqual(result.getFullYear(), 2024);
        assert.strictEqual(result.getMonth(), 0); // January
        assert.strictEqual(result.getDate(), 15);
    });

    test('parses datetime', () => {
        const result = from_text('2024-01-15T10:30:00.000Z::DH');
        assert.ok(result instanceof Date);
        assert.strictEqual(result.getUTCFullYear(), 2024);
        assert.strictEqual(result.getUTCMonth(), 0);
        assert.strictEqual(result.getUTCDate(), 15);
    });

    test('parses time', () => {
        const result = from_text('10:30:00::H');
        assert.strictEqual(result, '10:30:00');
    });

    test('parses json', () => {
        const result = from_text('{"x":1}::JS');
        assert.deepStrictEqual(result, { x: 1 });
    });

    test('returns plain string if no type', () => {
        assert.strictEqual(from_text('hello'), 'hello');
    });

    test('returns string if unknown type', () => {
        assert.strictEqual(from_text('foo::UNKNOWN'), 'foo::UNKNOWN');
    });

    test('with explicit type_code', () => {
        assert.strictEqual(from_text('42', 'L'), 42);
    });

    test('aliases work', () => {
        assert.strictEqual(from_text('42::INTEGER'), 42);
        assert.strictEqual(from_text('42::I'), 42);  // I is now alias for L
        assert.strictEqual(from_text('42::int'), 42);
        assert.strictEqual(from_text('true::BOOLEAN'), true);
    });
});

describe('as_text', () => {
    test('serializes integer', () => {
        assert.strictEqual(as_text(42), '42');
    });

    test('serializes float', () => {
        assert.strictEqual(as_text(3.14), '3.14');
    });

    test('serializes boolean', () => {
        assert.strictEqual(as_text(true), 'true');
        assert.strictEqual(as_text(false), 'false');
    });

    test('serializes date', () => {
        const d = new Date(2024, 0, 15); // Jan 15, 2024
        assert.strictEqual(as_text(d), '2024-01-15');
    });

    test('returns string as-is', () => {
        assert.strictEqual(as_text('hello'), 'hello');
    });
});

describe('as_typed_text', () => {
    test('types integer', () => {
        assert.strictEqual(as_typed_text(42), '42::L');
    });

    test('types float', () => {
        assert.strictEqual(as_typed_text(3.14), '3.14::R');
    });

    test('types boolean', () => {
        assert.strictEqual(as_typed_text(true), 'true::B');
        assert.strictEqual(as_typed_text(false), 'false::B');
    });

    test('types date', () => {
        const d = new Date(2024, 0, 15); // Jan 15, 2024, no time
        assert.strictEqual(as_typed_text(d), '2024-01-15::D');
    });

    test('types datetime', () => {
        const dt = new Date(2024, 0, 15, 10, 30, 0); // With time
        const result = as_typed_text(dt);
        assert.ok(result.endsWith('::DH'));
    });

    test('types object as JSON', () => {
        const result = as_typed_text({ x: 1 });
        assert.strictEqual(result, '{"x":1}::JS');
    });

    test('types array as JSON', () => {
        const result = as_typed_text([1, 2, 3]);
        assert.strictEqual(result, '[1,2,3]::JS');
    });

    test('returns string as-is', () => {
        assert.strictEqual(as_typed_text('hello'), 'hello');
    });
});

// =============================================================================
// JSON API Tests
// =============================================================================

describe('as_typed_json', () => {
    test('preserves JSON-native numbers without markers', () => {
        // JSON natively supports numbers, so they don't need TYTX markers
        const result = as_typed_json({ count: 42, price: 99.99 });
        assert.strictEqual(result, '{"count":42,"price":99.99}');
    });

    test('types dates (non-native)', () => {
        const d = new Date(2024, 0, 15);
        const result = as_typed_json({ date: d });
        assert.ok(result.includes('::D'));
    });

    test('nested objects with native types', () => {
        // Numbers are JSON-native, no markers needed
        const result = as_typed_json({ outer: { inner: 42 } });
        assert.strictEqual(result, '{"outer":{"inner":42}}');
    });
});

describe('as_json', () => {
    test('standard json output', () => {
        const result = as_json({ count: 42 });
        assert.strictEqual(result, '{"count":42}');
    });

    test('date to ISO string', () => {
        const d = new Date(Date.UTC(2024, 0, 15, 0, 0, 0));
        const result = as_json({ date: d });
        assert.ok(result.includes('2024-01-15'));
    });
});

describe('from_json', () => {
    test('hydrates typed values', () => {
        const result = from_json('{"price": "99.99::N"}');
        // Result is either Big object (if big.js installed) or number
        assert.strictEqual(Number(result.price), 99.99);
    });

    test('hydrates nested', () => {
        const result = from_json('{"outer": {"inner": "42::L"}}');
        assert.strictEqual(result.outer.inner, 42);
    });

    test('hydrates arrays', () => {
        const result = from_json('{"items": ["1::L", "2::L"]}');
        assert.deepStrictEqual(result.items, [1, 2]);
    });

    test('leaves non-typed strings', () => {
        const result = from_json('{"name": "John"}');
        assert.strictEqual(result.name, 'John');
    });
});

describe('JSON round-trip', () => {
    test('integer round-trip', () => {
        const original = { count: 42 };
        const json = as_typed_json(original);
        const restored = from_json(json);
        assert.strictEqual(restored.count, 42);
    });

    test('date round-trip', () => {
        const d = new Date(2024, 0, 15);
        const original = { date: d };
        const json = as_typed_json(original);
        const restored = from_json(json);
        assert.ok(restored.date instanceof Date);
        assert.strictEqual(restored.date.getFullYear(), 2024);
    });

    test('complex object round-trip', () => {
        const original = {
            name: 'Test',
            count: 42,
            active: true,
            price: 99.99
        };
        const json = as_typed_json(original);
        const restored = from_json(json);
        assert.strictEqual(restored.name, 'Test');
        assert.strictEqual(restored.count, 42);
        assert.strictEqual(restored.active, true);
        assert.strictEqual(restored.price, 99.99);
    });
});

// =============================================================================
// XML API Tests
// =============================================================================

describe('as_typed_xml', () => {
    test('simple element', () => {
        const data = { price: { attrs: {}, value: 99.99 } };
        const result = as_typed_xml(data);
        assert.ok(result.includes('99.99::R'));
    });

    test('with attributes', () => {
        const data = { item: { attrs: { id: 42 }, value: 'test' } };
        const result = as_typed_xml(data);
        assert.ok(result.includes('id="42::L"'));
    });

    test('nested elements', () => {
        const data = {
            root: {
                attrs: {},
                value: {
                    child: { attrs: {}, value: 'hello' }
                }
            }
        };
        const result = as_typed_xml(data);
        assert.ok(result.includes('<child>'));
        assert.ok(result.includes('</child>'));
    });
});

describe('as_xml', () => {
    test('standard xml output', () => {
        const data = { price: { attrs: {}, value: 99.99 } };
        const result = as_xml(data);
        assert.ok(result.includes('>99.99<'));
        assert.ok(!result.includes('::'));
    });
});

describe('from_xml', () => {
    test('parses simple element', () => {
        const result = from_xml('<price>99.99::R</price>');
        assert.strictEqual(result.price.value, 99.99);
    });

    test('parses attributes', () => {
        const result = from_xml('<item id="42::L">test</item>');
        assert.strictEqual(result.item.attrs.id, 42);
        assert.strictEqual(result.item.value, 'test');
    });

    test('parses nested elements', () => {
        const result = from_xml('<root><child>hello</child></root>');
        assert.ok('child' in result.root.value);
        assert.strictEqual(result.root.value.child.value, 'hello');
    });

    test('empty element', () => {
        const result = from_xml('<empty />');
        assert.strictEqual(result.empty.value, null);
    });
});

describe('XML round-trip', () => {
    test('simple value round-trip', () => {
        const original = { price: { attrs: {}, value: 99.99 } };
        const xml = as_typed_xml(original);
        const restored = from_xml(xml);
        assert.strictEqual(restored.price.value, 99.99);
    });

    test('with attributes round-trip', () => {
        const original = { item: { attrs: { id: 42 }, value: 'test' } };
        const xml = as_typed_xml(original);
        const restored = from_xml(xml);
        assert.strictEqual(restored.item.attrs.id, 42);
        assert.strictEqual(restored.item.value, 'test');
    });
});

// =============================================================================
// Registry Tests
// =============================================================================

describe('registry', () => {
    test('is_typed detects typed strings', () => {
        assert.strictEqual(registry.is_typed('42::L'), true);
        assert.strictEqual(registry.is_typed('hello'), false);
        assert.strictEqual(registry.is_typed('foo::UNKNOWN'), false);
    });

    test('get returns type by code', () => {
        const intType = registry.get('L');
        assert.ok(intType);
        assert.strictEqual(intType.code, 'L');
    });

    test('get returns type by name', () => {
        const intType = registry.get('int');
        assert.ok(intType);
        assert.strictEqual(intType.code, 'L');
    });

    test('get returns type by alias', () => {
        const intType = registry.get('INTEGER');
        assert.ok(intType);
        assert.strictEqual(intType.code, 'L');
    });

    test('get returns null for unknown', () => {
        assert.strictEqual(registry.get('UNKNOWN'), null);
    });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
    test('empty string', () => {
        assert.strictEqual(from_text(''), '');
    });

    test('string with :: but no valid type', () => {
        assert.strictEqual(from_text('foo::bar'), 'foo::bar');
    });

    test('multiple :: in value', () => {
        // The value itself contains :: - uses last :: as separator
        // "http://example.com::T" → string "http://example.com"
        assert.strictEqual(from_text('http://example.com::T'), 'http://example.com');
    });

    test('null and undefined handling', () => {
        assert.strictEqual(as_typed_text(null), 'null');
        assert.strictEqual(as_typed_text(undefined), 'undefined');
    });

    test('boolean aliases', () => {
        assert.strictEqual(from_text('1::B'), true);
        assert.strictEqual(from_text('yes::B'), true);
        assert.strictEqual(from_text('on::B'), true);
        assert.strictEqual(from_text('0::B'), false);
        assert.strictEqual(from_text('no::B'), false);
    });
});

// MessagePack tests (only run if @msgpack/msgpack is installed)
describe('msgpack_utils', () => {
    let msgpackUtils;
    let msgpackAvailable = false;

    // Try to load msgpack utilities
    try {
        require('@msgpack/msgpack');
        msgpackUtils = require('../src/msgpack_utils');
        msgpackAvailable = true;
    } catch (e) {
        // @msgpack/msgpack not installed, skip tests
    }

    test('TYTX_EXT_TYPE is 42', { skip: !msgpackAvailable }, () => {
        assert.strictEqual(msgpackUtils.TYTX_EXT_TYPE, 42);
    });

    test('_hasTytxTypes detects Date', { skip: !msgpackAvailable }, () => {
        assert.strictEqual(msgpackUtils._hasTytxTypes(new Date()), true);
        assert.strictEqual(msgpackUtils._hasTytxTypes({ date: new Date() }), true);
        assert.strictEqual(msgpackUtils._hasTytxTypes([new Date()]), true);
    });

    test('_hasTytxTypes returns false for msgpack-native types', { skip: !msgpackAvailable }, () => {
        // Numbers, strings, booleans are msgpack-native - no TYTX needed
        assert.strictEqual(msgpackUtils._hasTytxTypes(42), false);
        assert.strictEqual(msgpackUtils._hasTytxTypes(3.14), false);
        assert.strictEqual(msgpackUtils._hasTytxTypes({ price: 99.99 }), false);
        assert.strictEqual(msgpackUtils._hasTytxTypes('hello'), false);
        assert.strictEqual(msgpackUtils._hasTytxTypes({ name: 'test' }), false);
        assert.strictEqual(msgpackUtils._hasTytxTypes(null), false);
        assert.strictEqual(msgpackUtils._hasTytxTypes(true), false);
    });

    test('packb/unpackb roundtrip with numbers', { skip: !msgpackAvailable }, () => {
        const data = { price: 99.99, count: 42 };
        const packed = msgpackUtils.packb(data);
        assert.ok(packed instanceof Uint8Array);

        const restored = msgpackUtils.unpackb(packed);
        assert.strictEqual(Number(restored.price), 99.99);
        assert.strictEqual(restored.count, 42);
    });

    test('packb/unpackb roundtrip with Date', { skip: !msgpackAvailable }, () => {
        const testDate = new Date('2025-01-15T10:30:00.000Z');
        const data = { date: testDate, name: 'Test' };
        const packed = msgpackUtils.packb(data);
        const restored = msgpackUtils.unpackb(packed);

        assert.ok(restored.date instanceof Date);
        assert.strictEqual(restored.date.toISOString(), testDate.toISOString());
        assert.strictEqual(restored.name, 'Test');
    });

    test('packb/unpackb nested structures', { skip: !msgpackAvailable }, () => {
        const data = {
            order: {
                items: [
                    { name: 'Widget', price: 25.00 },
                    { name: 'Gadget', price: 75.50 }
                ],
                total: 100.50,
                date: new Date('2025-06-15')
            }
        };

        const packed = msgpackUtils.packb(data);
        const restored = msgpackUtils.unpackb(packed);

        assert.strictEqual(Number(restored.order.total), 100.50);
        assert.strictEqual(Number(restored.order.items[0].price), 25.00);
        assert.ok(restored.order.date instanceof Date);
    });

    test('_getMsgpack throws if not installed', { skip: msgpackAvailable }, () => {
        // This test only runs if msgpack is NOT installed
        const { _getMsgpack } = require('../src/msgpack_utils');
        assert.throws(() => _getMsgpack(), /msgpack is required/);
    });
});

// =============================================================================
// TytxModel Tests
// =============================================================================

describe('TytxModel', () => {
    const { TytxModel } = require('../src/index');

    // Define a test model
    class Order extends TytxModel {}

    test('fromTytx creates instance from JSON string', () => {
        const json = '{"price": "99.99::N", "quantity": "5::L", "name": "Widget"}';
        const order = Order.fromTytx(json);

        assert.ok(order instanceof Order);
        assert.strictEqual(Number(order.price), 99.99);
        assert.strictEqual(order.quantity, 5);
        assert.strictEqual(order.name, 'Widget');
    });

    test('fromTytx creates instance from object', () => {
        const data = { price: '99.99::N', date: '2025-01-15::D' };
        const order = Order.fromTytx(data);

        assert.ok(order instanceof Order);
        assert.strictEqual(Number(order.price), 99.99);
        assert.ok(order.date instanceof Date);
    });

    test('toTytx serializes instance to JSON string with native types', () => {
        const order = new Order();
        order.price = 99.99;
        order.quantity = 5;
        order.active = true;

        const json = order.toTytx();
        const parsed = JSON.parse(json);

        // JSON-native types pass through unchanged (no type markers)
        assert.strictEqual(parsed.price, 99.99);
        assert.strictEqual(parsed.quantity, 5);
        assert.strictEqual(parsed.active, true);
    });

    test('toTytx handles Date objects', () => {
        const order = new Order();
        order.date = new Date('2025-01-15');

        const json = order.toTytx();
        const parsed = JSON.parse(json);

        assert.ok(parsed.date.includes('2025-01-15'));
        assert.ok(parsed.date.endsWith('::D') || parsed.date.endsWith('::DH'));
    });

    test('roundtrip preserves values', () => {
        const order = new Order();
        order.price = 123.45;
        order.count = 10;
        order.active = false;
        order.name = 'Test';

        const json = order.toTytx();
        const restored = Order.fromTytx(json);

        assert.strictEqual(Number(restored.price), 123.45);
        assert.strictEqual(restored.count, 10);
        assert.strictEqual(restored.active, false);
        assert.strictEqual(restored.name, 'Test');
    });

    test('inheritance works correctly', () => {
        class Payment extends TytxModel {}

        const payment = Payment.fromTytx('{"amount": "500.00::N"}');
        assert.ok(payment instanceof Payment);
        assert.ok(payment instanceof TytxModel);
        assert.strictEqual(Number(payment.amount), 500);
    });

    // MessagePack tests for TytxModel
    let msgpackAvailable = false;
    try {
        require('@msgpack/msgpack');
        msgpackAvailable = true;
    } catch (e) {}

    test('toTytxMsgpack serializes to bytes', { skip: !msgpackAvailable }, () => {
        const order = new Order();
        order.price = 99.99;
        order.date = new Date('2025-01-15');

        const packed = order.toTytxMsgpack();
        assert.ok(packed instanceof Uint8Array);
    });

    test('fromTytxMsgpack restores instance', { skip: !msgpackAvailable }, () => {
        const order = new Order();
        order.price = 99.99;
        order.quantity = 5;

        const packed = order.toTytxMsgpack();
        const restored = Order.fromTytxMsgpack(packed);

        assert.ok(restored instanceof Order);
        assert.strictEqual(Number(restored.price), 99.99);
        assert.strictEqual(restored.quantity, 5);
    });
});

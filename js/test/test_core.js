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
        // Time is now returned as Date on epoch (1970-01-01) UTC
        const result = from_text('10:30:00::H');
        assert.ok(result instanceof Date);
        assert.strictEqual(result.getUTCHours(), 10);
        assert.strictEqual(result.getUTCMinutes(), 30);
        assert.strictEqual(result.getUTCSeconds(), 0);
        // Epoch date
        assert.strictEqual(result.getUTCFullYear(), 1970);
        assert.strictEqual(result.getUTCMonth(), 0);
        assert.strictEqual(result.getUTCDate(), 1);
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

    test('type names work', () => {
        // Type names (lowercase) work as alternatives to codes
        assert.strictEqual(from_text('42::int'), 42);
        assert.strictEqual(from_text('true::bool'), true);
        assert.strictEqual(from_text('3.14::float'), 3.14);
        assert.strictEqual(from_text('hello::str'), 'hello');
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
        // Use UTC date (midnight UTC) for date-only
        const d = new Date('2024-01-15T00:00:00.000Z');
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
        // Use UTC date (midnight UTC) for date-only detection
        const d = new Date('2024-01-15T00:00:00.000Z');
        assert.strictEqual(as_typed_text(d), '2024-01-15::D');
    });

    test('types datetime', () => {
        const dt = new Date(2024, 0, 15, 10, 30, 0); // With time
        const result = as_typed_text(dt);
        assert.ok(result.endsWith('::DHZ'));  // DHZ is the canonical code
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

    test('get returns type by name (lowercase)', () => {
        const intType = registry.get('int');
        assert.ok(intType);
        assert.strictEqual(intType.code, 'L');

        const boolType = registry.get('bool');
        assert.ok(boolType);
        assert.strictEqual(boolType.code, 'B');
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

// =============================================================================
// Typed Arrays Tests
// =============================================================================

describe('typed arrays', () => {
    describe('from_text (parse)', () => {
        test('parses integer array', () => {
            const result = from_text('[1,2,3]::L');
            assert.deepStrictEqual(result, [1, 2, 3]);
        });

        test('parses nested integer array', () => {
            const result = from_text('[[1,2],[3,4]]::L');
            assert.deepStrictEqual(result, [[1, 2], [3, 4]]);
        });

        test('parses float array', () => {
            const result = from_text('[1.5,2.5,3.5]::R');
            assert.deepStrictEqual(result, [1.5, 2.5, 3.5]);
        });

        test('parses boolean array', () => {
            const result = from_text('[true,false,true]::B');
            assert.deepStrictEqual(result, [true, false, true]);
        });

        test('parses date array', () => {
            const result = from_text('["2025-01-15","2025-01-16"]::D');
            assert.strictEqual(result.length, 2);
            assert.ok(result[0] instanceof Date);
            assert.ok(result[1] instanceof Date);
            assert.strictEqual(result[0].toISOString().slice(0, 10), '2025-01-15');
            assert.strictEqual(result[1].toISOString().slice(0, 10), '2025-01-16');
        });
    });

    describe('as_typed_text (serialize)', () => {
        test('serializes integer array with compact_array', () => {
            const result = as_typed_text([1, 2, 3], true);
            assert.strictEqual(result, '["1","2","3"]::L');
        });

        test('serializes nested integer array with compact_array', () => {
            const result = as_typed_text([[1, 2], [3, 4]], true);
            assert.strictEqual(result, '[["1","2"],["3","4"]]::L');
        });

        test('serializes float array with compact_array', () => {
            const result = as_typed_text([1.5, 2.5, 3.5], true);
            assert.strictEqual(result, '["1.5","2.5","3.5"]::R');
        });

        test('serializes boolean array with compact_array', () => {
            const result = as_typed_text([true, false, true], true);
            assert.strictEqual(result, '["true","false","true"]::B');
        });

        test('serializes empty array', () => {
            const result = as_typed_text([], true);
            assert.strictEqual(result, '[]');
        });

        test('heterogeneous array falls back to individual typing', () => {
            const result = as_typed_text([1, 'hello', true], true);
            // Should be JSON array with individual typing
            const parsed = JSON.parse(result);
            assert.strictEqual(parsed[0], '1::L');
            assert.strictEqual(parsed[1], 'hello');
            assert.strictEqual(parsed[2], 'true::B');
        });
    });

    describe('roundtrip', () => {
        test('integer array roundtrip', () => {
            const original = [1, 2, 3];
            const serialized = as_typed_text(original, true);
            const restored = from_text(serialized);
            assert.deepStrictEqual(restored, original);
        });

        test('nested array roundtrip', () => {
            const original = [[1, 2], [3, 4]];
            const serialized = as_typed_text(original, true);
            const restored = from_text(serialized);
            assert.deepStrictEqual(restored, original);
        });

        test('float array roundtrip', () => {
            const original = [1.5, 2.5, 3.5];
            const serialized = as_typed_text(original, true);
            const restored = from_text(serialized);
            assert.deepStrictEqual(restored, original);
        });
    });
});

// =============================================================================
// Struct Schema Tests
// =============================================================================

describe('struct schemas', () => {
    describe('register_struct', () => {
        test('registers dict schema', () => {
            registry.register_struct('TEST_DICT', { name: 'T', value: 'L' });
            const schema = registry.get_struct('TEST_DICT');
            assert.deepStrictEqual(schema, { name: 'T', value: 'L' });
            registry.unregister_struct('TEST_DICT');
        });

        test('registers list schema', () => {
            registry.register_struct('TEST_LIST', ['T', 'L', 'N']);
            const schema = registry.get_struct('TEST_LIST');
            assert.deepStrictEqual(schema, ['T', 'L', 'N']);
            registry.unregister_struct('TEST_LIST');
        });

        test('registers string schema', () => {
            registry.register_struct('TEST_STR', 'x:R,y:R');
            const schema = registry.get_struct('TEST_STR');
            assert.strictEqual(schema, 'x:R,y:R');
            registry.unregister_struct('TEST_STR');
        });

        test('unregister removes struct', () => {
            registry.register_struct('TEMP', ['L']);
            assert.ok(registry.get_struct('TEMP') !== null);
            registry.unregister_struct('TEMP');
            assert.strictEqual(registry.get_struct('TEMP'), null);
        });
    });

    describe('dict schema', () => {
        test('applies types to matching keys', () => {
            registry.register_struct('CUSTOMER', { name: 'T', balance: 'N', age: 'L' });
            try {
                const result = from_text('{"name": "Acme", "balance": "100.50", "age": "25"}::@CUSTOMER');
                assert.strictEqual(result.name, 'Acme');
                assert.strictEqual(result.balance.toString(), '100.5');
                assert.strictEqual(result.age, 25);
            } finally {
                registry.unregister_struct('CUSTOMER');
            }
        });

        test('extra keys pass through unchanged', () => {
            registry.register_struct('ITEM', { price: 'N' });
            try {
                const result = from_text('{"price": "99.99", "note": "test"}::@ITEM');
                assert.strictEqual(result.price.toString(), '99.99');
                assert.strictEqual(result.note, 'test');
            } finally {
                registry.unregister_struct('ITEM');
            }
        });
    });

    describe('list schema positional', () => {
        test('applies type at index i to data[i]', () => {
            registry.register_struct('ROW', ['T', 'L', 'N']);
            try {
                const result = from_text('["Product", 2, "100.50"]::@ROW');
                assert.strictEqual(result[0], 'Product');
                assert.strictEqual(result[1], 2);
                assert.strictEqual(result[2].toString(), '100.5');
            } finally {
                registry.unregister_struct('ROW');
            }
        });

        test('array of rows applies positional to each', () => {
            registry.register_struct('ROW', ['T', 'L', 'N']);
            try {
                const result = from_text('[["A", 1, "10"], ["B", 2, "20"]]::@ROW');
                assert.strictEqual(result[0][0], 'A');
                assert.strictEqual(result[0][1], 1);
                assert.strictEqual(result[0][2].toString(), '10');
                assert.strictEqual(result[1][0], 'B');
                assert.strictEqual(result[1][1], 2);
                assert.strictEqual(result[1][2].toString(), '20');
            } finally {
                registry.unregister_struct('ROW');
            }
        });
    });

    describe('list schema homogeneous', () => {
        test('single type applies to all elements', () => {
            registry.register_struct('PRICES', ['N']);
            try {
                const result = from_text('[100, 200, "50.25"]::@PRICES');
                assert.strictEqual(result[0].toString(), '100');
                assert.strictEqual(result[1].toString(), '200');
                assert.strictEqual(result[2].toString(), '50.25');
            } finally {
                registry.unregister_struct('PRICES');
            }
        });

        test('empty array returns empty', () => {
            registry.register_struct('NUMS', ['L']);
            try {
                const result = from_text('[]::@NUMS');
                assert.deepStrictEqual(result, []);
            } finally {
                registry.unregister_struct('NUMS');
            }
        });

        test('nested 2D array applies to leaves', () => {
            registry.register_struct('MATRIX', ['L']);
            try {
                const result = from_text('[[1, 2], [3, 4]]::@MATRIX');
                assert.deepStrictEqual(result, [[1, 2], [3, 4]]);
            } finally {
                registry.unregister_struct('MATRIX');
            }
        });
    });

    describe('string schema', () => {
        test('named fields produce dict output', () => {
            registry.register_struct('POINT', 'x:R,y:R');
            try {
                const result = from_text('["3.7", "7.3"]::@POINT');
                assert.deepStrictEqual(result, { x: 3.7, y: 7.3 });
            } finally {
                registry.unregister_struct('POINT');
            }
        });

        test('anonymous fields produce list output', () => {
            registry.register_struct('COORDS', 'R,R');
            try {
                const result = from_text('["3.7", "7.3"]::@COORDS');
                assert.deepStrictEqual(result, [3.7, 7.3]);
            } finally {
                registry.unregister_struct('COORDS');
            }
        });

        test('preserves field order', () => {
            registry.register_struct('CSV_ROW', 'name:T,qty:L,price:N');
            try {
                const result = from_text('["Widget", "10", "99.99"]::@CSV_ROW');
                assert.strictEqual(result.name, 'Widget');
                assert.strictEqual(result.qty, 10);
                assert.strictEqual(result.price.toString(), '99.99');
                assert.deepStrictEqual(Object.keys(result), ['name', 'qty', 'price']);
            } finally {
                registry.unregister_struct('CSV_ROW');
            }
        });

        test('handles spaces in definition', () => {
            registry.register_struct('POINT2', 'x : R , y : R');
            try {
                const result = from_text('["1.0", "2.0"]::@POINT2');
                assert.deepStrictEqual(result, { x: 1.0, y: 2.0 });
            } finally {
                registry.unregister_struct('POINT2');
            }
        });
    });

    describe('array of structs (#@)', () => {
        test('batch mode with named string schema', () => {
            registry.register_struct('ROW', 'name:T,qty:L,price:N');
            try {
                const result = from_text('[["A", "1", "10"], ["B", "2", "20"]]::#@ROW');
                assert.strictEqual(result.length, 2);
                assert.strictEqual(result[0].name, 'A');
                assert.strictEqual(result[0].qty, 1);
                assert.strictEqual(result[0].price.toString(), '10');
                assert.strictEqual(result[1].name, 'B');
                assert.strictEqual(result[1].qty, 2);
                assert.strictEqual(result[1].price.toString(), '20');
            } finally {
                registry.unregister_struct('ROW');
            }
        });

        test('batch mode with anonymous string schema', () => {
            registry.register_struct('PAIR', 'R,R');
            try {
                const result = from_text('[["1.5", "2.5"], ["3.5", "4.5"]]::#@PAIR');
                assert.deepStrictEqual(result, [[1.5, 2.5], [3.5, 4.5]]);
            } finally {
                registry.unregister_struct('PAIR');
            }
        });

        test('batch mode with dict schema', () => {
            registry.register_struct('ITEM', { name: 'T', value: 'L' });
            try {
                const result = from_text('[{"name": "A", "value": "1"}, {"name": "B", "value": "2"}]::#@ITEM');
                assert.strictEqual(result.length, 2);
                assert.strictEqual(result[0].name, 'A');
                assert.strictEqual(result[0].value, 1);
                assert.strictEqual(result[1].name, 'B');
                assert.strictEqual(result[1].value, 2);
            } finally {
                registry.unregister_struct('ITEM');
            }
        });
    });

    describe('struct v2 object-style fields', () => {
        test('simple string fields still work (backward compatible)', () => {
            registry.register_struct('SIMPLE', { name: 'T', age: 'L' });
            try {
                const result = from_text('{"name": "John", "age": "30"}::@SIMPLE');
                assert.strictEqual(result.name, 'John');
                assert.strictEqual(result.age, 30);
            } finally {
                registry.unregister_struct('SIMPLE');
            }
        });

        test('object field with type only', () => {
            registry.register_struct('OBJ_TYPE', {
                name: { type: 'T' },
                price: { type: 'N' }
            });
            try {
                const result = from_text('{"name": "Widget", "price": "99.99"}::@OBJ_TYPE');
                assert.strictEqual(result.name, 'Widget');
                assert.strictEqual(result.price.toString(), '99.99');
            } finally {
                registry.unregister_struct('OBJ_TYPE');
            }
        });

        test('object field with validate section', () => {
            registry.register_struct('WITH_VALIDATE', {
                name: { type: 'T', validate: { min: 1, max: 100 } },
                age: { type: 'L', validate: { min: 0, max: 120 } }
            });
            try {
                const result = from_text('{"name": "Alice", "age": "25"}::@WITH_VALIDATE');
                assert.strictEqual(result.name, 'Alice');
                assert.strictEqual(result.age, 25);
            } finally {
                registry.unregister_struct('WITH_VALIDATE');
            }
        });

        test('object field with ui section', () => {
            registry.register_struct('WITH_UI', {
                email: {
                    type: 'T',
                    ui: { label: 'Email Address', placeholder: 'user@example.com' }
                }
            });
            try {
                const result = from_text('{"email": "test@test.com"}::@WITH_UI');
                assert.strictEqual(result.email, 'test@test.com');
            } finally {
                registry.unregister_struct('WITH_UI');
            }
        });

        test('object field with type, validate, and ui', () => {
            registry.register_struct('FULL_FIELD', {
                username: {
                    type: 'T',
                    validate: { min: 3, max: 50, pattern: '^[a-z0-9_]+$' },
                    ui: { label: 'Username', hint: 'Only lowercase letters and numbers' }
                },
                balance: {
                    type: 'N',
                    validate: { min: 0 },
                    ui: { label: 'Balance', format: 'currency', readonly: true }
                }
            });
            try {
                const result = from_text('{"username": "john_doe", "balance": "1000.50"}::@FULL_FIELD');
                assert.strictEqual(result.username, 'john_doe');
                assert.strictEqual(result.balance.toString(), '1000.5');
            } finally {
                registry.unregister_struct('FULL_FIELD');
            }
        });

        test('mixed string and object fields', () => {
            registry.register_struct('MIXED', {
                id: 'L',
                name: { type: 'T', ui: { label: 'Full Name' } },
                active: 'B'
            });
            try {
                const result = from_text('{"id": "123", "name": "Test", "active": "true"}::@MIXED');
                assert.strictEqual(result.id, 123);
                assert.strictEqual(result.name, 'Test');
                assert.strictEqual(result.active, true);
            } finally {
                registry.unregister_struct('MIXED');
            }
        });

        test('list schema with object fields', () => {
            registry.register_struct('ROW_V2', [
                { type: 'T', ui: { label: 'Name' } },
                { type: 'L', validate: { min: 0 } },
                { type: 'N', ui: { format: 'currency' } }
            ]);
            try {
                const result = from_text('["Product", "10", "99.99"]::@ROW_V2');
                assert.strictEqual(result[0], 'Product');
                assert.strictEqual(result[1], 10);
                assert.strictEqual(result[2].toString(), '99.99');
            } finally {
                registry.unregister_struct('ROW_V2');
            }
        });

        test('list schema with mixed fields', () => {
            registry.register_struct('ROW_MIXED', [
                'T',
                { type: 'L', validate: { min: 1 } },
                'N'
            ]);
            try {
                const result = from_text('["Item", "5", "50.00"]::@ROW_MIXED');
                assert.strictEqual(result[0], 'Item');
                assert.strictEqual(result[1], 5);
                assert.strictEqual(result[2].toString(), '50');
            } finally {
                registry.unregister_struct('ROW_MIXED');
            }
        });

        test('homogeneous list with object field', () => {
            registry.register_struct('PRICES_V2', [{ type: 'N', validate: { min: 0 } }]);
            try {
                const result = from_text('["10.00", "20.50", "30.99"]::@PRICES_V2');
                assert.strictEqual(result[0].toString(), '10');
                assert.strictEqual(result[1].toString(), '20.5');
                assert.strictEqual(result[2].toString(), '30.99');
            } finally {
                registry.unregister_struct('PRICES_V2');
            }
        });

        test('object field without type defaults to T', () => {
            registry.register_struct('DEFAULT_TYPE', {
                note: { ui: { label: 'Notes' } }
            });
            try {
                const result = from_text('{"note": "Hello"}::@DEFAULT_TYPE');
                assert.strictEqual(result.note, 'Hello');
            } finally {
                registry.unregister_struct('DEFAULT_TYPE');
            }
        });

        test('nested struct reference in object field', () => {
            registry.register_struct('ADDR_V2', {
                city: { type: 'T', ui: { label: 'City' } },
                zip: 'L'
            });
            registry.register_struct('PERSON_V2', {
                name: { type: 'T', validate: { min: 1 } },
                address: { type: '@ADDR_V2' }
            });
            try {
                const result = from_text('{"name": "John", "address": {"city": "Rome", "zip": "12345"}}::@PERSON_V2');
                assert.strictEqual(result.name, 'John');
                assert.strictEqual(result.address.city, 'Rome');
                assert.strictEqual(result.address.zip, 12345);
            } finally {
                registry.unregister_struct('PERSON_V2');
                registry.unregister_struct('ADDR_V2');
            }
        });
    });

    describe('field helper functions', () => {
        const { getFieldType, getFieldValidate, getFieldUI } = require('../src/index');

        test('getFieldType returns string directly for string fields', () => {
            assert.strictEqual(getFieldType('T'), 'T');
            assert.strictEqual(getFieldType('N'), 'N');
            assert.strictEqual(getFieldType('@PERSON'), '@PERSON');
        });

        test('getFieldType extracts type from object field', () => {
            assert.strictEqual(getFieldType({ type: 'T' }), 'T');
            assert.strictEqual(getFieldType({ type: 'N', validate: { min: 0 } }), 'N');
            assert.strictEqual(getFieldType({ type: '@ADDR', ui: { label: 'Address' } }), '@ADDR');
        });

        test('getFieldType returns T when type not specified', () => {
            assert.strictEqual(getFieldType({ ui: { label: 'Notes' } }), 'T');
            assert.strictEqual(getFieldType({}), 'T');
        });

        test('getFieldValidate returns undefined for string fields', () => {
            assert.strictEqual(getFieldValidate('T'), undefined);
            assert.strictEqual(getFieldValidate('N[min:0]'), undefined);
        });

        test('getFieldValidate extracts validate from object field', () => {
            const validate = getFieldValidate({
                type: 'T',
                validate: { min: 1, max: 100, pattern: '^[a-z]+$' }
            });
            assert.deepStrictEqual(validate, { min: 1, max: 100, pattern: '^[a-z]+$' });
        });

        test('getFieldValidate returns undefined when validate not present', () => {
            assert.strictEqual(getFieldValidate({ type: 'T' }), undefined);
            assert.strictEqual(getFieldValidate({ type: 'T', ui: { label: 'Name' } }), undefined);
        });

        test('getFieldUI returns undefined for string fields', () => {
            assert.strictEqual(getFieldUI('T'), undefined);
            assert.strictEqual(getFieldUI('T[lbl:Name]'), undefined);
        });

        test('getFieldUI extracts ui from object field', () => {
            const ui = getFieldUI({
                type: 'T',
                ui: { label: 'Full Name', placeholder: 'Enter name', readonly: true }
            });
            assert.deepStrictEqual(ui, { label: 'Full Name', placeholder: 'Enter name', readonly: true });
        });

        test('getFieldUI returns undefined when ui not present', () => {
            assert.strictEqual(getFieldUI({ type: 'T' }), undefined);
            assert.strictEqual(getFieldUI({ type: 'T', validate: { min: 1 } }), undefined);
        });
    });
});

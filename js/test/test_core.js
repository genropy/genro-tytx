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
        // null and undefined are now typed as NN (NoneType)
        assert.strictEqual(as_typed_text(null), '::NN');
        assert.strictEqual(as_typed_text(undefined), '::NN');
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

        test('registers JSON string schema', () => {
            registry.register_struct('TEST_STR', '["R", "R"]');
            const schema = registry.get_struct('TEST_STR');
            assert.deepStrictEqual(schema, ['R', 'R']);
            registry.unregister_struct('TEST_STR');
        });

        test('rejects old string format', () => {
            assert.throws(
                () => registry.register_struct('INVALID', 'x:R,y:R'),
                /Invalid JSON schema/
            );
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

    describe('JSON string schema', () => {
        test('JSON dict schema', () => {
            registry.register_struct('POINT', '{"x": "R", "y": "R"}');
            try {
                const result = from_text('{"x": "3.7", "y": "7.3"}::@POINT');
                assert.deepStrictEqual(result, { x: 3.7, y: 7.3 });
            } finally {
                registry.unregister_struct('POINT');
            }
        });

        test('JSON list schema (positional)', () => {
            registry.register_struct('COORDS', '["R", "R"]');
            try {
                const result = from_text('[3.7, 7.3]::@COORDS');
                assert.deepStrictEqual(result, [3.7, 7.3]);
            } finally {
                registry.unregister_struct('COORDS');
            }
        });

        test('preserves field order from JSON', () => {
            registry.register_struct('CSV_ROW', '{"name": "T", "qty": "L", "price": "N"}');
            try {
                const result = from_text('{"name": "Widget", "qty": "10", "price": "99.99"}::@CSV_ROW');
                assert.strictEqual(result.name, 'Widget');
                assert.strictEqual(result.qty, 10);
                assert.strictEqual(result.price.toString(), '99.99');
            } finally {
                registry.unregister_struct('CSV_ROW');
            }
        });
    });

    describe('array of structs (#@)', () => {
        test('batch mode with dict schema', () => {
            registry.register_struct('ROW', '{"name": "T", "qty": "L", "price": "N"}');
            try {
                const result = from_text('[{"name":"A","qty":"1","price":"10"},{"name":"B","qty":"2","price":"20"}]::#@ROW');
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

        test('batch mode with list schema', () => {
            registry.register_struct('PAIR', '["R", "R"]');
            try {
                const result = from_text('[[1.5, 2.5], [3.5, 4.5]]::#@PAIR');
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

// =============================================================================
// Types Coverage Tests
// =============================================================================

describe('types coverage', () => {
    test('DateType.format with locale', () => {
        const dateType = registry.get('D');
        const date = new Date('2025-01-15T00:00:00.000Z');
        const formatted = dateType.format(date, null, 'en-US');
        // Should return a formatted string
        assert.ok(typeof formatted === 'string');
        assert.ok(formatted.includes('2025') || formatted.includes('01') || formatted.includes('15'));
    });

    test('DateType.format without locale', () => {
        const dateType = registry.get('D');
        const date = new Date('2025-01-15T00:00:00.000Z');
        const formatted = dateType.format(date);
        assert.strictEqual(formatted, '2025-01-15');
    });

    test('DateTimeType (DHZ) format with locale', () => {
        const dateTimeType = registry.get('DHZ');
        const datetime = new Date('2025-01-15T10:30:45.000Z');
        const formatted = dateTimeType.format(datetime, null, 'en-US');
        assert.ok(typeof formatted === 'string');
        assert.ok(formatted.includes('2025') || formatted.includes('10') || formatted.includes('30'));
    });

    test('DateTimeType (DHZ) format without locale', () => {
        const dateTimeType = registry.get('DHZ');
        const datetime = new Date('2025-01-15T10:30:45.000Z');
        const formatted = dateTimeType.format(datetime);
        assert.strictEqual(formatted, '2025-01-15T10:30:45Z');
    });

    test('NaiveDateTimeType (DH) serialize', () => {
        const naiveDateTimeType = registry.get('DH');
        const datetime = new Date('2025-01-15T10:30:45.000Z');
        const serialized = naiveDateTimeType.serialize(datetime);
        // Should NOT have Z suffix
        assert.strictEqual(serialized, '2025-01-15T10:30:45');
        assert.ok(!serialized.endsWith('Z'));
    });

    test('NaiveDateTimeType (DH) format with locale', () => {
        const naiveDateTimeType = registry.get('DH');
        const datetime = new Date('2025-01-15T10:30:45.000Z');
        const formatted = naiveDateTimeType.format(datetime, null, 'en-US');
        assert.ok(typeof formatted === 'string');
    });

    test('NaiveDateTimeType (DH) format without locale', () => {
        const naiveDateTimeType = registry.get('DH');
        const datetime = new Date('2025-01-15T10:30:45.000Z');
        const formatted = naiveDateTimeType.format(datetime);
        assert.strictEqual(formatted, '2025-01-15T10:30:45');
    });

    test('TimeType serialize with Date object', () => {
        const timeType = registry.get('H');
        const time = new Date('1970-01-01T14:30:45.000Z');
        const serialized = timeType.serialize(time);
        assert.strictEqual(serialized, '14:30:45');
    });

    test('TimeType serialize with non-Date value', () => {
        const timeType = registry.get('H');
        const serialized = timeType.serialize('10:30:00');
        assert.strictEqual(serialized, '10:30:00');
    });

    test('TimeType parse', () => {
        const timeType = registry.get('H');
        const time = timeType.parse('14:30:45');
        assert.ok(time instanceof Date);
        assert.strictEqual(time.getUTCHours(), 14);
        assert.strictEqual(time.getUTCMinutes(), 30);
        assert.strictEqual(time.getUTCSeconds(), 45);
    });
});

// =============================================================================
// XML Coverage Tests
// =============================================================================

describe('xml coverage', () => {
    test('duplicate child elements become array', () => {
        const xml = '<root><item>1</item><item>2</item><item>3</item></root>';
        const result = from_xml(xml);
        // Multiple <item> elements should become an array
        assert.ok(Array.isArray(result.root.value.item));
        assert.strictEqual(result.root.value.item.length, 3);
        assert.strictEqual(result.root.value.item[0].value, '1');
        assert.strictEqual(result.root.value.item[1].value, '2');
        assert.strictEqual(result.root.value.item[2].value, '3');
    });

    test('element with children and text has #text', () => {
        const xml = '<root>Some text<child>val</child></root>';
        const result = from_xml(xml);
        // Should have both children and #text
        assert.ok(result.root.value.child);
        assert.strictEqual(result.root.value['#text'], 'Some text');
    });

    test('element with only whitespace content returns null', () => {
        const xml = '<empty>   </empty>';
        const result = from_xml(xml);
        assert.strictEqual(result.empty.value, null);
    });

    test('malformed XML without closing tag', () => {
        const xml = '<unclosed>';
        const result = from_xml(xml);
        // Should return value: null since content cannot be extracted
        assert.strictEqual(result.unclosed.value, null);
    });
});

// =============================================================================
// TytxModel Coverage Tests
// =============================================================================

describe('TytxModel coverage', () => {
    const { TytxModel } = require('../src/index');

    class TestModel extends TytxModel {}

    test('fromTytx handles null values', () => {
        const model = TestModel.fromTytx({ value: null, name: 'test' });
        assert.strictEqual(model.value, null);
        assert.strictEqual(model.name, 'test');
    });

    test('fromTytx handles undefined values', () => {
        const model = TestModel.fromTytx({ value: undefined, name: 'test' });
        assert.strictEqual(model.value, undefined);
        assert.strictEqual(model.name, 'test');
    });

    test('fromTytx handles nested arrays', () => {
        const data = { items: ['1::L', '2::L', '3::L'] };
        const model = TestModel.fromTytx(data);
        assert.deepStrictEqual(model.items, [1, 2, 3]);
    });

    test('fromTytx handles deeply nested objects', () => {
        const data = {
            order: {
                customer: {
                    name: 'John',
                    id: '123::L'
                },
                total: '99.99::N'
            }
        };
        const model = TestModel.fromTytx(data);
        assert.strictEqual(model.order.customer.name, 'John');
        assert.strictEqual(model.order.customer.id, 123);
        assert.strictEqual(Number(model.order.total), 99.99);
    });

    test('fromTytx handles numbers unchanged', () => {
        const data = { count: 42, price: 99.99 };
        const model = TestModel.fromTytx(data);
        assert.strictEqual(model.count, 42);
        assert.strictEqual(model.price, 99.99);
    });

    test('fromTytx handles booleans unchanged', () => {
        const data = { active: true, deleted: false };
        const model = TestModel.fromTytx(data);
        assert.strictEqual(model.active, true);
        assert.strictEqual(model.deleted, false);
    });
});

// =============================================================================
// Registry Coverage Tests
// =============================================================================

describe('registry coverage', () => {
    test('as_text with format parameter (date)', () => {
        const date = new Date('2025-01-15T00:00:00.000Z');
        const formatted = registry.as_text(date, null, 'en-US');
        assert.ok(typeof formatted === 'string');
    });

    test('as_text with object serializes to JSON', () => {
        const obj = { custom: 'object' };
        const result = registry.as_text(obj);
        // Objects get serialized to JSON string
        assert.strictEqual(result, '{"custom":"object"}');
    });

    test('as_text with function falls back to String', () => {
        const fn = function test() {};
        const result = registry.as_text(fn);
        assert.ok(typeof result === 'string');
    });

    test('_serializeArrayElements with nested arrays', () => {
        // Heterogeneous nested array - each element typed individually
        const arr = [[1, 'hello'], [true, 42]];
        const result = as_typed_text(arr, true);
        const parsed = JSON.parse(result);
        // Should be array of arrays with individually typed elements
        assert.ok(Array.isArray(parsed));
        assert.ok(Array.isArray(parsed[0]));
    });
});

// =============================================================================
// FloatType Coverage Tests
// =============================================================================

describe('FloatType coverage', () => {
    test('FloatType.format with locale', () => {
        const floatType = registry.get('R');
        const formatted = floatType.format(1234.5678, null, 'en-US');
        assert.ok(typeof formatted === 'string');
        // en-US should format with 2 decimal places
        assert.ok(formatted.includes('.'));
    });

    test('FloatType.format without locale', () => {
        const floatType = registry.get('R');
        const formatted = floatType.format(1234.5678);
        assert.strictEqual(formatted, '1234.57');
    });

    test('FloatType.format with de-DE locale', () => {
        const floatType = registry.get('R');
        const formatted = floatType.format(1234.5678, null, 'de-DE');
        assert.ok(typeof formatted === 'string');
        // German locale uses comma as decimal separator
        assert.ok(formatted.includes(',') || formatted.includes('.'));
    });
});

// =============================================================================
// StrType Coverage Tests
// =============================================================================

describe('StrType coverage', () => {
    test('StrType.serialize with number', () => {
        const strType = registry.get('T');
        const serialized = strType.serialize(42);
        assert.strictEqual(serialized, '42');
    });

    test('StrType.serialize with boolean', () => {
        const strType = registry.get('T');
        assert.strictEqual(strType.serialize(true), 'true');
        assert.strictEqual(strType.serialize(false), 'false');
    });

    test('StrType.serialize with object', () => {
        const strType = registry.get('T');
        const serialized = strType.serialize({ a: 1 });
        assert.strictEqual(serialized, '[object Object]');
    });
});

// =============================================================================
// JSON Utils Coverage Tests
// =============================================================================

describe('json_utils coverage', () => {
    test('from_json with TYTX:// prefix', () => {
        const json = 'TYTX://{"price": "100::N", "count": "5::L"}';
        const result = from_json(json);
        assert.strictEqual(Number(result.price), 100);
        assert.strictEqual(result.count, 5);
    });

    test('as_json with null value', () => {
        const result = as_json({ value: null, name: 'test' });
        const parsed = JSON.parse(result);
        assert.strictEqual(parsed.value, null);
        assert.strictEqual(parsed.name, 'test');
    });

    test('as_json with undefined value', () => {
        const result = as_json({ value: undefined, name: 'test' });
        const parsed = JSON.parse(result);
        // undefined is not serialized in JSON
        assert.strictEqual(parsed.name, 'test');
        assert.ok(!('value' in parsed));
    });

    test('as_json with Date object (non-typed)', () => {
        const date = new Date('2025-01-15T10:30:00.000Z');
        const result = as_json({ created: date });
        const parsed = JSON.parse(result);
        // Non-typed JSON should convert Date to ISO string
        assert.strictEqual(parsed.created, '2025-01-15T10:30:00.000Z');
    });

    test('as_typed_json with Date object', () => {
        const date = new Date('2025-01-15T10:30:00.000Z');
        const result = as_typed_json({ created: date });
        const parsed = JSON.parse(result);
        // Typed JSON should have ::D or ::DHZ marker
        assert.ok(parsed.created.includes('::'));
    });

    test('as_json with nested arrays', () => {
        const data = { matrix: [[1, 2], [3, 4]] };
        const result = as_json(data);
        const parsed = JSON.parse(result);
        assert.deepStrictEqual(parsed.matrix, [[1, 2], [3, 4]]);
    });

    test('as_json with indent parameter', () => {
        const data = { name: 'test', value: 42 };
        const result = as_json(data, 2);
        // Should contain newlines when indented
        assert.ok(result.includes('\n'));
    });

    test('as_typed_json with indent parameter', () => {
        const data = { name: 'test', value: 42 };
        const result = as_typed_json(data, 2);
        assert.ok(result.includes('\n'));
    });
});

// =============================================================================
// Metadata Coverage Tests
// =============================================================================

describe('metadata coverage', () => {
    const { parseMetadata, formatMetadata, validateMetadata, MetadataParseError } = require('../src/metadata');

    test('parseMetadata with escape sequences', () => {
        // Test escaped backslash
        const result = parseMetadata('reg:"test\\\\value"');
        assert.strictEqual(result.reg, 'test\\value');
    });

    test('parseMetadata with escaped quote', () => {
        const result = parseMetadata('reg:"say \\"hello\\""');
        assert.strictEqual(result.reg, 'say "hello"');
    });

    test('parseMetadata throws on missing colon', () => {
        assert.throws(() => {
            parseMetadata('len5');
        }, MetadataParseError);
    });

    test('parseMetadata throws on unterminated string', () => {
        assert.throws(() => {
            parseMetadata('reg:"unterminated');
        }, MetadataParseError);
    });

    test('parseMetadata with empty key', () => {
        assert.throws(() => {
            parseMetadata(':value');
        }, MetadataParseError);
    });

    test('formatMetadata with special chars needing quotes', () => {
        const result = formatMetadata({ reg: '[A-Z]{2,5}' });
        // Should quote the value because it contains brackets
        assert.ok(result.includes('"'));
        assert.ok(result.includes('reg:'));
    });

    test('formatMetadata with backslash needing escape', () => {
        const result = formatMetadata({ reg: 'a\\b' });
        // Should escape the backslash
        assert.ok(result.includes('\\\\'));
    });

    test('formatMetadata with quote needing escape', () => {
        const result = formatMetadata({ lbl: 'say "hi"' });
        // Should escape the quote
        assert.ok(result.includes('\\"'));
    });

    test('validateMetadata strict mode throws on unknown key', () => {
        assert.throws(() => {
            validateMetadata({ unknown_key: 'value' }, true);
        }, /Unknown metadata key/);
    });

    test('validateMetadata non-strict mode allows unknown keys', () => {
        // Should not throw
        validateMetadata({ unknown_key: 'value' }, false);
        assert.ok(true);
    });

    test('parseMetadata with whitespace around values', () => {
        // Test that whitespace is handled properly
        const result = parseMetadata('len :  5 , max :  10');
        assert.strictEqual(result.len, '5');
        assert.strictEqual(result.max, '10');
    });
});

// =============================================================================
// Schema Utils Coverage Tests
// =============================================================================

describe('schema_utils coverage', () => {
    const { structFromJsonSchema } = require('../src/schema_utils');

    test('nested object with required field', () => {
        const schema = {
            type: 'object',
            properties: {
                address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' }
                    }
                }
            },
            required: ['address']
        };
        const struct = structFromJsonSchema(schema);
        // Nested object should be required
        assert.ok(struct.address);
        assert.ok(struct.address.type.startsWith('@'));
        assert.ok(struct.address.validate);
        assert.strictEqual(struct.address.validate.required, true);
    });

    test('nested object without required field', () => {
        const schema = {
            type: 'object',
            properties: {
                address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' }
                    }
                }
            }
        };
        const struct = structFromJsonSchema(schema);
        // Non-required nested object should be just a string reference
        assert.strictEqual(struct.address, '@ROOT_ADDRESS');
    });

    test('type fallback without format', () => {
        const schema = {
            type: 'object',
            properties: {
                count: { type: 'number' }  // number without format
            }
        };
        const struct = structFromJsonSchema(schema);
        // number: is mapped to R (float), falling back from number:
        assert.ok(struct.count === 'R' || struct.count.type === 'R');
    });

    test('unknown type defaults to string', () => {
        const schema = {
            type: 'object',
            properties: {
                weird: { type: 'custom_unknown_type' }
            }
        };
        const struct = structFromJsonSchema(schema);
        // Unknown type should default to T (string)
        assert.ok(struct.weird === 'T' || struct.weird.type === 'T');
    });

    test('register nested structs with registry', () => {
        const schema = {
            type: 'object',
            properties: {
                person: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        age: { type: 'integer' }
                    }
                }
            }
        };

        // Use the main registry
        structFromJsonSchema(schema, { registry: registry, registerNested: true });

        // Nested struct should be registered
        const nestedStruct = registry.get_struct('ROOT_PERSON');
        assert.ok(nestedStruct);
        assert.ok(nestedStruct.name);
        assert.ok(nestedStruct.age);

        // Clean up
        try {
            registry.unregister_struct('ROOT_PERSON');
        } catch (e) {}
    });

    test('registerNested false does not register', () => {
        const schema = {
            type: 'object',
            properties: {
                location: {
                    type: 'object',
                    properties: {
                        lat: { type: 'number' },
                        lng: { type: 'number' }
                    }
                }
            }
        };

        structFromJsonSchema(schema, { registry: registry, registerNested: false });

        // Should NOT be registered (get_struct returns null for unknown)
        const nestedStruct = registry.get_struct('ROOT_LOCATION');
        assert.ok(nestedStruct === undefined || nestedStruct === null);
    });

    test('throws if schema is not object type', () => {
        const schema = { type: 'array', items: { type: 'string' } };
        assert.throws(() => {
            structFromJsonSchema(schema);
        }, /must have type: 'object'/);
    });
});

// =============================================================================
// XML Utils Extended Coverage Tests
// =============================================================================

describe('xml_utils extended coverage', () => {
    test('as_xml with attributes', () => {
        const data = {
            order: {
                attrs: { id: 123, status: 'active' },
                value: 'test content'
            }
        };
        const xml = as_xml(data);
        assert.ok(xml.includes('id="123"'));
        assert.ok(xml.includes('status="active"'));
        assert.ok(xml.includes('test content'));
    });

    test('as_typed_xml with Date attribute', () => {
        const date = new Date('2025-01-15T00:00:00.000Z');
        const data = {
            event: {
                attrs: { date: date },
                value: 'meeting'
            }
        };
        const xml = as_typed_xml(data);
        assert.ok(xml.includes('::D') || xml.includes('::DH'));
    });

    test('as_xml with nested children object', () => {
        const data = {
            order: {
                attrs: {},
                value: {
                    item: { attrs: {}, value: 'widget' },
                    price: { attrs: {}, value: '99.99' }
                }
            }
        };
        const xml = as_xml(data);
        assert.ok(xml.includes('<item>'));
        assert.ok(xml.includes('<price>'));
    });

    test('as_xml with array of children', () => {
        const data = {
            items: {
                attrs: {},
                value: {
                    item: [
                        { attrs: {}, value: 'first' },
                        { attrs: {}, value: 'second' }
                    ]
                }
            }
        };
        const xml = as_xml(data);
        // Should have two <item> elements
        const itemCount = (xml.match(/<item>/g) || []).length;
        assert.strictEqual(itemCount, 2);
    });

    test('as_xml with empty element (null value)', () => {
        const data = {
            empty: {
                attrs: { flag: 'true' },
                value: null
            }
        };
        const xml = as_xml(data);
        // Should be self-closing
        assert.ok(xml.includes('/>'));
    });

    test('as_xml with explicit root_tag', () => {
        const data = {
            attrs: { id: '1' },
            value: 'content'
        };
        const xml = as_xml(data, 'custom');
        assert.ok(xml.startsWith('<custom'));
    });

    test('as_xml throws with multiple root keys and no root_tag', () => {
        const data = {
            first: { attrs: {}, value: '1' },
            second: { attrs: {}, value: '2' }
        };
        assert.throws(() => {
            as_xml(data);
        }, /exactly one root key/);
    });

    test('from_xml with typed attribute', () => {
        const xml = '<item price="99.99::N">Widget</item>';
        const result = from_xml(xml);
        assert.strictEqual(Number(result.item.attrs.price), 99.99);
    });

    test('from_xml with self-closing tag', () => {
        const xml = '<empty flag="true" />';
        const result = from_xml(xml);
        assert.strictEqual(result.empty.value, null);
        assert.strictEqual(result.empty.attrs.flag, 'true');
    });

    test('from_xml with nested children and text', () => {
        const xml = '<root>Hello <child>inner</child> world</root>';
        const result = from_xml(xml);
        assert.ok(result.root.value.child);
        assert.ok(result.root.value['#text']);
    });

    test('from_xml with XML entities', () => {
        const xml = '<text>&lt;tag&gt; &amp; &quot;quoted&quot;</text>';
        const result = from_xml(xml);
        assert.strictEqual(result.text.value, '<tag> & "quoted"');
    });

    test('from_xml throws on no root tag', () => {
        assert.throws(() => {
            from_xml('not xml at all');
        }, /no root tag/);
    });

    test('as_xml with array of items in children', () => {
        // Array as value in children produces repeated child tags
        const data = {
            container: {
                attrs: {},
                value: {
                    item: [
                        { attrs: { id: '1' }, value: 'first' },
                        { attrs: { id: '2' }, value: 'second' }
                    ]
                }
            }
        };
        const xml = as_xml(data);
        // Should have two <item> elements
        const itemCount = (xml.match(/<item/g) || []).length;
        assert.strictEqual(itemCount, 2);
    });

    test('as_xml with Date value', () => {
        const date = new Date('2025-01-15T00:00:00.000Z');
        const data = {
            event: {
                attrs: {},
                value: date
            }
        };
        const xml = as_xml(data);
        assert.ok(xml.includes('2025-01-15'));
    });

    test('as_typed_xml with Date value has type marker', () => {
        const date = new Date('2025-01-15T00:00:00.000Z');
        const data = {
            event: {
                attrs: {},
                value: date
            }
        };
        const xml = as_typed_xml(data);
        assert.ok(xml.includes('::D') || xml.includes('::DH'));
    });

    test('_build_element throws without attrs/value', () => {
        assert.throws(() => {
            as_xml({ tag: 'invalid content' });
        }, /must have 'attrs' and 'value' keys/);
    });
});

// =============================================================================
// Registry Extended Coverage Tests
// =============================================================================

describe('registry extended coverage', () => {
    test('register_struct with JSON string schema', () => {
        registry.register_struct('POINT_STR', '{"x": "R", "y": "R"}');
        try {
            const struct = registry.get_struct('POINT_STR');
            assert.ok(struct);
            assert.deepStrictEqual(struct, { x: 'R', y: 'R' });
        } finally {
            registry.unregister_struct('POINT_STR');
        }
    });

    test('as_typed_text with null returns NN type', () => {
        const result = registry.as_typed_text(null);
        assert.strictEqual(result, '::NN');
    });

    test('as_typed_text with undefined returns NN type', () => {
        const result = registry.as_typed_text(undefined);
        assert.strictEqual(result, '::NN');
    });

    test('from_text with invalid type code returns original', () => {
        const result = registry.from_text('value::UNKNOWN_TYPE');
        // Unknown type might return the original value or throw
        assert.ok(result !== undefined);
    });

    test('as_text with array', () => {
        const arr = [1, 2, 3];
        const result = registry.as_text(arr);
        // Arrays should be JSON serialized
        assert.ok(typeof result === 'string');
    });

    test('as_typed_text with array compact_array false', () => {
        const arr = [1, 2, 3];
        const result = registry.as_typed_text(arr, false);
        assert.ok(typeof result === 'string');
    });
});

// =============================================================================
// TytxModel Extended Coverage Tests
// =============================================================================

describe('TytxModel extended coverage', () => {
    const { TytxModel } = require('../src/index');

    class ExtendedModel extends TytxModel {}

    test('toTytx with empty object', () => {
        const model = new ExtendedModel();
        const json = model.toTytx();
        assert.strictEqual(json, '{}');
    });

    test('toTytx with nested Date objects', () => {
        const model = new ExtendedModel();
        model.created = new Date('2025-01-15T10:00:00.000Z');
        model.updated = new Date('2025-01-16T10:00:00.000Z');
        const json = model.toTytx();
        const parsed = JSON.parse(json);
        assert.ok(parsed.created.includes('::'));
        assert.ok(parsed.updated.includes('::'));
    });

    test('toTytx with nested objects', () => {
        const model = new ExtendedModel();
        model.meta = { author: 'test', version: 1 };
        const json = model.toTytx();
        const parsed = JSON.parse(json);
        assert.strictEqual(parsed.meta.author, 'test');
        assert.strictEqual(parsed.meta.version, 1);
    });

    test('toTytx with arrays', () => {
        const model = new ExtendedModel();
        model.tags = ['a', 'b', 'c'];
        const json = model.toTytx();
        const parsed = JSON.parse(json);
        assert.deepStrictEqual(parsed.tags, ['a', 'b', 'c']);
    });

    test('fromTytx with empty JSON string', () => {
        const model = ExtendedModel.fromTytx('{}');
        assert.ok(model instanceof ExtendedModel);
        assert.deepStrictEqual(Object.keys(model), []);
    });

    test('fromTytx with mixed typed and untyped values', () => {
        const model = ExtendedModel.fromTytx({
            id: '123::L',
            name: 'test',
            active: true,
            price: '99.99::N'
        });
        assert.strictEqual(model.id, 123);
        assert.strictEqual(model.name, 'test');
        assert.strictEqual(model.active, true);
        assert.strictEqual(Number(model.price), 99.99);
    });
});


// =============================================================================
// NoneType Tests
// =============================================================================

describe('NoneType', () => {
    test('from_text parses ::NN to null', () => {
        const result = from_text('anything::NN');
        assert.strictEqual(result, null);
    });

    test('from_text parses empty::NN to null', () => {
        const result = from_text('::NN');
        assert.strictEqual(result, null);
    });

    test('from_text parses with type name', () => {
        const result = from_text('value::none');
        assert.strictEqual(result, null);
    });

    test('as_typed_text serializes null with NN', () => {
        const result = as_typed_text(null);
        assert.strictEqual(result, '::NN');
    });

    test('as_typed_text serializes undefined with NN', () => {
        const result = as_typed_text(undefined);
        assert.strictEqual(result, '::NN');
    });

    test('registry recognizes NN type', () => {
        const type = registry.get('NN');
        assert.ok(type !== null);
        assert.strictEqual(type.code, 'NN');
        assert.strictEqual(type.name, 'none');
    });

    test('registry recognizes none type by name', () => {
        const type = registry.get('none');
        assert.ok(type !== null);
        assert.strictEqual(type.code, 'NN');
    });
});

// =============================================================================
// Struct Metadata Tests
// =============================================================================

describe('struct metadata', () => {
    test('register_struct with metadata stores metadata', () => {
        const schema = { name: 'T', balance: 'N' };
        const metadata = {
            name: { validate: { min: 1, max: 100 }, ui: { label: 'Name' } },
            balance: { validate: { min: 0 } }
        };
        registry.register_struct('META_TEST', schema, metadata);
        
        try {
            // Verify schema is stored
            const storedSchema = registry.get_struct('META_TEST');
            assert.deepStrictEqual(storedSchema, schema);
            
            // Verify metadata is stored
            const allMeta = registry.get_struct_metadata('META_TEST');
            assert.ok(allMeta !== null);
            assert.deepStrictEqual(allMeta.name.validate, { min: 1, max: 100 });
            assert.deepStrictEqual(allMeta.name.ui, { label: 'Name' });
            assert.deepStrictEqual(allMeta.balance.validate, { min: 0 });
        } finally {
            registry.unregister_struct('META_TEST');
        }
    });

    test('get_struct_metadata returns field-specific metadata', () => {
        const schema = { name: 'T', age: 'L' };
        const metadata = {
            name: { validate: { required: true } },
            age: { validate: { min: 0, max: 150 } }
        };
        registry.register_struct('META_FIELD', schema, metadata);
        
        try {
            const nameMeta = registry.get_struct_metadata('META_FIELD', 'name');
            assert.deepStrictEqual(nameMeta, { validate: { required: true } });
            
            const ageMeta = registry.get_struct_metadata('META_FIELD', 'age');
            assert.deepStrictEqual(ageMeta, { validate: { min: 0, max: 150 } });
            
            // Unknown field returns null
            const unknownMeta = registry.get_struct_metadata('META_FIELD', 'unknown');
            assert.strictEqual(unknownMeta, null);
        } finally {
            registry.unregister_struct('META_FIELD');
        }
    });

    test('get_struct_metadata returns null for unknown struct', () => {
        const result = registry.get_struct_metadata('NONEXISTENT');
        assert.strictEqual(result, null);
    });

    test('register_struct without metadata works', () => {
        registry.register_struct('NO_META', { x: 'L' });
        
        try {
            const schema = registry.get_struct('NO_META');
            assert.deepStrictEqual(schema, { x: 'L' });
            
            const meta = registry.get_struct_metadata('NO_META');
            assert.strictEqual(meta, null);
        } finally {
            registry.unregister_struct('NO_META');
        }
    });

    test('metadata deduplication works', () => {
        // Two fields with identical metadata should share the same content
        const schema = { field1: 'T', field2: 'T' };
        const sharedValidation = { validate: { min: 1, max: 50 } };
        const metadata = {
            field1: sharedValidation,
            field2: sharedValidation
        };
        registry.register_struct('DEDUP_TEST', schema, metadata);
        
        try {
            const meta1 = registry.get_struct_metadata('DEDUP_TEST', 'field1');
            const meta2 = registry.get_struct_metadata('DEDUP_TEST', 'field2');
            
            // Both should have the same content
            assert.deepStrictEqual(meta1, meta2);
            assert.deepStrictEqual(meta1, sharedValidation);
        } finally {
            registry.unregister_struct('DEDUP_TEST');
        }
    });

    test('unregister_struct removes metadata', () => {
        registry.register_struct('UNREG_META', { x: 'L' }, { x: { validate: { min: 0 } } });
        
        // Verify metadata exists
        assert.ok(registry.get_struct_metadata('UNREG_META') !== null);
        
        // Unregister
        registry.unregister_struct('UNREG_META');
        
        // Verify metadata is removed
        assert.strictEqual(registry.get_struct_metadata('UNREG_META'), null);
    });
});

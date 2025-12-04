/**
 * Core tests for TYTX TypeScript implementation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  registry,
  fromJson,
  asTypedJson,
  asJson,
  TytxModel,
  isTypedString,
  extractTypeCode,
  extractValue,
  hydrateObject,
  packb,
  unpackb,
  __setMsgpackLoader,
  TYTX_EXT_TYPE,
  TypeRegistry,
  hydrateArray,
  __setBigLoader,
  getFieldType,
  getFieldValidate,
  getFieldUI,
} from '../src/index.js';

describe('registry', () => {
  describe('fromText', () => {
    it('parses integer', () => {
      expect(registry.fromText('42::L')).toBe(42);
    });

    it('parses float', () => {
      expect(registry.fromText('3.14::R')).toBe(3.14);
    });

    it('parses decimal', () => {
      const result = registry.fromText('99.99::N');
      expect(Number(result)).toBe(99.99);
    });

    it('parses boolean true', () => {
      expect(registry.fromText('true::B')).toBe(true);
    });

    it('parses boolean false', () => {
      expect(registry.fromText('false::B')).toBe(false);
    });

    it('parses date', () => {
      const result = registry.fromText('2025-01-15::D');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getFullYear()).toBe(2025);
    });

    it('parses datetime', () => {
      const result = registry.fromText('2025-01-15T10:30:00::DH');
      expect(result).toBeInstanceOf(Date);
    });

    it('returns plain string if no type', () => {
      expect(registry.fromText('hello')).toBe('hello');
    });
  });

  describe('asTypedText', () => {
    it('types integer', () => {
      expect(registry.asTypedText(42)).toBe('42::L');
    });

    it('types float', () => {
      expect(registry.asTypedText(3.14)).toBe('3.14::R');
    });

    it('types boolean', () => {
      expect(registry.asTypedText(true)).toBe('true::B');
      expect(registry.asTypedText(false)).toBe('false::B');
    });

    it('types date', () => {
      // Midnight UTC is now recognized as date-only (::D)
      const date = new Date('2025-01-15T00:00:00.000Z');
      const result = registry.asTypedText(date);
      expect(result).toBe('2025-01-15::D');
    });

    it('returns string as-is', () => {
      expect(registry.asTypedText('hello')).toBe('hello');
    });
  });
});

describe('JSON utilities', () => {
  describe('asTypedJson', () => {
    it('preserves JSON-native numbers without markers', () => {
      // JSON natively supports numbers, so they don't need TYTX markers
      const json = asTypedJson({ price: 99.99, count: 5 });
      const parsed = JSON.parse(json);
      expect(parsed.price).toBe(99.99);
      expect(parsed.count).toBe(5);
    });

    it('types dates', () => {
      // Use UTC date at midnight - now recognized as date-only (::D)
      const date = new Date('2025-01-15T00:00:00.000Z');
      const json = asTypedJson({ date });
      const parsed = JSON.parse(json);
      expect(parsed.date).toBe('2025-01-15::D');
    });

    it('handles nested objects with native types', () => {
      // Numbers are JSON-native, no markers needed
      const json = asTypedJson({
        order: { price: 100, quantity: 2 },
      });
      const parsed = JSON.parse(json);
      expect(parsed.order.price).toBe(100);
      expect(parsed.order.quantity).toBe(2);
    });
  });

  describe('fromJson', () => {
    it('hydrates typed values', () => {
      const data = fromJson<{ price: number; active: boolean }>(
        '{"price":"99.99::N","active":"true::B"}'
      );
      expect(Number(data.price)).toBe(99.99);
      expect(data.active).toBe(true);
    });

    it('hydrates dates', () => {
      const data = fromJson<{ date: Date }>('{"date":"2025-01-15::D"}');
      expect(data.date).toBeInstanceOf(Date);
    });

    it('handles nested objects', () => {
      const data = fromJson<{ order: { price: number } }>(
        '{"order":{"price":"50.00::N"}}'
      );
      expect(Number(data.order.price)).toBe(50);
    });
  });

  describe('asJson', () => {
    it('produces standard JSON', () => {
      const json = asJson({ price: 99.99, count: 5 });
      const parsed = JSON.parse(json);
      expect(parsed.price).toBe(99.99);
      expect(parsed.count).toBe(5);
    });
  });
});

describe('type utilities', () => {
  describe('isTypedString', () => {
    it('detects typed strings', () => {
      expect(isTypedString('42::L')).toBe(true);
      expect(isTypedString('hello::T')).toBe(true);
    });

    it('rejects non-typed strings', () => {
      expect(isTypedString(123 as never)).toBe(false);
      expect(isTypedString('hello')).toBe(false);
      expect(isTypedString('::L')).toBe(false);
      expect(isTypedString('')).toBe(false);
      expect(isTypedString('value::')).toBe(false);
    });
  });

  describe('extractTypeCode', () => {
    it('extracts type code', () => {
      expect(extractTypeCode('42::L')).toBe('L');
      expect(extractTypeCode('hello::TEXT')).toBe('TEXT');
    });
  });

  describe('extractValue', () => {
    it('extracts value', () => {
      expect(extractValue('42::L')).toBe('42');
      expect(extractValue('http://example.com::T')).toBe('http://example.com');
    });
  });
});

describe('TytxModel', () => {
  class Order extends TytxModel {
    price!: number;
    quantity!: number;
    name!: string;
  }

  describe('fromTytx', () => {
    it('creates instance from JSON string', () => {
      const order = Order.fromTytx(
        '{"price":"99.99::N","quantity":"5::L","name":"Widget"}'
      );

      expect(order).toBeInstanceOf(Order);
      expect(Number(order.price)).toBe(99.99);
      expect(order.quantity).toBe(5);
      expect(order.name).toBe('Widget');
    });

    it('creates instance from object', () => {
      const order = Order.fromTytx({
        price: '99.99::N',
        quantity: '5::L',
        name: 'Widget',
      });

      expect(order).toBeInstanceOf(Order);
      expect(Number(order.price)).toBe(99.99);
    });
  });

  describe('toTytx', () => {
    it('serializes instance to JSON string with native types preserved', () => {
      const order = new Order();
      order.price = 99.99;
      order.quantity = 5;
      order.name = 'Widget';

      const json = order.toTytx();
      const parsed = JSON.parse(json);

      // JSON-native types don't get markers
      expect(parsed.quantity).toBe(5);
      expect(parsed.price).toBe(99.99);
      expect(parsed.name).toBe('Widget');
    });
  });

  describe('roundtrip', () => {
    it('preserves values', () => {
      const order = new Order();
      order.price = 123.45;
      order.quantity = 10;
      order.name = 'Test';

      const json = order.toTytx();
      const restored = Order.fromTytx(json);

      expect(Number(restored.price)).toBe(123.45);
      expect(restored.quantity).toBe(10);
      expect(restored.name).toBe('Test');
    });
  });

  describe('inheritance', () => {
    it('works correctly', () => {
      class Payment extends TytxModel {
        amount!: number;
      }

      const payment = Payment.fromTytx('{"amount":"500.00::N"}');
      expect(payment).toBeInstanceOf(Payment);
      expect(payment).toBeInstanceOf(TytxModel);
      expect(Number(payment.amount)).toBe(500);
    });
  });

  it('_getProperties ignores functions', () => {
    class WithFn extends TytxModel {
      value = 1;
      fn() {
        return 2;
      }
    }
    const obj = new WithFn();
    const props = obj['_getProperties']();
    expect(props).toEqual({ value: 1 });
  });

  it('fetchTytx uses fetch and hydrates json', async () => {
    const payload = { price: '1::L' };
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(payload),
    });
    // @ts-expect-error override global fetch
    globalThis.fetch = mockFetch;

    const order = await Order.fetchTytx('http://example.test');
    expect(order.price).toBe(1);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('fetchTytxArray validates array', async () => {
    const payload = [{ price: '1::L' }];
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(payload),
    });
    // @ts-expect-error override global fetch
    globalThis.fetch = mockFetch;

    const orders = await Order.fetchTytxArray('http://example.test');
    expect(orders[0].price).toBe(1);
  });

  it('fetchTytxArray throws on non-array', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ not: 'array' }),
    });
    // @ts-expect-error override global fetch
    globalThis.fetch = mockFetch;

    await expect(Order.fetchTytxArray('http://example.test')).rejects.toThrow(
      /Expected array response/
    );
  });

  it('fetchTytxMsgpack and fetchTytxMsgpackArray hydrate', async () => {
    const item = new Order();
    item.price = 5;
    item.quantity = 1;
    item.name = 'X';
    const packedOne = item.toTytxMsgpack();
    const packedMany = packb([{ price: 2, quantity: 1, name: 'Y' }]);

    const mockFetchOne = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(
        packedOne.buffer.slice(packedOne.byteOffset, packedOne.byteOffset + packedOne.byteLength)
      ),
    });
    const mockFetchMany = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(
        packedMany.buffer.slice(packedMany.byteOffset, packedMany.byteOffset + packedMany.byteLength)
      ),
    });

    // @ts-expect-error override global fetch
    globalThis.fetch = mockFetchOne;
    const restored = await Order.fetchTytxMsgpack('http://example.test');
    expect(restored.price).toBe(5);

    // @ts-expect-error override global fetch
    globalThis.fetch = mockFetchMany;
    const restoredMany = await Order.fetchTytxMsgpackArray('http://example.test');
    expect(restoredMany[0].price).toBe(2);
  });

  it('fetchTytxMsgpackArray throws on non-array', async () => {
    const packed = packb({ not: 'array' });
    const mockFetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(
        packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength)
      ),
    });
    // @ts-expect-error override global fetch
    globalThis.fetch = mockFetch;

    await expect(Order.fetchTytxMsgpackArray('http://example.test')).rejects.toThrow(
      /Expected array response/
    );
  });
});

describe('additional registry tests', () => {
  it('parses time type', () => {
    // Time is now returned as Date on epoch (1970-01-01) UTC
    const result = registry.fromText('10:30:00::H');
    expect(result).toBeInstanceOf(Date);
    const date = result as Date;
    expect(date.getUTCHours()).toBe(10);
    expect(date.getUTCMinutes()).toBe(30);
    expect(date.getUTCSeconds()).toBe(0);
    // Epoch date
    expect(date.getUTCFullYear()).toBe(1970);
    expect(date.getUTCMonth()).toBe(0);
    expect(date.getUTCDate()).toBe(1);
  });

  it('parses TYTX type', () => {
    const result = registry.fromText('{"a":1}::TYTX');
    expect(result).toEqual({ a: 1 });
  });

  it('parses with explicit type code', () => {
    const result = registry.fromText('42', 'L');
    expect(result).toBe(42);
  });

  it('parses with unknown type code returns string', () => {
    const result = registry.fromText('42::UNKNOWN');
    expect(result).toBe('42::UNKNOWN');
  });

  it('parses with explicit unknown type code returns original', () => {
    const result = registry.fromText('42', 'ZZ' as never);
    expect(result).toBe('42');
  });

  it('asText handles null and undefined', () => {
    expect(registry.asText(null as never)).toBe('null');
    expect(registry.asText(undefined as never)).toBe('undefined');
  });

  it('asTypedText handles null and undefined', () => {
    expect(registry.asTypedText(null as never)).toBe('null');
    expect(registry.asTypedText(undefined as never)).toBe('undefined');
  });

  it('asTypedText handles bigint', () => {
    expect(registry.asTypedText(BigInt(123))).toBe('123::L');
  });

  it('asTypedText handles object/array as TYTX', () => {
    expect(registry.asTypedText({ a: 1 })).toBe('{"a":1}::TYTX');
    expect(registry.asTypedText([1, 2, 3])).toBe('[1,2,3]::TYTX');
  });

  it('asText handles date/time/datetime branches', () => {
    const time = new Date('1970-01-01T10:00:00Z');
    expect(registry.asText(time)).toBe('10:00:00');

    const date = new Date('2025-01-15T00:00:00Z');
    expect(registry.asText(date)).toBe('2025-01-15');

    const dt = new Date('2025-01-15T10:00:00Z');
    expect(registry.asText(dt)).toContain('T10:00:00');

    expect(registry.asText(123)).toBe('123');
  });

  it('isTyped checks if string has known type', () => {
    expect(registry.isTyped('42::L')).toBe(true);
    expect(registry.isTyped('hello')).toBe(false);
    expect(registry.isTyped('42::UNKNOWN')).toBe(false);
  });

  it('get returns type by code', () => {
    expect(registry.get('L')).toBeDefined();
    expect(registry.get('D')).toBeDefined();
    expect(registry.get('DHZ')).toBeDefined();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('TypeRegistry can be instantiated', () => {
    const reg = new TypeRegistry();
    expect(reg.fromText('42::L')).toBe(42);
  });

  it('compact array serialization and mixed fallback', () => {
    // homogeneous ints -> compact (values serialized as strings for consistency)
    const compact = registry.asTypedText([1, 2, 3], true);
    expect(compact).toBe('["1","2","3"]::L');

    // mixed types -> falls back to element typing
    const mixed = registry.asTypedText([1, 'a'], true);
    expect(mixed).toContain('::L');
    expect(mixed).toContain('a');
    expect(mixed.startsWith('[')).toBe(true);
  });

  it('parse typed array recursively', () => {
    const reg = new TypeRegistry();
    const result = reg.fromText('[[1,2],[3,4]]::L') as number[][];
    expect(result).toEqual([[1, 2], [3, 4]]);
  });

  it('compact array empty and missing type mapping fallback', () => {
    expect(registry.asTypedText([], true)).toBe('[]');

    const reg = new TypeRegistry();
    // @ts-expect-error private access for test
    reg['codeToType'].delete('L');
    const fallback = reg.asTypedText([1, 2], true);
    expect(fallback).toContain('::L');
  });

  it('compact array detects mixed numeric types and datetime/time leaves', () => {
    // mixed int/float -> not homogeneous
    const mixedNumeric = registry.asTypedText([1, 1.5], true);
    expect(mixedNumeric).toContain('::L');
    expect(mixedNumeric).toContain('::R');

    const times = [new Date('1970-01-01T10:00:00Z'), new Date('1970-01-01T11:00:00Z')];
    const compactTimes = registry.asTypedText(times, true);
    expect(compactTimes.endsWith('::H')).toBe(true);

    const dates = [new Date('2025-01-01T00:00:00Z')];
    const compactDates = registry.asTypedText(dates, true);
    expect(compactDates.endsWith('::D')).toBe(true);

    const datetimes = [new Date('2025-01-01T10:00:00Z'), new Date('2025-01-02T12:00:00Z')];
    const compactDh = registry.asTypedText(datetimes, true);
    expect(compactDh.endsWith('::DHZ')).toBe(true);

    const nested = registry.asTypedText([[1, 2], [3, 4]], true);
    expect(nested).toContain('::L');
    expect(nested.startsWith('[')).toBe(true);

    const nestedMixed = registry.asTypedText([[1, 'x']], true);
    expect(nestedMixed).toContain('::L');
    expect(nestedMixed).toContain('x');

    const timeTyped = registry.asTypedText(new Date('1970-01-01T10:00:00Z'));
    expect(timeTyped.endsWith('::H')).toBe(true);

    const bools = registry.asTypedText([true, false], true);
    expect(bools.endsWith('::B')).toBe(true);
  });

  it('naive datetime type serialization', () => {
    const type = registry.get('DH');
    expect(type).toBeDefined();
    const dt = new Date('2025-01-01T10:00:00Z');
    expect(type?.parse('2025-01-01T10:00:00')).toBeInstanceOf(Date);
    expect(type?.serialize(dt)).toBe('2025-01-01T10:00:00');
  });

  it('DateTimeType isType handles midnight/epoch/non-midnight', () => {
    const type = registry.get('DHZ');
    expect(type?.isType?.(new Date('2025-01-01T00:00:00Z'))).toBe(false);
    expect(type?.isType?.(new Date('1970-01-01T00:00:00Z'))).toBe(false);
    expect(type?.isType?.(new Date('2025-01-01T10:00:00Z'))).toBe(true);
  });

  it('TytxType isType and DecimalType fallback without big.js', () => {
    const tytxType = registry.get('TYTX');
    expect(tytxType?.isType?.({ a: 1 })).toBe(true);
    expect(tytxType?.isType?.(null)).toBe(false);

    __setBigLoader(() => {
      throw new Error('no big');
    });
    const decimalType = registry.get('N');
    expect(decimalType?.parse('1.23')).toBe(1.23);
    __setBigLoader(null);
  });

  it('built-in isType helpers', () => {
    const intType = registry.get('L');
    expect(intType?.isType?.(1)).toBe(true);
    expect(intType?.isType?.(1.5)).toBe(false);
    expect(intType?.isType?.('1' as never)).toBe(false);

    const floatType = registry.get('R');
    expect(floatType?.isType?.(1.5)).toBe(true);
    expect(floatType?.isType?.(1)).toBe(false);

    const decimalType = registry.get('N');
    expect(decimalType?.isType?.(1.2)).toBe(true);
    expect(decimalType?.isType?.(BigInt(1))).toBe(true);
    expect(decimalType?.isType?.('1' as never)).toBe(false);

    const boolType = registry.get('B');
    expect(boolType?.isType?.(true)).toBe(true);
    expect(boolType?.isType?.('true' as never)).toBe(false);

    const dateType = registry.get('D');
    expect(dateType?.isType?.(new Date('2025-01-01T00:00:00Z'))).toBe(true);
    expect(dateType?.isType?.(new Date('1970-01-01T00:00:00Z'))).toBe(false);
    expect(dateType?.isType?.('2025-01-01' as never)).toBe(false);

    const dtType = registry.get('DHZ');
    expect(dtType?.isType?.('not-a-date' as never)).toBe(false);

    const timeType = registry.get('H');
    expect(timeType?.isType?.('10:00:00' as never)).toBe(false);

    const bigintCode = (registry as unknown as { getTypeCodeForValue: (v: unknown) => string | null })
      .getTypeCodeForValue(BigInt(2));
    expect(bigintCode).toBe('L');
  });
});

describe('additional JSON tests', () => {
  it('hydrateObject works directly', () => {
    const result = hydrateObject<{ price: number }>({ price: '99.99::N' });
    expect(Number(result.price)).toBe(99.99);
  });

  it('asTypedJson with indent option', () => {
    const json = asTypedJson({ a: 1 }, { indent: 2 });
    expect(json).toContain('\n');
  });

  it('asJson with indent option', () => {
    const json = asJson({ a: 1 }, { indent: 2 });
    expect(json).toContain('\n');
  });

  it('handles null values', () => {
    const json = asTypedJson({ value: null });
    expect(JSON.parse(json).value).toBe(null);
  });

  it('handles arrays with native types', () => {
    // Numbers are JSON-native, no markers needed
    const json = asTypedJson([1, 2, 3]);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([1, 2, 3]);
  });

  it('asJson serializes dates without typing', () => {
    const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));
    const json = asJson({ date });
    const parsed = JSON.parse(json);
    expect(parsed.date).toBe(date.toISOString());
  });

  it('fromJson handles arrays', () => {
    const result = fromJson<number[]>('["1::L","2::L","3::L"]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('hydrateArray hydrates nested typed values', () => {
    const result = hydrateArray(['1::L', ['2::L']]);
    expect(result).toEqual([1, [2]]);
  });
});

describe('MessagePack tests', () => {
  it('TYTX_EXT_TYPE is 42', () => {
    expect(TYTX_EXT_TYPE).toBe(42);
  });

  it('packb and unpackb roundtrip', () => {
    const data = { price: 99.99, count: 5, name: 'Test' };
    const packed = packb(data);
    expect(packed).toBeInstanceOf(Uint8Array);

    const unpacked = unpackb<typeof data>(packed);
    expect(unpacked.count).toBe(5);
    expect(unpacked.name).toBe('Test');
  });

  it('packb handles dates', () => {
    const date = new Date(Date.UTC(2025, 0, 15, 10, 30, 0));
    const packed = packb({ date });
    const unpacked = unpackb<{ date: Date }>(packed);
    expect(unpacked.date).toBeInstanceOf(Date);
  });

  it('packb handles arrays with types', () => {
    const data = [1, 2, 3];
    const packed = packb(data);
    const unpacked = unpackb<number[]>(packed);
    expect(unpacked).toEqual([1, 2, 3]);
  });

  it('packb with plain string (no TYTX types)', () => {
    const data = 'hello';
    const packed = packb(data);
    const unpacked = unpackb<string>(packed);
    expect(unpacked).toBe('hello');
  });

  it('unpackb handles ArrayBuffer input', () => {
    const data = { value: 42 };
    const packed = packb(data);
    const arrayBuffer = packed.buffer.slice(
      packed.byteOffset,
      packed.byteOffset + packed.byteLength
    ) as ArrayBuffer;
    const unpacked = unpackb<typeof data>(arrayBuffer);
    expect(unpacked.value).toBe(42);
  });

  it('packb throws when msgpack missing', () => {
    // Force loader to throw to hit error branch
    __setMsgpackLoader(() => {
      throw new Error('missing');
    });

    expect(() => packb({ a: 1 })).toThrow(/@msgpack\/msgpack is required/);

    __setMsgpackLoader(null);
  });
});


describe('TytxModel MessagePack', () => {
  class Item extends TytxModel {
    name!: string;
    price!: number;
  }

  it('toTytxMsgpack serializes to bytes', () => {
    const item = new Item();
    item.name = 'Widget';
    item.price = 99.99;

    const packed = item.toTytxMsgpack();
    expect(packed).toBeInstanceOf(Uint8Array);
  });

  it('fromTytxMsgpack deserializes', () => {
    const item = new Item();
    item.name = 'Widget';
    item.price = 99.99;

    const packed = item.toTytxMsgpack();
    const restored = Item.fromTytxMsgpack(packed) as Item;

    expect(restored).toBeInstanceOf(Item);
    expect(restored.name).toBe('Widget');
  });
});

// =============================================================================
// Struct Schema Tests
// =============================================================================

describe('struct schemas', () => {
  describe('register_struct', () => {
    it('registers dict schema', () => {
      registry.register_struct('TEST_DICT', { name: 'T', value: 'L' });
      const schema = registry.get_struct('TEST_DICT');
      expect(schema).toEqual({ name: 'T', value: 'L' });
      registry.unregister_struct('TEST_DICT');
    });

    it('registers list schema', () => {
      registry.register_struct('TEST_LIST', ['T', 'L', 'N']);
      const schema = registry.get_struct('TEST_LIST');
      expect(schema).toEqual(['T', 'L', 'N']);
      registry.unregister_struct('TEST_LIST');
    });

    it('registers JSON string schema', () => {
      // New format: JSON string schema
      registry.register_struct('TEST_STR', '{"x": "R", "y": "R"}');
      const schema = registry.get_struct('TEST_STR');
      expect(schema).toEqual({ x: 'R', y: 'R' });
      registry.unregister_struct('TEST_STR');
    });

    it('unregister removes struct', () => {
      registry.register_struct('TEMP', ['L']);
      expect(registry.get_struct('TEMP')).not.toBeUndefined();
      registry.unregister_struct('TEMP');
      expect(registry.get_struct('TEMP')).toBeUndefined();
    });
  });

  describe('dict schema', () => {
    it('applies types to matching keys', () => {
      registry.register_struct('CUSTOMER', { name: 'T', balance: 'N', age: 'L' });
      try {
        const result = registry.fromText('{"name": "Acme", "balance": "100.50", "age": "25"}::@CUSTOMER') as Record<string, unknown>;
        expect(result.name).toBe('Acme');
        expect((result.balance as { toString(): string }).toString()).toBe('100.5');
        expect(result.age).toBe(25);
      } finally {
        registry.unregister_struct('CUSTOMER');
      }
    });

    it('extra keys pass through unchanged', () => {
      registry.register_struct('ITEM', { price: 'N' });
      try {
        const result = registry.fromText('{"price": "99.99", "note": "test"}::@ITEM') as Record<string, unknown>;
        expect((result.price as { toString(): string }).toString()).toBe('99.99');
        expect(result.note).toBe('test');
      } finally {
        registry.unregister_struct('ITEM');
      }
    });
  });

  describe('list schema positional', () => {
    it('applies type at index i to data[i]', () => {
      registry.register_struct('ROW', ['T', 'L', 'N']);
      try {
        const result = registry.fromText('["Product", 2, "100.50"]::@ROW') as unknown[];
        expect(result[0]).toBe('Product');
        expect(result[1]).toBe(2);
        expect((result[2] as { toString(): string }).toString()).toBe('100.5');
      } finally {
        registry.unregister_struct('ROW');
      }
    });

    it('array of rows applies positional to each', () => {
      registry.register_struct('ROW', ['T', 'L', 'N']);
      try {
        const result = registry.fromText('[["A", 1, "10"], ["B", 2, "20"]]::@ROW') as unknown[][];
        expect(result[0][0]).toBe('A');
        expect(result[0][1]).toBe(1);
        expect((result[0][2] as { toString(): string }).toString()).toBe('10');
        expect(result[1][0]).toBe('B');
        expect(result[1][1]).toBe(2);
        expect((result[1][2] as { toString(): string }).toString()).toBe('20');
      } finally {
        registry.unregister_struct('ROW');
      }
    });
  });

  describe('list schema homogeneous', () => {
    it('single type applies to all elements', () => {
      registry.register_struct('PRICES', ['N']);
      try {
        const result = registry.fromText('[100, 200, "50.25"]::@PRICES') as unknown[];
        expect((result[0] as { toString(): string }).toString()).toBe('100');
        expect((result[1] as { toString(): string }).toString()).toBe('200');
        expect((result[2] as { toString(): string }).toString()).toBe('50.25');
      } finally {
        registry.unregister_struct('PRICES');
      }
    });

    it('empty array returns empty', () => {
      registry.register_struct('NUMS', ['L']);
      try {
        const result = registry.fromText('[]::@NUMS');
        expect(result).toEqual([]);
      } finally {
        registry.unregister_struct('NUMS');
      }
    });

    it('nested 2D array applies to leaves', () => {
      registry.register_struct('MATRIX', ['L']);
      try {
        const result = registry.fromText('[[1, 2], [3, 4]]::@MATRIX');
        expect(result).toEqual([[1, 2], [3, 4]]);
      } finally {
        registry.unregister_struct('MATRIX');
      }
    });
  });

  describe('JSON string schema', () => {
    it('JSON dict schema produces dict output', () => {
      // New format: JSON string schema (D1: only valid JSON accepted)
      registry.register_struct('POINT', '{"x": "R", "y": "R"}');
      try {
        const result = registry.fromText('{"x": "3.7", "y": "7.3"}::@POINT');
        expect(result).toEqual({ x: 3.7, y: 7.3 });
      } finally {
        registry.unregister_struct('POINT');
      }
    });

    it('JSON array schema produces list output', () => {
      registry.register_struct('COORDS', '["R", "R"]');
      try {
        const result = registry.fromText('["3.7", "7.3"]::@COORDS');
        expect(result).toEqual([3.7, 7.3]);
      } finally {
        registry.unregister_struct('COORDS');
      }
    });

    it('preserves field order from JSON', () => {
      registry.register_struct('CSV_ROW', '{"name": "T", "qty": "L", "price": "N"}');
      try {
        const result = registry.fromText('{"name": "Widget", "qty": "10", "price": "99.99"}::@CSV_ROW') as Record<string, unknown>;
        expect(result.name).toBe('Widget');
        expect(result.qty).toBe(10);
        expect((result.price as { toString(): string }).toString()).toBe('99.99');
        expect(Object.keys(result)).toEqual(['name', 'qty', 'price']);
      } finally {
        registry.unregister_struct('CSV_ROW');
      }
    });

    it('invalid JSON throws error', () => {
      // Old format "x:R,y:R" is no longer valid
      expect(() => registry.register_struct('INVALID', 'x:R,y:R')).toThrow('Invalid JSON schema');
    });
  });

  describe('array of structs (#@)', () => {
    it('batch mode with JSON dict schema', () => {
      registry.register_struct('ROW', '{"name": "T", "qty": "L", "price": "N"}');
      try {
        const result = registry.fromText('[{"name": "A", "qty": "1", "price": "10"}, {"name": "B", "qty": "2", "price": "20"}]::#@ROW') as Record<string, unknown>[];
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('A');
        expect(result[0].qty).toBe(1);
        expect((result[0].price as { toString(): string }).toString()).toBe('10');
        expect(result[1].name).toBe('B');
        expect(result[1].qty).toBe(2);
        expect((result[1].price as { toString(): string }).toString()).toBe('20');
      } finally {
        registry.unregister_struct('ROW');
      }
    });

    it('batch mode with JSON array schema', () => {
      registry.register_struct('PAIR', '["R", "R"]');
      try {
        const result = registry.fromText('[["1.5", "2.5"], ["3.5", "4.5"]]::#@PAIR');
        expect(result).toEqual([[1.5, 2.5], [3.5, 4.5]]);
      } finally {
        registry.unregister_struct('PAIR');
      }
    });

    it('batch mode with object schema (legacy)', () => {
      registry.register_struct('ITEM', { name: 'T', value: 'L' });
      try {
        const result = registry.fromText('[{"name": "A", "value": "1"}, {"name": "B", "value": "2"}]::#@ITEM') as Record<string, unknown>[];
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('A');
        expect(result[0].value).toBe(1);
        expect(result[1].name).toBe('B');
        expect(result[1].value).toBe(2);
      } finally {
        registry.unregister_struct('ITEM');
      }
    });
  });

  describe('struct v2 object-style fields', () => {
    it('simple string fields still work (backward compatible)', () => {
      registry.register_struct('SIMPLE', { name: 'T', age: 'L' });
      try {
        const result = registry.fromText('{"name": "John", "age": "30"}::@SIMPLE') as Record<string, unknown>;
        expect(result.name).toBe('John');
        expect(result.age).toBe(30);
      } finally {
        registry.unregister_struct('SIMPLE');
      }
    });

    it('object field with type only', () => {
      registry.register_struct('OBJ_TYPE', {
        name: { type: 'T' },
        price: { type: 'N' }
      });
      try {
        const result = registry.fromText('{"name": "Widget", "price": "99.99"}::@OBJ_TYPE') as Record<string, unknown>;
        expect(result.name).toBe('Widget');
        expect((result.price as { toString(): string }).toString()).toBe('99.99');
      } finally {
        registry.unregister_struct('OBJ_TYPE');
      }
    });

    it('object field with validate section', () => {
      registry.register_struct('WITH_VALIDATE', {
        name: { type: 'T', validate: { min: 1, max: 100 } },
        age: { type: 'L', validate: { min: 0, max: 120 } }
      });
      try {
        const result = registry.fromText('{"name": "Alice", "age": "25"}::@WITH_VALIDATE') as Record<string, unknown>;
        expect(result.name).toBe('Alice');
        expect(result.age).toBe(25);
      } finally {
        registry.unregister_struct('WITH_VALIDATE');
      }
    });

    it('object field with ui section', () => {
      registry.register_struct('WITH_UI', {
        email: {
          type: 'T',
          ui: { label: 'Email Address', placeholder: 'user@example.com' }
        }
      });
      try {
        const result = registry.fromText('{"email": "test@test.com"}::@WITH_UI') as Record<string, unknown>;
        expect(result.email).toBe('test@test.com');
      } finally {
        registry.unregister_struct('WITH_UI');
      }
    });

    it('object field with type, validate, and ui', () => {
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
        const result = registry.fromText('{"username": "john_doe", "balance": "1000.50"}::@FULL_FIELD') as Record<string, unknown>;
        expect(result.username).toBe('john_doe');
        expect((result.balance as { toString(): string }).toString()).toBe('1000.5');
      } finally {
        registry.unregister_struct('FULL_FIELD');
      }
    });

    it('mixed string and object fields', () => {
      registry.register_struct('MIXED', {
        id: 'L',
        name: { type: 'T', ui: { label: 'Full Name' } },
        active: 'B'
      });
      try {
        const result = registry.fromText('{"id": "123", "name": "Test", "active": "true"}::@MIXED') as Record<string, unknown>;
        expect(result.id).toBe(123);
        expect(result.name).toBe('Test');
        expect(result.active).toBe(true);
      } finally {
        registry.unregister_struct('MIXED');
      }
    });

    it('list schema with object fields', () => {
      registry.register_struct('ROW_V2', [
        { type: 'T', ui: { label: 'Name' } },
        { type: 'L', validate: { min: 0 } },
        { type: 'N', ui: { format: 'currency' } }
      ]);
      try {
        const result = registry.fromText('["Product", "10", "99.99"]::@ROW_V2') as unknown[];
        expect(result[0]).toBe('Product');
        expect(result[1]).toBe(10);
        expect((result[2] as { toString(): string }).toString()).toBe('99.99');
      } finally {
        registry.unregister_struct('ROW_V2');
      }
    });

    it('list schema with mixed fields', () => {
      registry.register_struct('ROW_MIXED', [
        'T',
        { type: 'L', validate: { min: 1 } },
        'N'
      ]);
      try {
        const result = registry.fromText('["Item", "5", "50.00"]::@ROW_MIXED') as unknown[];
        expect(result[0]).toBe('Item');
        expect(result[1]).toBe(5);
        expect((result[2] as { toString(): string }).toString()).toBe('50');
      } finally {
        registry.unregister_struct('ROW_MIXED');
      }
    });

    it('homogeneous list with object field', () => {
      registry.register_struct('PRICES_V2', [{ type: 'N', validate: { min: 0 } }]);
      try {
        const result = registry.fromText('["10.00", "20.50", "30.99"]::@PRICES_V2') as unknown[];
        expect((result[0] as { toString(): string }).toString()).toBe('10');
        expect((result[1] as { toString(): string }).toString()).toBe('20.5');
        expect((result[2] as { toString(): string }).toString()).toBe('30.99');
      } finally {
        registry.unregister_struct('PRICES_V2');
      }
    });

    it('object field without type defaults to T', () => {
      registry.register_struct('DEFAULT_TYPE', {
        note: { ui: { label: 'Notes' } }
      });
      try {
        const result = registry.fromText('{"note": "Hello"}::@DEFAULT_TYPE') as Record<string, unknown>;
        expect(result.note).toBe('Hello');
      } finally {
        registry.unregister_struct('DEFAULT_TYPE');
      }
    });

    it('nested struct reference in object field', () => {
      registry.register_struct('ADDR_V2', {
        city: { type: 'T', ui: { label: 'City' } },
        zip: 'L'
      });
      registry.register_struct('PERSON_V2', {
        name: { type: 'T', validate: { min: 1 } },
        address: { type: '@ADDR_V2' }
      });
      try {
        const result = registry.fromText('{"name": "John", "address": {"city": "Rome", "zip": "12345"}}::@PERSON_V2') as Record<string, unknown>;
        expect(result.name).toBe('John');
        const addr = result.address as Record<string, unknown>;
        expect(addr.city).toBe('Rome');
        expect(addr.zip).toBe(12345);
      } finally {
        registry.unregister_struct('PERSON_V2');
        registry.unregister_struct('ADDR_V2');
      }
    });
  });

  describe('field helper functions', () => {
    it('getFieldType returns string directly for string fields', () => {
      expect(getFieldType('T')).toBe('T');
      expect(getFieldType('N')).toBe('N');
      expect(getFieldType('@PERSON')).toBe('@PERSON');
    });

    it('getFieldType extracts type from object field', () => {
      expect(getFieldType({ type: 'T' })).toBe('T');
      expect(getFieldType({ type: 'N', validate: { min: 0 } })).toBe('N');
      expect(getFieldType({ type: '@ADDR', ui: { label: 'Address' } })).toBe('@ADDR');
    });

    it('getFieldType returns T when type not specified', () => {
      expect(getFieldType({ ui: { label: 'Notes' } })).toBe('T');
      expect(getFieldType({})).toBe('T');
    });

    it('getFieldValidate returns undefined for string fields', () => {
      expect(getFieldValidate('T')).toBeUndefined();
      expect(getFieldValidate('N[min:0]')).toBeUndefined();
    });

    it('getFieldValidate extracts validate from object field', () => {
      const validate = getFieldValidate({
        type: 'T',
        validate: { min: 1, max: 100, pattern: '^[a-z]+$' }
      });
      expect(validate).toEqual({ min: 1, max: 100, pattern: '^[a-z]+$' });
    });

    it('getFieldValidate returns undefined when validate not present', () => {
      expect(getFieldValidate({ type: 'T' })).toBeUndefined();
      expect(getFieldValidate({ type: 'T', ui: { label: 'Name' } })).toBeUndefined();
    });

    it('getFieldUI returns undefined for string fields', () => {
      expect(getFieldUI('T')).toBeUndefined();
      expect(getFieldUI('T[lbl:Name]')).toBeUndefined();
    });

    it('getFieldUI extracts ui from object field', () => {
      const ui = getFieldUI({
        type: 'T',
        ui: { label: 'Full Name', placeholder: 'Enter name', readonly: true }
      });
      expect(ui).toEqual({ label: 'Full Name', placeholder: 'Enter name', readonly: true });
    });

    it('getFieldUI returns undefined when ui not present', () => {
      expect(getFieldUI({ type: 'T' })).toBeUndefined();
      expect(getFieldUI({ type: 'T', validate: { min: 1 } })).toBeUndefined();
    });
  });

  describe('register_class', () => {
    it('throws when class lacks as_typed_text method', () => {
      const reg = new TypeRegistry();
      // Class without as_typed_text instance method
      class NoSerialize {
        static from_typed_text(_s: string) { return new NoSerialize(); }
      }
      expect(() => reg.register_class('NOSER', NoSerialize)).toThrow(
        /must have as_typed_text\(\) method/
      );
    });

    it('throws when class lacks from_typed_text static method', () => {
      const reg = new TypeRegistry();
      // Class with instance method but no static parse
      class NoParse {
        as_typed_text() { return 'value'; }
      }
      expect(() => reg.register_class('NOPARSE', NoParse)).toThrow(
        /must have static from_typed_text\(\) method/
      );
    });

    it('auto-detects serialize and parse from class methods', () => {
      const reg = new TypeRegistry();
      class Point {
        x = 0;
        y = 0;
        as_typed_text() { return `${this.x},${this.y}`; }
        static from_typed_text(s: string): Point {
          const [x, y] = s.split(',').map(Number);
          const p = new Point();
          p.x = x;
          p.y = y;
          return p;
        }
      }
      reg.register_class('POINT', Point as never);

      // Test parsing
      const parsed = reg.fromText('5,6::~POINT') as unknown as Point;
      expect(parsed).toBeInstanceOf(Point);
      expect(parsed.x).toBe(5);
      expect(parsed.y).toBe(6);

      reg.unregister_class('POINT');
    });

    it('unregister_class removes the custom type', () => {
      const reg = new TypeRegistry();
      class Custom {
        as_typed_text() { return 'x'; }
        static from_typed_text(_s: string) { return new Custom(); }
      }
      reg.register_class('CUST', Custom);
      expect(reg.get('~CUST')).toBeDefined();

      reg.unregister_class('CUST');
      expect(reg.get('~CUST')).toBeUndefined();
    });

    it('getTypeCodeForValue returns custom type code for registered class', () => {
      const reg = new TypeRegistry();
      class MyType {
        as_typed_text() { return 'val'; }
        static from_typed_text(_s: string) { return new MyType(); }
      }
      reg.register_class('MYTYPE', MyType as never);

      const instance = new MyType();
      // Test that compact array detects custom type
      const result = reg.asTypedText([instance] as never, true);
      expect(result).toBe('["val"]::~MYTYPE');

      reg.unregister_class('MYTYPE');
    });
  });

  describe('applyListSchema edge cases', () => {
    it('returns data unchanged when data is not array', () => {
      // When list schema is applied to non-array data
      registry.register_struct('LIST_SCHEMA', ['L', 'T']);
      try {
        // Pass non-array data through struct - schema won't apply
        const result = registry.fromText('"not an array"::@LIST_SCHEMA');
        // Should return the parsed string unchanged
        expect(result).toBe('not an array');
      } finally {
        registry.unregister_struct('LIST_SCHEMA');
      }
    });
  });

  describe('additional coverage tests', () => {
    it('applyPositional covers data longer than schema', () => {
      // Positional schema shorter than data - extra elements pass through
      registry.register_struct('SHORT_POS', ['L', 'T']);
      try {
        const result = registry.fromText('["1", "hello", "extra", "more"]::@SHORT_POS') as unknown[];
        expect(result[0]).toBe(1);
        expect(result[1]).toBe('hello');
        expect(result[2]).toBe('extra'); // unchanged
        expect(result[3]).toBe('more'); // unchanged
      } finally {
        registry.unregister_struct('SHORT_POS');
      }
    });

    it('hydrateValue with struct reference to missing struct', () => {
      // Struct reference @MISSING not registered
      registry.register_struct('HAS_MISSING_REF', { data: '@MISSING_STRUCT' });
      try {
        const result = registry.fromText('{"data": {"inner": 1}}::@HAS_MISSING_REF') as Record<string, unknown>;
        // Should return value unchanged since @MISSING_STRUCT not found
        expect(result.data).toEqual({ inner: 1 });
      } finally {
        registry.unregister_struct('HAS_MISSING_REF');
      }
    });

    it('hydrateValue returns original for unknown type code', () => {
      registry.register_struct('UNKNOWN_TYPE_SCHEMA', { x: 'UNKNOWN_CODE' });
      try {
        const result = registry.fromText('{"x": "some_value"}::@UNKNOWN_TYPE_SCHEMA') as Record<string, unknown>;
        // Unknown type code should leave value unchanged
        expect(result.x).toBe('some_value');
      } finally {
        registry.unregister_struct('UNKNOWN_TYPE_SCHEMA');
      }
    });

    it('getTypeCodeForValue with string returns null', () => {
      // String type code is null (no typing needed)
      // @ts-expect-error - testing private method
      const code = registry.getTypeCodeForValue('hello');
      expect(code).toBeNull();
    });

    it('getTypeCodeForValue with null object', () => {
      // Objects without constructor don't match custom types
      // @ts-expect-error - testing private method
      const code = registry.getTypeCodeForValue({ x: 1, y: 2 });
      expect(code).toBeNull();
    });

    it('collectLeafTypes with nested arrays', () => {
      // Test deep nesting for collectLeafTypes
      const nested = [[[1, 2], [3, 4]], [[5, 6]]];
      const result = registry.asTypedText(nested, true);
      expect(result).toContain('::L');
    });

    it('serializeLeaf with nested arrays', () => {
      // Force serializeLeaf to process nested arrays
      const deep = [[[[1]]]];
      const result = registry.asTypedText(deep, true);
      expect(result).toContain('::L');
    });
  });
});

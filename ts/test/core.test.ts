/**
 * Core tests for TYTX TypeScript implementation.
 */

import { describe, it, expect } from 'vitest';
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
  TYTX_EXT_TYPE,
  TypeRegistry,
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
      expect(isTypedString('hello')).toBe(false);
      expect(isTypedString('::L')).toBe(false);
      expect(isTypedString('')).toBe(false);
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

  it('parses JSON type', () => {
    const result = registry.fromText('{"a":1}::JS');
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

  it('asTypedText handles object/array as JSON', () => {
    expect(registry.asTypedText({ a: 1 })).toBe('{"a":1}::JS');
    expect(registry.asTypedText([1, 2, 3])).toBe('[1,2,3]::JS');
  });

  it('isTyped checks if string has known type', () => {
    expect(registry.isTyped('42::L')).toBe(true);
    expect(registry.isTyped('hello')).toBe(false);
    expect(registry.isTyped('42::UNKNOWN')).toBe(false);
  });

  it('get returns type by name', () => {
    expect(registry.get('int')).toBeDefined();
    expect(registry.get('LONG')).toBeDefined();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('TypeRegistry can be instantiated', () => {
    const reg = new TypeRegistry();
    expect(reg.fromText('42::L')).toBe(42);
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

  it('fromJson handles arrays', () => {
    const result = fromJson<number[]>('["1::L","2::L","3::L"]');
    expect(result).toEqual([1, 2, 3]);
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

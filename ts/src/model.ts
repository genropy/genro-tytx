/**
 * TytxModel - Type-safe base class for TYTX models.
 *
 * @module model
 *
 * @example
 * ```ts
 * import { TytxModel } from 'genro-tytx-ts';
 *
 * class Order extends TytxModel {
 *   price!: number;
 *   date!: Date;
 *   quantity!: number;
 * }
 *
 * // Create from TYTX JSON - fully typed!
 * const order = Order.fromTytx('{"price":"99.99::N","date":"2025-01-15::D","quantity":"5::L"}');
 * console.log(order.price);  // number: 99.99
 * console.log(order.date);   // Date object
 *
 * // Serialize to TYTX JSON
 * const json = order.toTytx();
 *
 * // Fetch from API
 * const orders = await Order.fetchTytxArray('/api/orders');
 * ```
 */

import type { FetchOptions } from './types.js';
import { asTypedJson, fromJson, hydrateObject } from './json.js';
import { packb, unpackb } from './msgpack.js';

/**
 * Static interface for TytxModel constructors.
 */
interface TytxModelStatic<T extends TytxModel> {
  new (): T;
  fromTytx(json: string | Record<string, unknown>): T;
  fromTytxMsgpack(packed: Uint8Array | ArrayBuffer): T;
}

/**
 * Base class for TYTX-aware models with full type safety.
 *
 * @example
 * ```ts
 * class User extends TytxModel {
 *   name!: string;
 *   balance!: number;
 *   createdAt!: Date;
 * }
 *
 * const user = User.fromTytx(json);
 * // user is typed as User with name, balance, createdAt
 * ```
 */
export class TytxModel {
  /**
   * Serialize this instance to TYTX JSON string.
   *
   * @example
   * ```ts
   * const order = new Order();
   * order.price = 99.99;
   * order.date = new Date();
   * order.toTytx();  // '{"price":"99.99::R","date":"2025-01-15::D"}'
   * ```
   */
  toTytx(): string {
    return asTypedJson(this._getProperties());
  }

  /**
   * Serialize this instance to MessagePack bytes.
   *
   * Requires @msgpack/msgpack to be installed.
   *
   * @example
   * ```ts
   * const packed = order.toTytxMsgpack();
   * ```
   */
  toTytxMsgpack(): Uint8Array {
    return packb(this._getProperties());
  }

  /**
   * Get own properties as plain object.
   * @internal
   */
  protected _getProperties(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(this)) {
      const value = (this as Record<string, unknown>)[key];
      if (typeof value !== 'function') {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Create an instance from TYTX JSON string or object.
   *
   * @param json - TYTX JSON string or object with typed values.
   * @returns New instance with hydrated values.
   *
   * @example
   * ```ts
   * const order = Order.fromTytx('{"price":"99.99::N","date":"2025-01-15::D"}');
   * // order is typed as Order
   * ```
   */
  static fromTytx<T extends TytxModel>(
    this: TytxModelStatic<T>,
    json: string | Record<string, unknown>
  ): T {
    const data = typeof json === 'string' ? fromJson(json) : hydrateObject(json);
    const instance = new this();
    Object.assign(instance, data);
    return instance;
  }

  /**
   * Create an instance from MessagePack bytes.
   *
   * Requires @msgpack/msgpack to be installed.
   *
   * @param packed - MessagePack bytes.
   * @returns New instance with hydrated values.
   *
   * @example
   * ```ts
   * const order = Order.fromTytxMsgpack(packed);
   * ```
   */
  static fromTytxMsgpack<T extends TytxModel>(
    this: TytxModelStatic<T>,
    packed: Uint8Array | ArrayBuffer
  ): T {
    const data = unpackb(packed);
    const instance = new this();
    Object.assign(instance, data);
    return instance;
  }

  /**
   * Fetch from URL and deserialize TYTX JSON response.
   *
   * @param input - URL to fetch from.
   * @param init - Optional fetch options.
   * @returns Promise of instance.
   *
   * @example
   * ```ts
   * const order = await Order.fetchTytx('/api/orders/123');
   * ```
   */
  static async fetchTytx<T extends TytxModel>(
    this: TytxModelStatic<T>,
    input: string | URL,
    init?: FetchOptions
  ): Promise<T> {
    const response = await fetch(input, init);
    const json = (await response.json()) as Record<string, unknown>;
    return this.fromTytx(json);
  }

  /**
   * Fetch array from URL and deserialize TYTX JSON response.
   *
   * @param input - URL to fetch from.
   * @param init - Optional fetch options.
   * @returns Promise of array of instances.
   *
   * @example
   * ```ts
   * const orders = await Order.fetchTytxArray('/api/orders');
   * orders.forEach(o => console.log(o.price));
   * ```
   */
  static async fetchTytxArray<T extends TytxModel>(
    this: TytxModelStatic<T>,
    input: string | URL,
    init?: FetchOptions
  ): Promise<T[]> {
    const response = await fetch(input, init);
    const json = (await response.json()) as unknown[];

    if (!Array.isArray(json)) {
      throw new TypeError('Expected array response');
    }

    return json.map((item) => this.fromTytx(item as Record<string, unknown>));
  }

  /**
   * Fetch MessagePack from URL and deserialize.
   *
   * Requires @msgpack/msgpack to be installed.
   *
   * @param input - URL to fetch from.
   * @param init - Optional fetch options.
   * @returns Promise of instance.
   */
  static async fetchTytxMsgpack<T extends TytxModel>(
    this: TytxModelStatic<T>,
    input: string | URL,
    init?: FetchOptions
  ): Promise<T> {
    const response = await fetch(input, init);
    const buffer = await response.arrayBuffer();
    return this.fromTytxMsgpack(buffer);
  }

  /**
   * Fetch MessagePack array from URL and deserialize.
   *
   * Requires @msgpack/msgpack to be installed.
   *
   * @param input - URL to fetch from.
   * @param init - Optional fetch options.
   * @returns Promise of array of instances.
   */
  static async fetchTytxMsgpackArray<T extends TytxModel>(
    this: TytxModelStatic<T>,
    input: string | URL,
    init?: FetchOptions
  ): Promise<T[]> {
    const response = await fetch(input, init);
    const buffer = await response.arrayBuffer();
    const data = unpackb(buffer) as unknown[];

    if (!Array.isArray(data)) {
      throw new TypeError('Expected array response');
    }

    return data.map((item) => {
      const instance = new this();
      Object.assign(instance, item);
      return instance;
    });
  }
}

/**
 * TytxModel - Base class for TYTX-aware models in JavaScript.
 *
 * Provides automatic serialization/deserialization with TYTX types preserved.
 *
 * Usage:
 *     const { TytxModel } = require('genro-tytx');
 *
 *     class Order extends TytxModel {
 *         // No need to declare properties in JS
 *     }
 *
 *     // Create from TYTX JSON
 *     const order = Order.fromTytx('{"price": "99.99::N", "date": "2025-01-15::D"}');
 *     console.log(order.price);  // 99.99 (number or Big)
 *     console.log(order.date);   // Date object
 *
 *     // Serialize to TYTX JSON
 *     const json = order.toTytx();
 *
 *     // Fetch from API
 *     const orders = await Order.fetchTytx('/api/orders');
 *
 * @module tytx_model
 */

const { as_typed_json, from_json } = require('./json_utils');

/**
 * Base class for TYTX-aware models.
 *
 * Extend this class to create models that automatically handle
 * TYTX serialization and deserialization.
 */
class TytxModel {
    /**
     * Serialize this instance to TYTX JSON string.
     *
     * All Date objects, numbers, booleans are encoded with type suffixes.
     *
     * @returns {string} TYTX JSON string.
     *
     * @example
     * const order = new Order();
     * order.price = 99.99;
     * order.date = new Date('2025-01-15');
     * order.toTytx();
     * // '{"price":"99.99::R","date":"2025-01-15::D"}'
     */
    toTytx() {
        return as_typed_json(this._getProperties());
    }

    /**
     * Serialize this instance to MessagePack bytes with TYTX types.
     *
     * Requires @msgpack/msgpack to be installed.
     *
     * @returns {Uint8Array} MessagePack bytes.
     * @throws {Error} If @msgpack/msgpack is not installed.
     *
     * @example
     * const packed = order.toTytxMsgpack();
     */
    toTytxMsgpack() {
        const { packb } = require('./msgpack_utils');
        return packb(this._getProperties());
    }

    /**
     * Get own enumerable properties (excludes inherited and methods).
     * @returns {Object} Plain object with instance properties.
     * @private
     */
    _getProperties() {
        const result = {};
        for (const key of Object.keys(this)) {
            const value = this[key];
            if (typeof value !== 'function') {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Create an instance from TYTX JSON string or object.
     *
     * Typed values (e.g., "99.99::N", "2025-01-15::D") are automatically
     * converted to their JavaScript equivalents.
     *
     * @param {string|Object} json - TYTX JSON string or already-parsed object.
     * @returns {TytxModel} New instance with hydrated values.
     *
     * @example
     * const order = Order.fromTytx('{"price": "99.99::N", "date": "2025-01-15::D"}');
     * console.log(order.price);  // 99.99
     * console.log(order.date);   // Date object
     */
    static fromTytx(json) {
        const data = typeof json === 'string' ? from_json(json) : _hydrateObject(json);
        const instance = new this();
        Object.assign(instance, data);
        return instance;
    }

    /**
     * Create an instance from TYTX MessagePack bytes.
     *
     * Requires @msgpack/msgpack to be installed.
     *
     * @param {Uint8Array|ArrayBuffer} packed - MessagePack bytes.
     * @returns {TytxModel} New instance with hydrated values.
     * @throws {Error} If @msgpack/msgpack is not installed.
     *
     * @example
     * const order = Order.fromTytxMsgpack(packed);
     */
    static fromTytxMsgpack(packed) {
        const { unpackb } = require('./msgpack_utils');
        const data = unpackb(packed);
        const instance = new this();
        Object.assign(instance, data);
        return instance;
    }

    /**
     * Fetch from URL and deserialize TYTX JSON response.
     *
     * Works with both single objects and arrays.
     *
     * @param {string|URL} input - URL to fetch from.
     * @param {RequestInit} [init] - Optional fetch init options.
     * @returns {Promise<TytxModel|TytxModel[]>} Instance or array of instances.
     *
     * @example
     * // Single object
     * const order = await Order.fetchTytx('/api/orders/123');
     *
     * // Array of objects
     * const orders = await Order.fetchTytx('/api/orders');
     * orders.forEach(o => console.log(o.price));
     */
    static async fetchTytx(input, init) {
        const response = await fetch(input, init);
        const json = await response.json();

        // Handle arrays
        if (Array.isArray(json)) {
            return json.map(item => this.fromTytx(item));
        }

        return this.fromTytx(json);
    }

    /**
     * Fetch MessagePack from URL and deserialize.
     *
     * Requires @msgpack/msgpack to be installed.
     *
     * @param {string|URL} input - URL to fetch from.
     * @param {RequestInit} [init] - Optional fetch init options.
     * @returns {Promise<TytxModel|TytxModel[]>} Instance or array of instances.
     * @throws {Error} If @msgpack/msgpack is not installed.
     */
    static async fetchTytxMsgpack(input, init) {
        const response = await fetch(input, init);
        const buffer = await response.arrayBuffer();
        const { unpackb } = require('./msgpack_utils');
        const data = unpackb(new Uint8Array(buffer));

        // Handle arrays
        if (Array.isArray(data)) {
            return data.map(item => {
                const instance = new this();
                Object.assign(instance, item);
                return instance;
            });
        }

        const instance = new this();
        Object.assign(instance, data);
        return instance;
    }
}

/**
 * Recursively hydrate typed strings in an object.
 * @param {*} obj - Object to hydrate.
 * @returns {*} Hydrated object.
 * @private
 */
function _hydrateObject(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        const { registry } = require('./registry');
        return registry.from_text(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(_hydrateObject);
    }

    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = _hydrateObject(value);
        }
        return result;
    }

    return obj;
}

module.exports = { TytxModel };

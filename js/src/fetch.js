/**
 * TYTX Fetch - HTTP client with automatic TYTX encoding/decoding
 *
 * @module fetch
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

const { toTypedText, serializeValue } = require('./encode');
const { fromText } = require('./decode');
const { isDecimalInstance } = require('./registry');

/**
 * Create a Date representing a date-only value (midnight UTC).
 *
 * @param {number} year - Full year (e.g., 2025)
 * @param {number} month - Month (1-12)
 * @param {number} day - Day of month (1-31)
 * @returns {Date} Date at midnight UTC
 */
function createDate(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Create a Date representing a time-only value (epoch date: 1970-01-01).
 *
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @param {number} [seconds=0] - Seconds (0-59)
 * @param {number} [milliseconds=0] - Milliseconds (0-999)
 * @returns {Date} Date at epoch with specified time
 */
function createTime(hours, minutes, seconds = 0, milliseconds = 0) {
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds, milliseconds));
}

/**
 * Create a full datetime.
 *
 * @param {number} year - Full year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day of month
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @param {number} [seconds=0] - Seconds (0-59)
 * @param {number} [milliseconds=0] - Milliseconds (0-999)
 * @returns {Date} Full datetime in UTC
 */
function createDateTime(year, month, day, hours, minutes, seconds = 0, milliseconds = 0) {
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
}

/**
 * Check if a value is a typed value that should be encoded.
 */
function isTypedValue(value) {
    return value instanceof Date || isDecimalInstance(value);
}

/**
 * Encode a single value for query string or header.
 */
function encodeValue(value) {
    if (isTypedValue(value)) {
        return serializeValue(value);
    }
    return String(value);
}

/**
 * Encode an object to URL query string with TYTX values.
 *
 * @param {Object} params - Object with parameter values
 * @returns {string} URL-encoded query string (without leading ?)
 *
 * @example
 * encodeQueryString({ date: createDate(2025, 1, 15), limit: 10 })
 * // "date=2025-01-15::D&limit=10"
 */
function encodeQueryString(params) {
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue;
        }
        const encoded = encodeValue(value);
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
    }
    return parts.join('&');
}

/**
 * Decode a URL query string with TYTX values.
 *
 * @param {string} queryString - Query string (without leading ?)
 * @returns {Object} Object with decoded values
 *
 * @example
 * decodeQueryString("date=2025-01-15::D&limit=10")
 * // { date: Date, limit: "10" }
 */
function decodeQueryString(queryString) {
    if (!queryString) {
        return {};
    }

    const result = {};
    const params = new URLSearchParams(queryString);

    for (const [key, value] of params.entries()) {
        // Check for TYTX suffix
        const match = value.match(/^(.+)::([A-Z]+)$/);
        if (match) {
            // Try to decode as typed value
            const decoded = fromText(`"${value}"`);
            result[key] = decoded;
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * TYTX Fetch - Drop-in replacement for fetch with automatic TYTX encoding/decoding.
 *
 * @param {string|URL} url - Request URL
 * @param {Object} [options] - Fetch options with TYTX extensions
 * @param {Object} [options.query] - Query parameters (typed values are encoded)
 * @param {Object} [options.body] - Request body (encoded as TYTX JSON)
 * @param {Object} [options.headers] - Headers (values with prefix are encoded)
 * @param {boolean} [options.rawBody=false] - Skip TYTX encoding for body
 * @param {boolean} [options.rawResponse=false] - Return raw Response object
 * @param {string} [options.headerPrefix="x-tytx-"] - Prefix for typed headers
 * @returns {Promise<*>} Decoded response body, or Response if rawResponse=true
 *
 * @example
 * const result = await tytx_fetch('/api/invoice', {
 *     method: 'POST',
 *     query: { date: createDate(2025, 1, 15) },
 *     body: { price: new Decimal('100.50') }
 * });
 */
async function tytx_fetch(url, options = {}) {
    const {
        query,
        body,
        headers = {},
        rawBody = false,
        rawResponse = false,
        headerPrefix = 'x-tytx-',
        ...fetchOptions
    } = options;

    // Build URL with query string
    let finalUrl = url;
    if (query && Object.keys(query).length > 0) {
        const qs = encodeQueryString(query);
        const separator = String(url).includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}${qs}`;
    }

    // Build headers
    const finalHeaders = {};
    const prefixLower = headerPrefix.toLowerCase();

    for (const [key, value] of Object.entries(headers)) {
        const keyLower = key.toLowerCase();
        if (keyLower.startsWith(prefixLower) && isTypedValue(value)) {
            finalHeaders[key] = encodeValue(value);
        } else {
            finalHeaders[key] = value;
        }
    }

    // Build body
    let finalBody;
    if (body !== undefined && body !== null) {
        if (rawBody) {
            finalBody = body;
        } else {
            finalBody = toTypedText(body);
            finalHeaders['Content-Type'] = 'application/vnd.tytx+json';
        }
    }

    // Make request
    const response = await fetch(finalUrl, {
        ...fetchOptions,
        headers: finalHeaders,
        body: finalBody,
    });

    if (rawResponse) {
        return response;
    }

    // Decode response
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('json') || contentType.includes('tytx')) {
        const text = await response.text();
        if (text) {
            return fromText(text);
        }
        return null;
    }

    // Return raw text for non-JSON responses
    return response.text();
}

module.exports = {
    tytx_fetch,
    createDate,
    createTime,
    createDateTime,
    encodeQueryString,
    decodeQueryString,
    encodeValue,
};

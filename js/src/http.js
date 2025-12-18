// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX HTTP utilities.
 *
 * Client-side functions to make HTTP requests with TYTX serialization.
 */

import { toTytx } from './encode.js';
import { fromTytx } from './decode.js';

const CONTENT_TYPES = {
    json: 'application/json',
    xml: 'application/xml',
    msgpack: 'application/msgpack',
};

/**
 * Get transport from Content-Type header.
 * @param {string} contentType
 * @returns {'json'|'xml'|'msgpack'|null}
 */
function getTransport(contentType) {
    if (!contentType) return null;
    const ct = contentType.toLowerCase();
    if (ct.includes('json')) return 'json';
    if (ct.includes('xml')) return 'xml';
    if (ct.includes('msgpack')) return 'msgpack';
    return null;
}

/**
 * Fetch with TYTX serialization/deserialization.
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {any} [options.body] - Data to send (will be serialized with toTytx)
 * @param {'json'|'xml'|'msgpack'} [options.transport='json'] - Transport format
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object} [options.headers={}] - Additional headers
 * @returns {Promise<any>} Deserialized response data
 */
async function fetchTytx(url, options = {}) {
    const {
        body,
        transport = 'json',
        method = body !== undefined ? 'POST' : 'GET',
        headers = {},
        ...fetchOptions
    } = options;

    const requestHeaders = {
        'X-TYTX-Transport': transport,
        ...headers,
    };

    // Serialize body if provided
    let requestBody;
    if (body !== undefined) {
        requestHeaders['Content-Type'] = CONTENT_TYPES[transport];
        const encoded = toTytx(body, transport);
        if (transport === 'msgpack') {
            requestBody = encoded;
        } else {
            requestBody = encoded;
        }
    }

    // Make request
    const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        ...fetchOptions,
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Determine response transport from Content-Type
    const responseContentType = response.headers.get('Content-Type') || '';
    const responseTransport = getTransport(responseContentType) || transport;

    // Read and deserialize response
    let responseData;
    if (responseTransport === 'msgpack') {
        const buffer = await response.arrayBuffer();
        responseData = fromTytx(Buffer.from(buffer), responseTransport);
    } else {
        const text = await response.text();
        responseData = fromTytx(text, responseTransport);
    }

    return responseData;
}

export {
    fetchTytx,
    getTransport,
    CONTENT_TYPES,
};

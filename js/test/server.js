/**
 * JavaScript HTTP server for cross-language testing.
 *
 * This server exposes TYTX endpoints for testing round-trip
 * compatibility between Python and JavaScript.
 *
 * Run: node js/test/server.js
 */

const http = require('http');
const { as_typed_json, from_json } = require('../src/json_utils');
const { registry } = require('../src/registry');
const { packb, unpackb } = require('../src/msgpack_utils');
const { as_typed_xml, from_xml } = require('../src/xml_utils');
require('../src/types'); // Register built-in types
const Big = require('big.js');

const PORT = process.env.PORT || 8766;

// Test data with all TYTX types
const TEST_DATA = {
    integer: 42,
    float: 3.14159,
    decimal: new Big('99.99'),  // Use Big.js for decimal type
    string: 'hello world',
    boolean: true,
    date: new Date('2025-01-15T00:00:00Z'),
    datetime: new Date('2025-01-15T10:30:45Z'),
    time: new Date('1970-01-01T14:30:00Z'),  // Time as Date on epoch
    null: null,
    array: [1, 2, 3],
    nested: { x: 10, y: 20 }
};

/**
 * Read request body.
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/**
 * Send JSON response with TYTX types.
 */
function sendJsonResponse(res, data, typed = true) {
    const body = typed ? as_typed_json(data) : JSON.stringify(data);
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

/**
 * Send msgpack response.
 */
function sendMsgpackResponse(res, data) {
    const body = packb(data);
    res.writeHead(200, {
        'Content-Type': 'application/x-msgpack',
        'Content-Length': body.length
    });
    res.end(body);
}

/**
 * Send typed text response.
 */
function sendTextResponse(res, value) {
    const body = registry.as_typed_text(value);
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

/**
 * Check if value is a Big.js instance.
 */
function isBigInstance(value) {
    return value && value.constructor && value.constructor.name === 'Big';
}

/**
 * Convert a simple value to XML structure {attrs: {}, value: ...}.
 */
function toXmlStructure(value) {
    if (value === null || value === undefined) {
        return { attrs: {}, value: null };
    }
    if (value instanceof Date) {
        return { attrs: {}, value: value };
    }
    // Big.js instances should be treated as scalars, not objects
    if (isBigInstance(value)) {
        return { attrs: {}, value: value };
    }
    if (Array.isArray(value)) {
        return value.map(item => toXmlStructure(item));
    }
    if (typeof value === 'object') {
        const children = {};
        for (const [k, v] of Object.entries(value)) {
            children[k] = toXmlStructure(v);
        }
        return { attrs: {}, value: children };
    }
    return { attrs: {}, value: value };
}

/**
 * Extract values from XML structure {attrs: {}, value: ...}.
 */
function fromXmlStructure(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => fromXmlStructure(item));
    }
    // Big.js instances should be returned as-is
    if (isBigInstance(value)) {
        return value;
    }
    if (typeof value === 'object' && 'attrs' in value && 'value' in value) {
        const inner = value.value;
        if (inner !== null && typeof inner === 'object' && !Array.isArray(inner) && !(inner instanceof Date) && !isBigInstance(inner)) {
            const result = {};
            for (const [k, v] of Object.entries(inner)) {
                result[k] = fromXmlStructure(v);
            }
            return result;
        }
        return inner;
    }
    if (typeof value === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            result[k] = fromXmlStructure(v);
        }
        return result;
    }
    return value;
}

/**
 * Send XML response with TYTX types.
 */
function sendXmlResponse(res, data) {
    // Convert data to XML structure recursively
    const xmlData = { root: toXmlStructure(data) };
    const body = as_typed_xml(xmlData);
    res.writeHead(200, {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

/**
 * Handle HTTP requests.
 */
async function handleRequest(req, res) {
    const { method, url } = req;
    const contentType = req.headers['content-type'] || '';

    try {
        // Health check
        if (url === '/health') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
            return;
        }

        // GET endpoints
        if (method === 'GET') {
            switch (url) {
                case '/json':
                    sendJsonResponse(res, TEST_DATA);
                    return;
                case '/msgpack':
                    sendMsgpackResponse(res, TEST_DATA);
                    return;
                case '/xml':
                    sendXmlResponse(res, TEST_DATA);
                    return;
                case '/text/integer':
                    sendTextResponse(res, 42);
                    return;
                case '/text/decimal':
                    sendTextResponse(res, 99.99);
                    return;
                case '/text/date':
                    sendTextResponse(res, new Date('2025-01-15T00:00:00Z'));
                    return;
                default:
                    res.writeHead(404);
                    res.end('Not found');
                    return;
            }
        }

        // POST echo endpoints
        if (method === 'POST') {
            const body = await readBody(req);
            let data;

            // Parse request body
            if (contentType.includes('msgpack')) {
                data = unpackb(body);
            } else if (contentType.includes('xml')) {
                data = from_xml(body.toString('utf-8'));
            } else if (contentType.includes('json')) {
                data = from_json(body.toString('utf-8'));
            } else {
                // Text
                data = registry.from_text(body.toString('utf-8'));
            }

            // Echo back
            switch (url) {
                case '/echo/json':
                case '/echo':
                    sendJsonResponse(res, data);
                    return;
                case '/echo/msgpack':
                    sendMsgpackResponse(res, data);
                    return;
                case '/echo/xml':
                    // For XML echo, extract values from XML structure
                    // from_xml returns {root: {attrs: {}, value: {...}}}
                    if (data && typeof data === 'object' && data.root) {
                        const rootVal = data.root.value || data.root;
                        const flatData = fromXmlStructure(rootVal);
                        sendXmlResponse(res, flatData);
                    } else {
                        sendXmlResponse(res, data);
                    }
                    return;
                case '/echo/text':
                    sendTextResponse(res, data);
                    return;
                default:
                    sendJsonResponse(res, data);
                    return;
            }
        }

        res.writeHead(405);
        res.end('Method not allowed');

    } catch (err) {
        console.error('Error handling request:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${err.message}`);
    }
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
    console.log(`TYTX JS Test Server running on http://127.0.0.1:${PORT}`);
    console.log('Endpoints:');
    console.log('  GET  /json        - All types as TYTX JSON');
    console.log('  GET  /msgpack     - All types as msgpack');
    console.log('  GET  /xml         - All types as TYTX XML');
    console.log('  GET  /text/*      - Single typed values');
    console.log('  POST /echo/json   - Echo JSON with TYTX types');
    console.log('  POST /echo/msgpack- Echo msgpack');
    console.log('  POST /echo/xml    - Echo XML with TYTX types');
    console.log('Press Ctrl+C to stop...');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});

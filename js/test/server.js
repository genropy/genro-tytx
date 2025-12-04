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
require('../src/types'); // Register built-in types

const PORT = process.env.PORT || 8766;

// Test data with all TYTX types
const TEST_DATA = {
    integer: 42,
    float: 3.14159,
    decimal: 99.99,  // JS uses number, will be typed as R or N
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
    console.log('  GET  /text/*      - Single typed values');
    console.log('  POST /echo/json   - Echo JSON with TYTX types');
    console.log('  POST /echo/msgpack- Echo msgpack');
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

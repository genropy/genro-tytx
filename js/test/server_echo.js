// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * Echo server for cross-language HTTP roundtrip tests.
 *
 * Receives TYTX-encoded data, deserializes it, re-serializes it,
 * and sends back the result.
 */

import http from 'node:http';
import { fromTytx, toTytx } from '../src/index.js';

const PORT = process.env.PORT || 3456;

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/echo') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const contentType = req.headers['content-type'] || '';

                // Determine transport from Content-Type
                let transport = null;
                if (contentType.includes('json')) transport = 'json';
                else if (contentType.includes('xml')) transport = 'xml';
                else if (contentType.includes('msgpack')) transport = 'msgpack';

                // Decode/encode roundtrip
                const input = transport === 'msgpack' ? buffer : buffer.toString('utf-8');
                const decoded = fromTytx(input, transport);
                const encoded = toTytx(decoded, transport);

                // Send response
                res.setHeader('Content-Type', contentType);
                if (transport === 'msgpack') {
                    res.end(encoded);
                } else {
                    res.end(encoded);
                }
            } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok' }));
    } else {
        res.statusCode = 404;
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Echo server listening on port ${PORT}`);
});

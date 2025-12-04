const { from_json, as_typed_json } = require('./json_utils');
const { registry } = require('./registry');
const { from_xml } = require('./xml_utils');
const { unpackb, packb } = require('./msgpack_utils');

function detectExpect(contentType) {
    if (!contentType) return 'text';
    const ct = contentType.toLowerCase();
    if (ct.includes('json')) return 'json';
    if (ct.includes('xml')) return 'xml';
    if (ct.includes('msgpack') || ct.includes('application/x-msgpack')) return 'msgpack';
    return 'text';
}

/**
 * Fetch and hydrate using TYTX parsers.
 *
 * @param {string} url
 * @param {RequestInit & {expect?: 'json'|'text'|'xml'|'msgpack'}} options
 */
async function fetch_typed(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const expect = options.expect || detectExpect(res.headers.get('content-type'));

    if (expect === 'msgpack') {
        const buf = await res.arrayBuffer();
        return unpackb(new Uint8Array(buf));
    }

    const raw = await res.text();
    if (expect === 'json') return from_json(raw);
    if (expect === 'xml') return from_xml(raw);
    return registry.from_text(raw);
}

/**
 * Build an XTYTX envelope string.
 */
function build_xtytx_envelope({ payload, gstruct = {}, lstruct = {}, gschema = {}, lschema = {} }) {
    // data must be a typed JSON string
    let typedData;
    if (typeof payload === 'string') {
        typedData = payload;
    } else {
        typedData = as_typed_json(payload);
    }
    // auto-collect struct definitions referenced in payload (::@STRUCT)
    const collected = { ...lstruct };
    const regex = /::@([A-Z0-9_]+)/g;
    let match;
    while ((match = regex.exec(typedData)) !== null) {
        const name = match[1];
        if (!collected[name]) {
            const schema = registry.get_struct(name);
            if (schema) {
                collected[name] = schema;
            }
        }
    }
    const envelope = {
        gstruct,
        lstruct: collected,
        gschema,
        lschema,
        data: typedData,
    };
    return `XTYTX://${JSON.stringify(envelope)}`;
}

/**
 * Send an XTYTX envelope (with optional gstruct/gschema) and hydrate the response.
 */
async function fetch_xtytx(url, { payload, gstruct, lstruct, gschema, lschema, ...options }) {
    const body = build_xtytx_envelope({ payload, gstruct, lstruct, gschema, lschema });
    const headers = {
        'Content-Type': 'application/json',
        'X-TYTX-Request': 'xtytx',
        ...(options.headers || {}),
    };
    return fetch_typed(url, { ...options, body, headers, method: options.method || 'POST' });
}

/**
 * Send a typed payload (json/text/msgpack) or XTYTX envelope and hydrate the response.
 */
async function fetch_typed_request(url, { body, sendAs = 'json', expect, xtytx = false, ...options }) {
    if (xtytx) {
        return fetch_xtytx(url, { payload: body, ...options });
    }
    let payload;
    let headers = { ...(options.headers || {}) };
    if (sendAs === 'msgpack') {
        payload = packb(body);
        headers['Content-Type'] = 'application/msgpack';
        headers['X-TYTX-Request'] = 'msgpack';
    } else if (sendAs === 'json') {
        payload = require('./json_utils').as_typed_json(body);
        headers['Content-Type'] = 'application/json';
        headers['X-TYTX-Request'] = 'json';
    } else {
        payload = require('./registry').registry.as_typed_text(body);
        headers['Content-Type'] = 'text/plain';
        headers['X-TYTX-Request'] = 'text';
    }
    return fetch_typed(url, { ...options, body: payload, headers, expect, method: options.method || 'POST' });
}

module.exports = { fetch_typed, fetch_xtytx, fetch_typed_request, build_xtytx_envelope, detectExpect };

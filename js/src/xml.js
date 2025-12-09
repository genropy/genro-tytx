// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
/**
 * TYTX XML Encoding/Decoding.
 *
 * XML format follows the structure:
 *     {"tag": {"attrs": {...}, "value": ...}}
 *
 * Where:
 * - attrs: dict of attributes (hydrated with type suffixes)
 * - value: scalar, dict of children, list, or null
 *
 * Type suffixes are used in both text content and attributes:
 *     <price>100.50::N</price>
 *     <order id="123::L" created="2025-01-15::D">...</order>
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// XML DOM support - use @xmldom/xmldom for Node.js
let DOMParser, XMLSerializer;
if (typeof window !== 'undefined' && window.DOMParser) {
    // Browser environment
    DOMParser = window.DOMParser;
    XMLSerializer = window.XMLSerializer;
} else {
    // Node.js environment
    try {
        const xmldom = require('@xmldom/xmldom');
        DOMParser = xmldom.DOMParser;
        XMLSerializer = xmldom.XMLSerializer;
    } catch {
        // Will throw when XML functions are called
        DOMParser = null;
        XMLSerializer = null;
    }
}

/**
 * Check if item is a valid XML element format: {tag: {"value": ...}}
 *
 * A valid XML element is a dict with exactly one key (the tag),
 * whose value is a dict containing at least a "value" key.
 *
 * @param {any} item
 * @returns {boolean}
 */
function _isXmlElement(item) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return false;
    }
    const keys = Object.keys(item);
    if (keys.length !== 1) {
        return false;
    }
    const itemData = item[keys[0]];
    return itemData !== null && typeof itemData === 'object' && 'value' in itemData;
}

/**
 * Serialize a dict with 'value' key (and optional 'attrs') to XML element.
 *
 * @param {Document} doc - XML Document
 * @param {string} tag - Element tag name
 * @param {Object} data - Dict with 'value' key and optional 'attrs' key
 * @returns {Element} XML Element
 */
function _serializeElement(doc, tag, data) {
    const { toTytx } = require('./encode.js');

    const element = doc.createElement(tag);

    const attrs = data.attrs || {};
    const value = data.value;

    // Set attributes
    for (const [attrName, attrValue] of Object.entries(attrs)) {
        element.setAttribute(attrName, toTytx(attrValue, null, { _forceSuffix: true }));
    }

    // Set value
    if (Array.isArray(value)) {
        // List of children
        for (const item of value) {
            if (_isXmlElement(item)) {
                const [itemTag] = Object.keys(item);
                const itemData = item[itemTag];
                const childElement = _serializeElement(doc, itemTag, itemData);
                element.appendChild(childElement);
            } else {
                element.textContent = toTytx(value);
                break;
            }
        }
    } else {
        element.textContent = toTytx(value);
    }

    return element;
}

/**
 * Encode a JavaScript value to TYTX XML string.
 *
 * @param {any} value - Data to encode
 * @returns {string} XML string with typed values marked
 */
function toXml(value) {
    if (!DOMParser) {
        throw new Error('XML support requires @xmldom/xmldom package in Node.js');
    }

    const { toTytx } = require('./encode.js');

    // Check if value is valid XML element format
    if (_isXmlElement(value)) {
        // Valid XML format: {tag: {"value": ...}}
        const [rootTag] = Object.keys(value);
        const rootData = value[rootTag];

        const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
        const element = _serializeElement(doc, rootTag, rootData);

        const serializer = new XMLSerializer();
        return serializer.serializeToString(element);
    } else {
        // Not valid XML format: serialize as JSON
        return toTytx(value);
    }
}

/**
 * Deserialize XML element to dict with 'attrs' and 'value' keys.
 *
 * @param {Element} element
 * @returns {Object} Dict with 'attrs' and 'value' keys
 */
function fromXmlnode(element) {
    const { fromTytx } = require('./decode.js');

    // Hydrate attributes
    const attrs = {};
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs[attr.name] = fromTytx(attr.value);
    }

    // Process children
    const children = [];
    for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === 1) {  // ELEMENT_NODE
            children.push(node);
        }
    }

    if (children.length > 0) {
        if (children.length === 1) {
            // Single child: return as dict {tag: {...}}
            const child = children[0];
            const childData = fromXmlnode(child);
            return { attrs, value: { [child.tagName]: childData } };
        } else {
            // Multiple children: return as list [{tag: {...}}, ...]
            const valueList = [];
            for (const child of children) {
                const childData = fromXmlnode(child);
                valueList.push({ [child.tagName]: childData });
            }
            return { attrs, value: valueList };
        }
    }

    // Leaf node
    return { attrs, value: fromTytx(element.textContent) };
}

/**
 * Decode a TYTX XML string to JavaScript value.
 *
 * If the root element is 'tytx_root', it is automatically unwrapped
 * and the inner value is returned directly.
 *
 * @param {string} data - XML string with typed values
 * @returns {Object|any} If root is 'tytx_root': the unwrapped value.
 *                       Otherwise: Dict in format {"tag": {"attrs": {...}, "value": ...}}
 *
 * @example
 * fromXml('<order id="123::L"><total>100.50::N</total></order>')
 * // {
 * //     "order": {
 * //         "attrs": {"id": 123},
 * //         "value": {"total": {"attrs": {}, "value": Decimal("100.50")}}
 * //     }
 * // }
 *
 * fromXml('<tytx_root><price>100.50::N</price></tytx_root>')
 * // {"price": {"attrs": {}, "value": Decimal("100.50")}}
 */
function fromXml(data) {
    if (!DOMParser) {
        throw new Error('XML support requires @xmldom/xmldom package in Node.js');
    }

    const { fromTytx } = require('./decode.js');

    const parser = new DOMParser();
    const doc = parser.parseFromString(data, 'text/xml');
    let root = doc.documentElement;

    // Unwrap tytx_root: work on inner content
    if (root.tagName === 'tytx_root') {
        // Get first element child
        let firstElementChild = null;
        for (let i = 0; i < root.childNodes.length; i++) {
            if (root.childNodes[i].nodeType === 1) {
                firstElementChild = root.childNodes[i];
                break;
            }
        }

        if (!firstElementChild) {
            return fromTytx(root.textContent);
        }
        root = firstElementChild;
    }

    // From here: root is the real node
    const result = fromXmlnode(root);
    return { [root.tagName]: result };
}

export {
    toXml,
    fromXml,
    fromXmlnode,
    _isXmlElement,
    _serializeElement,
};

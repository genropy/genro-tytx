/**
 * XML utilities for TYTX Protocol.
 *
 * Provides functions for XML serialization with typed values.
 *
 * Structure convention (aligned with Python implementation):
 *     Each XML element maps to: {"tag": {"attrs": {...}, "value": ...}}
 *     - attrs: dict of attributes (can be typed with ::type)
 *     - value: scalar (string or typed), dict of children, or list (repeated elements)
 *
 * Usage:
 *     // Typed XML (TYTX format - reversible)
 *     as_typed_xml(data)  // → '<price>99.50::N</price>'
 *     from_xml(xml_str)   // → {"price": {"attrs": {}, "value": Decimal("99.50")}}
 *
 *     // Standard XML (for external systems)
 *     as_xml(data)  // → '<price>99.50</price>'
 */

const { registry } = require('./index');

/**
 * Convert a dictionary to an XML string with typed values (TYTX format).
 *
 * @param {Object} data - The dictionary to convert. Structure: {"tag": {"attrs": {...}, "value": ...}}
 * @param {string|null} rootTag - Optional root tag name. If provided, data is treated as content of this root.
 * @returns {string} XML string with typed values (e.g., "99.50::N").
 */
function as_typed_xml(data, rootTag = null) {
    return _toXml(data, rootTag, true);
}

/**
 * Convert a dictionary to a standard XML string (without type suffixes).
 *
 * @param {Object} data - The dictionary to convert. Structure: {"tag": {"attrs": {...}, "value": ...}}
 * @param {string|null} rootTag - Optional root tag name. If provided, data is treated as content of this root.
 * @returns {string} Standard XML string.
 */
function as_xml(data, rootTag = null) {
    return _toXml(data, rootTag, false);
}

/**
 * Internal XML builder.
 */
function _toXml(data, rootTag, typed) {
    if (rootTag === null) {
        const keys = Object.keys(data);
        if (keys.length !== 1) {
            throw new Error("Data must have exactly one root key if rootTag is not provided");
        }
        rootTag = keys[0];
        data = data[rootTag];
    }

    return _buildElement(rootTag, data, typed);
}

/**
 * Build an XML element from dict content.
 * Expects content to have 'attrs' and 'value' keys.
 */
function _buildElement(tag, content, typed) {
    // Validate structure
    if (typeof content !== 'object' || content === null ||
        !('attrs' in content) || !('value' in content)) {
        throw new Error(`Content must have 'attrs' and 'value' keys, got: ${typeof content}`);
    }

    let xml = `<${tag}`;

    // Set attributes
    const attrs = content.attrs || {};
    for (const [attrName, attrValue] of Object.entries(attrs)) {
        const serialized = typed
            ? registry.as_typed_text(attrValue)
            : registry.as_text(attrValue);
        xml += ` ${attrName}="${_escapeXml(serialized)}"`;
    }

    xml += '>';

    const value = content.value;

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Value is dict of children
        for (const [childTag, childContent] of Object.entries(value)) {
            if (childTag === '#text') {
                // Mixed content text
                const textVal = typed
                    ? registry.as_typed_text(childContent)
                    : registry.as_text(childContent);
                xml += _escapeXml(textVal);
            } else if (Array.isArray(childContent)) {
                // List of same-tag children
                for (const item of childContent) {
                    xml += _buildElement(childTag, item, typed);
                }
            } else {
                // Single child
                xml += _buildElement(childTag, childContent, typed);
            }
        }
    } else if (Array.isArray(value)) {
        // List of same-tag children (unusual at root level, but supported)
        for (const item of value) {
            xml += _buildElement(tag, item, typed);
        }
    } else if (value !== null && value !== undefined) {
        // Scalar value
        const textVal = typed
            ? registry.as_typed_text(value)
            : registry.as_text(value);
        xml += _escapeXml(textVal);
    }

    xml += `</${tag}>`;
    return xml;
}

/**
 * Escape XML special characters.
 */
function _escapeXml(unsafe) {
    return String(unsafe).replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
        }
    });
}

/**
 * Convert an XML string to a dictionary, hydrating typed values.
 *
 * Typed strings (e.g., "99.50::N") are converted to JS objects.
 * Non-typed values are returned as strings.
 *
 * @param {string} xmlString - XML string to parse.
 * @returns {Object} Dictionary with structure: {"tag": {"attrs": {...}, "value": ...}}
 */
function from_xml(xmlString) {
    // Check if we are in browser
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, "text/xml");
        const root = doc.documentElement;
        return { [root.tagName]: _parseElement(root) };
    }

    // Node.js environment - need xmldom or similar
    // For now, throw error suggesting to use a library
    throw new Error("XML Parsing requires DOMParser (Browser) or xmldom package in Node.js");
}

/**
 * Parse an XML element to dict with attrs/value structure.
 */
function _parseElement(elem) {
    const attrs = {};
    const children = {};

    // Parse attributes
    for (let i = 0; i < elem.attributes.length; i++) {
        const attr = elem.attributes[i];
        attrs[attr.name] = registry.from_text(attr.value);
    }

    // Parse children
    let hasChildren = false;
    for (let i = 0; i < elem.children.length; i++) {
        hasChildren = true;
        const child = elem.children[i];
        const childVal = _parseElement(child);

        if (child.tagName in children) {
            // Convert to array if multiple same-tag children
            if (!Array.isArray(children[child.tagName])) {
                children[child.tagName] = [children[child.tagName]];
            }
            children[child.tagName].push(childVal);
        } else {
            children[child.tagName] = childVal;
        }
    }

    // Parse text content
    let text = '';
    for (let i = 0; i < elem.childNodes.length; i++) {
        const node = elem.childNodes[i];
        if (node.nodeType === 3) { // TEXT_NODE
            text += node.textContent;
        }
    }
    text = text.trim();

    // Determine value
    let value;
    if (hasChildren) {
        // Has children - value is dict of children
        value = children;
        if (text) {
            // Has both children and text (mixed content)
            value['#text'] = registry.from_text(text);
        }
    } else if (text) {
        // Only text content
        value = registry.from_text(text);
    } else {
        // Empty element
        value = null;
    }

    return { attrs, value };
}

// Legacy aliases for backward compatibility
const dictToXml = as_typed_xml;
const xmlToDict = from_xml;

module.exports = {
    as_typed_xml,
    as_xml,
    from_xml,
    // Legacy aliases
    dictToXml,
    xmlToDict
};

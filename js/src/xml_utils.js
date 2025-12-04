/**
 * XML utilities for TYTX Protocol.
 *
 * Provides functions for XML serialization with typed values.
 *
 * Structure convention:
 *     Each XML element maps to: {tag: {attrs: {...}, value: ...}}
 *     - attrs: object of attributes (can be typed with ::type)
 *     - value: scalar (string or typed), object of children, or array (repeated elements)
 *
 * Usage:
 *     // Typed XML (TYTX format - reversible)
 *     as_typed_xml(data)  // → '<price>99.50::D</price>'
 *     from_xml(xml_str)   // → {price: {attrs: {}, value: 99.5}}
 *
 *     // Standard XML (for external systems)
 *     as_xml(data)  // → '<price>99.50</price>'
 *
 * @module xml_utils
 */

const { registry } = require('./registry');
const { isDecimalInstance } = require('./types');

/**
 * Escape XML special characters.
 * @param {string} str
 * @returns {string}
 */
function _escape_xml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Build an XML element from dict content.
 * @param {string} tag
 * @param {Object} content - {attrs: {...}, value: ...}
 * @param {boolean} typed
 * @returns {string}
 */
function _build_element(tag, content, typed) {
    if (!content || typeof content !== 'object' || !('attrs' in content) || !('value' in content)) {
        throw new Error(`Content must have 'attrs' and 'value' keys, got: ${typeof content}`);
    }

    // Build attributes
    let attrs_str = '';
    for (const [attr_name, attr_value] of Object.entries(content.attrs)) {
        const attr_text = typed
            ? registry.as_typed_text(attr_value)
            : registry.as_text(attr_value);
        attrs_str += ` ${attr_name}="${_escape_xml(attr_text)}"`;
    }

    const value = content.value;

    // Empty element
    if (value === null || value === undefined) {
        return `<${tag}${attrs_str} />`;
    }

    // Object of children (exclude Date and Decimal instances which are scalar values)
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !isDecimalInstance(value)) {
        let children_xml = '';
        for (const [child_tag, child_content] of Object.entries(value)) {
            if (Array.isArray(child_content)) {
                for (const item of child_content) {
                    children_xml += _build_element(child_tag, item, typed);
                }
            } else {
                children_xml += _build_element(child_tag, child_content, typed);
            }
        }
        return `<${tag}${attrs_str}>${children_xml}</${tag}>`;
    }

    // Array of same-tag children
    if (Array.isArray(value)) {
        let children_xml = '';
        for (const item of value) {
            children_xml += _build_element(tag, item, typed);
        }
        return children_xml;
    }

    // Scalar value
    const text = typed
        ? registry.as_typed_text(value)
        : registry.as_text(value);
    return `<${tag}${attrs_str}>${_escape_xml(text)}</${tag}>`;
}

/**
 * Internal XML builder.
 * @param {Object} data
 * @param {string|null} root_tag
 * @param {boolean} typed
 * @returns {string}
 */
function _to_xml(data, root_tag, typed) {
    if (root_tag === null) {
        const keys = Object.keys(data);
        if (keys.length !== 1) {
            throw new Error('Data must have exactly one root key if root_tag is not provided');
        }
        root_tag = keys[0];
        data = data[root_tag];
    }
    return _build_element(root_tag, data, typed);
}

/**
 * Convert a dictionary to an XML string with typed values (TYTX format).
 *
 * @param {Object} data - The dictionary to convert. Structure: {tag: {attrs: {...}, value: ...}}
 * @param {string} [root_tag] - Optional root tag name.
 * @returns {string} XML string with typed values.
 */
function as_typed_xml(data, root_tag = null) {
    return _to_xml(data, root_tag, true);
}

/**
 * Convert a dictionary to a standard XML string (without type suffixes).
 *
 * @param {Object} data - The dictionary to convert. Structure: {tag: {attrs: {...}, value: ...}}
 * @param {string} [root_tag] - Optional root tag name.
 * @returns {string} Standard XML string.
 */
function as_xml(data, root_tag = null) {
    return _to_xml(data, root_tag, false);
}

/**
 * Simple XML parser state machine.
 * Note: This is a minimal implementation for TYTX use cases.
 * For complex XML, consider using a proper XML parser library.
 */

/**
 * Parse XML element from string.
 * @param {string} xml_string
 * @returns {Object} Parsed element {tag, attrs, children, text}
 */
function _parse_xml_string(xml_string) {
    // Use DOMParser in browser, or a simple regex-based parser for Node.js
    if (typeof DOMParser !== 'undefined') {
        return _parse_with_dom(xml_string);
    }
    return _parse_simple(xml_string);
}

/**
 * Parse XML using browser's DOMParser.
 * @param {string} xml_string
 * @returns {Object}
 */
function _parse_with_dom(xml_string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml_string, 'text/xml');
    const root = doc.documentElement;
    return { [root.tagName]: _parse_dom_element(root) };
}

/**
 * Parse a DOM element to TYTX structure.
 * @param {Element} elem
 * @returns {Object}
 */
function _parse_dom_element(elem) {
    const attrs = {};
    const children = {};

    // Parse attributes
    for (const attr of elem.attributes) {
        attrs[attr.name] = registry.from_text(attr.value);
    }

    // Parse children
    for (const child of elem.children) {
        const child_val = _parse_dom_element(child);
        if (child.tagName in children) {
            if (!Array.isArray(children[child.tagName])) {
                children[child.tagName] = [children[child.tagName]];
            }
            children[child.tagName].push(child_val);
        } else {
            children[child.tagName] = child_val;
        }
    }

    // Parse text content
    let text = '';
    for (const node of elem.childNodes) {
        if (node.nodeType === 3) { // TEXT_NODE
            text += node.textContent;
        }
    }
    text = text.trim();

    // Determine value
    let value;
    if (Object.keys(children).length > 0) {
        value = children;
        if (text) {
            value['#text'] = registry.from_text(text);
        }
    } else if (text) {
        value = registry.from_text(text);
    } else {
        value = null;
    }

    return { attrs, value };
}

/**
 * Simple regex-based XML parser for Node.js without dependencies.
 * Handles basic XML structures needed for TYTX.
 * @param {string} xml_string
 * @returns {Object}
 */
function _parse_simple(xml_string) {
    xml_string = xml_string.trim();

    // Extract root tag
    const tag_match = xml_string.match(/^<([^\s/>]+)/);
    if (!tag_match) {
        throw new Error('Invalid XML: no root tag found');
    }
    const root_tag = tag_match[1];

    return { [root_tag]: _parse_element_simple(xml_string) };
}

/**
 * Parse a single element.
 * @param {string} xml
 * @returns {Object}
 */
function _parse_element_simple(xml) {
    xml = xml.trim();

    // Extract tag name
    const tag_match = xml.match(/^<([^\s/>]+)/);
    if (!tag_match) {
        throw new Error('Invalid XML element');
    }
    const tag = tag_match[1];

    // Extract attributes
    const attrs = {};
    const attr_regex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;
    const opening_tag_match = xml.match(/^<[^>]*>/);
    if (opening_tag_match) {
        let attr_match;
        while ((attr_match = attr_regex.exec(opening_tag_match[0])) !== null) {
            attrs[attr_match[1]] = registry.from_text(_unescape_xml(attr_match[2]));
        }
    }

    // Check for self-closing tag
    if (xml.match(/^<[^>]*\/>/)) {
        return { attrs, value: null };
    }

    // Extract content between tags
    const content_match = xml.match(new RegExp(`^<${tag}[^>]*>([\\s\\S]*)</${tag}>$`));
    if (!content_match) {
        return { attrs, value: null };
    }

    const content = content_match[1];

    // Check for child elements
    const children = {};
    let remaining = content;
    const child_regex = /<([^\s/>]+)(?:\s[^>]*)?>[\s\S]*?<\/\1>|<([^\s/>]+)(?:\s[^>]*)?\/>/g;
    let child_match;

    while ((child_match = child_regex.exec(content)) !== null) {
        const child_tag = child_match[1] || child_match[2];
        const child_xml = child_match[0];
        const child_val = _parse_element_simple(child_xml);

        if (child_tag in children) {
            if (!Array.isArray(children[child_tag])) {
                children[child_tag] = [children[child_tag]];
            }
            children[child_tag].push(child_val);
        } else {
            children[child_tag] = child_val;
        }

        remaining = remaining.replace(child_xml, '');
    }

    // Extract text content
    const text = remaining.replace(/<[^>]*>/g, '').trim();

    // Determine value
    let value;
    if (Object.keys(children).length > 0) {
        value = children;
        if (text) {
            value['#text'] = registry.from_text(text);
        }
    } else if (text) {
        value = registry.from_text(_unescape_xml(text));
    } else {
        value = null;
    }

    return { attrs, value };
}

/**
 * Unescape XML entities.
 * @param {string} str
 * @returns {string}
 */
function _unescape_xml(str) {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

/**
 * Convert an XML string to a dictionary, hydrating typed values.
 *
 * Typed strings (e.g., "99.50::D") are converted to JavaScript objects.
 * Non-typed values are returned as strings.
 *
 * @param {string} xml_string - XML string to parse.
 * @returns {Object} Dictionary with structure: {tag: {attrs: {...}, value: ...}}
 */
function from_xml(xml_string) {
    return _parse_xml_string(xml_string);
}

module.exports = {
    as_typed_xml,
    as_xml,
    from_xml
};

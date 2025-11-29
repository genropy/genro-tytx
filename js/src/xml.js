const { registry } = require('./index');

/**
 * Simple XML Parser/Serializer for TYTX
 * Note: This is a lightweight implementation for demonstration/transport.
 * For production in Browser, use DOMParser. For Node, use a robust library if needed.
 * Here we implement a basic serializer and a simplified parser.
 */

function dictToXml(data, rootTag = null) {
    if (rootTag === null) {
        const keys = Object.keys(data);
        if (keys.length !== 1) throw new Error("Data must have exactly one root key if rootTag is not provided");
        rootTag = keys[0];
        data = data[rootTag];
    }

    return buildElement(rootTag, data);
}

function buildElement(tag, content) {
    let xml = `<${tag}`;
    let children = '';
    let text = '';

    if (typeof content === 'object' && content !== null && !Array.isArray(content) && !(content instanceof Date)) {
        // Dict/Object
        for (const [key, value] of Object.entries(content)) {
            if (key.startsWith('@')) {
                // Attribute
                const attrName = key.substring(1);
                const attrVal = registry.serialize(value);
                xml += ` ${attrName}="${escapeXml(attrVal)}"`;
            } else if (key === '#text') {
                text = registry.serialize(value);
            } else if (Array.isArray(value)) {
                // List of children
                value.forEach(item => {
                    children += buildElement(key, item);
                });
            } else {
                // Single child
                children += buildElement(key, value);
            }
        }
    } else if (Array.isArray(content)) {
        // Should be handled by parent, but if called directly:
        return content.map(item => buildElement(tag, item)).join('');
    } else {
        // Simple content
        text = registry.serialize(content);
    }

    xml += '>';
    if (text) xml += escapeXml(text);
    if (children) xml += children;
    xml += `</${tag}>`;

    return xml;
}

function escapeXml(unsafe) {
    return String(unsafe).replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Simplified XML Parser (Regex based - NOT robust for all XML, but sufficient for simple data transport)
// For robust parsing in Node without deps, it's complex. 
// In Browser environment, DOMParser is available.
// This is a placeholder for a proper parser or assumes Browser env.
// For the purpose of this task, we will implement a basic parser that handles the structure we generate.

function xmlToDict(xmlString) {
    // This is a very naive parser. In a real scenario, use a library.
    // But since we want zero-deps in toolbox, we might need to rely on environment.

    // Check if we are in browser
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, "text/xml");
        return parseDomElement(doc.documentElement);
    }

    // Node.js fallback (Very limited, just for testing our specific format)
    // Matches <tag attr="...">content</tag>
    // This is fragile and strictly for the demo/test environment provided.

    // We will throw error for now in Node if not simple
    throw new Error("XML Parsing requires DOMParser (Browser) or a library in Node.js");
}

function parseDomElement(elem) {
    const result = {};

    // Attributes
    for (let i = 0; i < elem.attributes.length; i++) {
        const attr = elem.attributes[i];
        result[`@${attr.name}`] = registry.hydrate(attr.value);
    }

    // Children
    let hasChildren = false;
    const childrenMap = {};
    for (let i = 0; i < elem.children.length; i++) {
        hasChildren = true;
        const child = elem.children[i];
        const childVal = parseDomElement(child);
        if (childrenMap[child.tagName]) {
            if (!Array.isArray(childrenMap[child.tagName])) {
                childrenMap[child.tagName] = [childrenMap[child.tagName]];
            }
            childrenMap[child.tagName].push(childVal);
        } else {
            childrenMap[child.tagName] = childVal;
        }
    }
    Object.assign(result, childrenMap);

    // Text
    const text = elem.textContent.trim();
    if (text && !hasChildren) {
        if (elem.attributes.length === 0) {
            return registry.hydrate(text);
        }
        result['#text'] = registry.hydrate(text);
    }

    return { [elem.tagName]: result };
}

module.exports = {
    dictToXml,
    xmlToDict
};

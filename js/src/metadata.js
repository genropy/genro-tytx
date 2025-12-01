/**
 * TYTX Metadata Parser for JavaScript.
 *
 * Parses metadata strings like: [len:5, reg:"[A-Z]{2}", enum:A|B|C]
 * Pure JavaScript implementation without external parser dependencies.
 *
 * @module metadata
 */

/**
 * Known metadata keys.
 *
 * Validation facets:
 * - len: Exact length
 * - min: Minimum length/value
 * - max: Maximum length/value
 * - dec: Decimal places
 * - reg: Regex pattern
 * - enum: Allowed values (pipe-separated)
 *
 * UI facets:
 * - lbl: Label
 * - ph: Placeholder
 * - hint: Tooltip hint
 * - def: Default value
 * - ro: Read-only flag
 * - hidden: Hidden field flag
 */
const KNOWN_KEYS = new Set([
    // Validation facets
    'len',
    'min',
    'max',
    'dec',
    'reg',
    'enum',
    // UI facets
    'lbl',
    'ph',
    'hint',
    'def',
    'ro',
    'hidden',
]);

/**
 * Error thrown when metadata parsing fails.
 */
class MetadataParseError extends Error {
    /**
     * @param {string} message - Error message
     */
    constructor(message) {
        super(message);
        this.name = 'MetadataParseError';
    }
}

/**
 * Parse metadata string to dictionary.
 *
 * @param {string} text - Metadata string without brackets, e.g. 'len:5, reg:"[A-Z]{2}"'
 * @returns {Object.<string, string>} Dictionary of metadata key-value pairs
 * @throws {MetadataParseError} If parsing fails
 *
 * @example
 * parseMetadata('len:5')
 * // → { len: '5' }
 *
 * parseMetadata('len:5, reg:"[A-Z]{2}"')
 * // → { len: '5', reg: '[A-Z]{2}' }
 *
 * parseMetadata('enum:A|B|C')
 * // → { enum: 'A|B|C' }
 */
function parseMetadata(text) {
    if (!text || !text.trim()) {
        return {};
    }

    const result = {};
    const trimmed = text.trim();
    let pos = 0;

    while (pos < trimmed.length) {
        // Skip whitespace
        while (pos < trimmed.length && /\s/.test(trimmed[pos])) {
            pos++;
        }

        if (pos >= trimmed.length) break;

        // Parse key (lowercase letters and underscores)
        const keyStart = pos;
        while (pos < trimmed.length && /[a-z_]/.test(trimmed[pos])) {
            pos++;
        }
        const key = trimmed.slice(keyStart, pos);

        if (!key) {
            throw new MetadataParseError(`Expected key at position ${pos}`);
        }

        // Skip whitespace
        while (pos < trimmed.length && /\s/.test(trimmed[pos])) {
            pos++;
        }

        // Expect colon
        if (trimmed[pos] !== ':') {
            throw new MetadataParseError(`Expected ':' after key '${key}' at position ${pos}`);
        }
        pos++;

        // Skip whitespace
        while (pos < trimmed.length && /\s/.test(trimmed[pos])) {
            pos++;
        }

        // Parse value
        let value;

        if (trimmed[pos] === '"') {
            // Quoted string
            pos++; // Skip opening quote
            let valueChars = '';
            while (pos < trimmed.length && trimmed[pos] !== '"') {
                if (trimmed[pos] === '\\' && pos + 1 < trimmed.length) {
                    // Handle escape sequences
                    const nextChar = trimmed[pos + 1];
                    if (nextChar === '"') {
                        valueChars += '"';
                        pos += 2;
                    } else if (nextChar === '\\') {
                        valueChars += '\\';
                        pos += 2;
                    } else {
                        valueChars += trimmed[pos];
                        pos++;
                    }
                } else {
                    valueChars += trimmed[pos];
                    pos++;
                }
            }
            if (trimmed[pos] !== '"') {
                throw new MetadataParseError(`Unterminated quoted string for key '${key}'`);
            }
            pos++; // Skip closing quote
            value = valueChars;
        } else {
            // Unquoted value (simple or enum with pipes)
            const valueStart = pos;
            while (pos < trimmed.length && trimmed[pos] !== ',' && trimmed[pos] !== ']') {
                pos++;
            }
            value = trimmed.slice(valueStart, pos).trim();
        }

        result[key] = value;

        // Skip whitespace
        while (pos < trimmed.length && /\s/.test(trimmed[pos])) {
            pos++;
        }

        // Check for comma or end
        if (pos < trimmed.length) {
            if (trimmed[pos] === ',') {
                pos++;
            } else if (trimmed[pos] !== ']') {
                // Allow trailing content for bracket handling
                break;
            }
        }
    }

    return result;
}

/**
 * Check if a value needs to be quoted.
 * @param {string} value - Value to check
 * @param {string} key - Key name
 * @returns {boolean}
 * @private
 */
function needsQuotes(value, key) {
    // Don't quote enum values (they use | separator)
    if (key === 'enum' || value.includes('|')) {
        return false;
    }

    // Quote if contains special chars
    const specialChars = [',', '[', ']', ':', '"', '\\', '{', '}', '(', ')'];
    return specialChars.some(char => value.includes(char));
}

/**
 * Format metadata dictionary to string.
 *
 * @param {Object.<string, string>} data - Dictionary of metadata key-value pairs
 * @returns {string} Formatted metadata string (without brackets)
 *
 * @example
 * formatMetadata({ len: '5' })
 * // → 'len:5'
 *
 * formatMetadata({ len: '5', reg: '[A-Z]{2}' })
 * // → 'len:5, reg:"[A-Z]{2}"'
 *
 * formatMetadata({ enum: 'A|B|C' })
 * // → 'enum:A|B|C'
 */
function formatMetadata(data) {
    if (!data || Object.keys(data).length === 0) {
        return '';
    }

    const parts = [];

    for (const [key, value] of Object.entries(data)) {
        const valueStr = String(value);

        if (needsQuotes(valueStr, key)) {
            // Escape quotes and backslashes
            const escaped = valueStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            parts.push(`${key}:"${escaped}"`);
        } else {
            parts.push(`${key}:${valueStr}`);
        }
    }

    return parts.join(', ');
}

/**
 * Validate metadata dictionary.
 *
 * @param {Object.<string, string>} data - Metadata dictionary
 * @param {boolean} [strict=false] - If true, throw error for unknown keys
 * @throws {Error} If validation fails in strict mode
 *
 * @example
 * validateMetadata({ len: '5', lbl: 'Label' }, true);  // OK
 * validateMetadata({ unknown: 'value' }, true);  // throws Error
 * validateMetadata({ unknown: 'value' }, false); // OK
 */
function validateMetadata(data, strict = false) {
    for (const key of Object.keys(data)) {
        if (strict && !KNOWN_KEYS.has(key)) {
            throw new Error(`Unknown metadata key: '${key}'`);
        }
    }
}

module.exports = {
    KNOWN_KEYS,
    MetadataParseError,
    parseMetadata,
    formatMetadata,
    validateMetadata
};

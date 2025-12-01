/**
 * TYTX Metadata Parser for TypeScript.
 *
 * Parses metadata strings like: [len:5, reg:"[A-Z]{2}", enum:A|B|C]
 * Pure TypeScript implementation without external parser dependencies.
 *
 * @module metadata
 */

/**
 * Metadata dictionary type.
 */
export type MetadataDict = Record<string, string>;

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
export const KNOWN_KEYS = new Set([
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
export class MetadataParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetadataParseError';
  }
}

/**
 * Parse metadata string to dictionary.
 *
 * @param text - Metadata string without brackets, e.g. 'len:5, reg:"[A-Z]{2}"'
 * @returns Dictionary of metadata key-value pairs
 * @throws MetadataParseError if parsing fails
 *
 * @example
 * ```ts
 * parseMetadata('len:5')
 * // → { len: '5' }
 *
 * parseMetadata('len:5, reg:"[A-Z]{2}"')
 * // → { len: '5', reg: '[A-Z]{2}' }
 *
 * parseMetadata('enum:A|B|C')
 * // → { enum: 'A|B|C' }
 * ```
 */
export function parseMetadata(text: string): MetadataDict {
  if (!text || !text.trim()) {
    return {};
  }

  const result: MetadataDict = {};
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
    let value: string;

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
 */
function needsQuotes(value: string, key: string): boolean {
  // Don't quote enum values (they use | separator)
  if (key === 'enum' || value.includes('|')) {
    return false;
  }

  // Quote if contains special chars
  const specialChars = [',', '[', ']', ':', '"', '\\', '{', '}', '(', ')'];
  return specialChars.some((char) => value.includes(char));
}

/**
 * Format metadata dictionary to string.
 *
 * @param data - Dictionary of metadata key-value pairs
 * @returns Formatted metadata string (without brackets)
 *
 * @example
 * ```ts
 * formatMetadata({ len: '5' })
 * // → 'len:5'
 *
 * formatMetadata({ len: '5', reg: '[A-Z]{2}' })
 * // → 'len:5, reg:"[A-Z]{2}"'
 *
 * formatMetadata({ enum: 'A|B|C' })
 * // → 'enum:A|B|C'
 * ```
 */
export function formatMetadata(data: MetadataDict): string {
  if (!data || Object.keys(data).length === 0) {
    return '';
  }

  const parts: string[] = [];

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
 * @param data - Metadata dictionary
 * @param strict - If true, throw error for unknown keys
 * @throws Error if validation fails in strict mode
 *
 * @example
 * ```ts
 * validateMetadata({ len: '5', lbl: 'Label' }, true);  // OK
 * validateMetadata({ unknown: 'value' }, true);  // throws Error
 * validateMetadata({ unknown: 'value' }, false); // OK
 * ```
 */
export function validateMetadata(data: MetadataDict, strict = false): void {
  for (const key of Object.keys(data)) {
    if (strict && !KNOWN_KEYS.has(key)) {
      throw new Error(`Unknown metadata key: '${key}'`);
    }
  }
}

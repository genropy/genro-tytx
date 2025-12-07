/**
 * TYTX Fetch - HTTP client with automatic TYTX encoding/decoding
 *
 * @module fetch
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { toTypedText } from './encode';
import { fromText } from './decode';
import { isDecimalInstance } from './registry';
import { DecimalValue } from './types';

/** Options for tytx_fetch */
export interface TYTXFetchOptions extends Omit<RequestInit, 'body'> {
    /** Query parameters - typed values are encoded */
    query?: Record<string, unknown>;

    /** Request body - encoded as TYTX JSON */
    body?: unknown;

    /** Skip TYTX encoding for body */
    rawBody?: boolean;

    /** Skip TYTX decoding for response */
    rawResponse?: boolean;

    /** Header prefix for typed values (default: "x-tytx-") */
    headerPrefix?: string;
}

/**
 * Create a Date representing a date-only value (midnight UTC).
 *
 * @param year - Full year (e.g., 2025)
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @returns Date at midnight UTC
 */
export function createDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Create a Date representing a time-only value (epoch date: 1970-01-01).
 *
 * @param hours - Hours (0-23)
 * @param minutes - Minutes (0-59)
 * @param seconds - Seconds (0-59)
 * @param milliseconds - Milliseconds (0-999)
 * @returns Date at epoch with specified time
 */
export function createTime(
    hours: number,
    minutes: number,
    seconds: number = 0,
    milliseconds: number = 0
): Date {
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds, milliseconds));
}

/**
 * Create a full datetime.
 *
 * @param year - Full year
 * @param month - Month (1-12)
 * @param day - Day of month
 * @param hours - Hours (0-23)
 * @param minutes - Minutes (0-59)
 * @param seconds - Seconds (0-59)
 * @param milliseconds - Milliseconds (0-999)
 * @returns Full datetime in UTC
 */
export function createDateTime(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    seconds: number = 0,
    milliseconds: number = 0
): Date {
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
}

/**
 * Check if a value is a typed value that should be encoded.
 */
function isTypedValue(value: unknown): value is Date | DecimalValue {
    return value instanceof Date || isDecimalInstance(value);
}

/**
 * Serialize a value for query string or header.
 */
function serializeTypedValue(value: Date | DecimalValue): string {
    if (value instanceof Date) {
        // Check if date-only (midnight UTC)
        if (
            value.getUTCHours() === 0 &&
            value.getUTCMinutes() === 0 &&
            value.getUTCSeconds() === 0 &&
            value.getUTCMilliseconds() === 0 &&
            !(value.getUTCFullYear() === 1970 && value.getUTCMonth() === 0 && value.getUTCDate() === 1)
        ) {
            const y = value.getUTCFullYear();
            const m = String(value.getUTCMonth() + 1).padStart(2, '0');
            const d = String(value.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}::D`;
        }
        // Check if time-only (epoch date)
        if (value.getUTCFullYear() === 1970 && value.getUTCMonth() === 0 && value.getUTCDate() === 1) {
            const h = String(value.getUTCHours()).padStart(2, '0');
            const mi = String(value.getUTCMinutes()).padStart(2, '0');
            const s = String(value.getUTCSeconds()).padStart(2, '0');
            const ms = value.getUTCMilliseconds();
            if (ms === 0) {
                return `${h}:${mi}:${s}::H`;
            }
            return `${h}:${mi}:${s}.${String(ms).padStart(3, '0')}::H`;
        }
        // Full datetime
        return `${value.toISOString()}::DHZ`;
    }
    // Decimal
    return `${value.toString()}::N`;
}

/**
 * Encode a single value for query string or header.
 */
function encodeValue(value: unknown): string {
    if (isTypedValue(value)) {
        return serializeTypedValue(value);
    }
    return String(value);
}

/**
 * Encode an object to URL query string with TYTX values.
 *
 * @param params - Object with parameter values
 * @returns URL-encoded query string (without leading ?)
 *
 * @example
 * ```typescript
 * encodeQueryString({ date: createDate(2025, 1, 15), limit: 10 })
 * // "date=2025-01-15::D&limit=10"
 * ```
 */
export function encodeQueryString(params: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue;
        }
        const encoded = encodeValue(value);
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
    }
    return parts.join('&');
}

/**
 * Decode a URL query string with TYTX values.
 *
 * @param queryString - Query string (without leading ?)
 * @returns Object with decoded values
 *
 * @example
 * ```typescript
 * decodeQueryString("date=2025-01-15::D&limit=10")
 * // { date: Date, limit: "10" }
 * ```
 */
export function decodeQueryString(queryString: string): Record<string, unknown> {
    if (!queryString) {
        return {};
    }

    const result: Record<string, unknown> = {};
    const params = new URLSearchParams(queryString);

    for (const [key, value] of params.entries()) {
        // Check for TYTX suffix
        const match = value.match(/^(.+)::([A-Z]+)$/);
        if (match) {
            // Try to decode as typed value
            const decoded = fromText(`"${value}"`);
            result[key] = decoded;
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * TYTX Fetch - Drop-in replacement for fetch with automatic TYTX encoding/decoding.
 *
 * @param url - Request URL
 * @param options - Fetch options with TYTX extensions
 * @returns Decoded response body, or Response if rawResponse=true
 *
 * @example
 * ```typescript
 * const result = await tytx_fetch('/api/invoice', {
 *     method: 'POST',
 *     query: { date: createDate(2025, 1, 15) },
 *     body: { price: new Decimal('100.50') }
 * });
 * ```
 */
export async function tytx_fetch<T = unknown>(
    url: string | URL,
    options: TYTXFetchOptions = {}
): Promise<T> {
    const {
        query,
        body,
        headers = {},
        rawBody = false,
        rawResponse = false,
        headerPrefix = 'x-tytx-',
        ...fetchOptions
    } = options;

    // Build URL with query string
    let finalUrl: string = String(url);
    if (query && Object.keys(query).length > 0) {
        const qs = encodeQueryString(query);
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${separator}${qs}`;
    }

    // Build headers
    const finalHeaders: Record<string, string> = {};
    const prefixLower = headerPrefix.toLowerCase();

    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        const keyLower = key.toLowerCase();
        if (keyLower.startsWith(prefixLower) && isTypedValue(value)) {
            finalHeaders[key] = encodeValue(value);
        } else {
            finalHeaders[key] = String(value);
        }
    }

    // Build body
    let finalBody: string | undefined;
    if (body !== undefined && body !== null) {
        if (rawBody) {
            finalBody = body as string;
        } else {
            finalBody = toTypedText(body);
            finalHeaders['Content-Type'] = 'application/vnd.tytx+json';
        }
    }

    // Make request
    const response = await fetch(finalUrl, {
        ...fetchOptions,
        headers: finalHeaders,
        body: finalBody,
    });

    if (rawResponse) {
        return response as unknown as T;
    }

    // Decode response
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('json') || contentType.includes('tytx')) {
        const text = await response.text();
        if (text) {
            return fromText<T>(text);
        }
        return null as unknown as T;
    }

    // Return raw text for non-JSON responses
    return (await response.text()) as unknown as T;
}

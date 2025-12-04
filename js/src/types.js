/**
 * TYTX Built-in Types
 *
 * Defines the 9 built-in data types for the TYTX protocol.
 *
 * @module types
 */

const { registry } = require('./registry');

/**
 * Decimal library support.
 * Priority: big.js > decimal.js > native Number
 *
 * Install one of these for precise decimal arithmetic:
 *   npm install big.js       # Lightweight (8KB)
 *   npm install decimal.js   # Full-featured (32KB)
 */
let DecimalLib = null;
let decimalLibName = 'number';

// Try big.js first (lighter)
try {
    DecimalLib = require('big.js');
    decimalLibName = 'big.js';
} catch {
    // Try decimal.js as fallback
    try {
        DecimalLib = require('decimal.js');
        decimalLibName = 'decimal.js';
    } catch {
        // No decimal library, will use native Number
    }
}

/**
 * Check if a value is a Decimal instance (Big or Decimal.js)
 */
function isDecimalInstance(value) {
    if (!DecimalLib) return false;
    return value instanceof DecimalLib ||
           (value && value.constructor && value.constructor.name === DecimalLib.name);
}

/**
 * Integer type - whole numbers.
 * L = Long integer
 */
const IntType = {
    name: 'int',
    code: 'L',
    js_type: 'number',

    parse(value) {
        return parseInt(value, 10);
    },

    serialize(value) {
        return String(Math.trunc(value));
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.NumberFormat(locale).format(value);
        }
        return String(value);
    }
};

/**
 * Float type - decimal numbers with limited precision.
 * R = Real number
 */
const FloatType = {
    name: 'float',
    code: 'R',
    js_type: 'number',

    parse(value) {
        return parseFloat(value);
    },

    serialize(value) {
        return String(value);
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.NumberFormat(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
        }
        return value.toFixed(2);
    }
};

/**
 * Boolean type - true/false values.
 */
const BoolType = {
    name: 'bool',
    code: 'B',
    js_type: 'boolean',

    parse(value) {
        const lower = value.toLowerCase();
        return ['true', '1', 'yes', 't', 'on', 'y'].includes(lower);
    },

    serialize(value) {
        return value ? 'true' : 'false';
    }
};

/**
 * String/text type.
 * T = Text
 */
const StrType = {
    name: 'str',
    code: 'T',
    js_type: 'string',

    parse(value) {
        return value;
    },

    serialize(value) {
        return String(value);
    }
};

/**
 * JSON type - serialized object/array structures.
 * JS = JavaScript object
 */
const JsonType = {
    name: 'json',
    code: 'JS',
    js_type: 'object',

    parse(value) {
        return JSON.parse(value);
    },

    serialize(value) {
        return JSON.stringify(value);
    }
};

/**
 * Decimal type - exact decimal numbers (for money, etc.).
 * Uses big.js or decimal.js if available, otherwise native Number.
 * N = Numeric
 */
const DecimalType = {
    name: 'decimal',
    code: 'N',
    js_type: DecimalLib ? decimalLibName : 'number',

    parse(value) {
        if (DecimalLib) {
            return new DecimalLib(value);
        }
        return parseFloat(value);
    },

    serialize(value) {
        if (isDecimalInstance(value)) {
            return value.toString();
        }
        return String(value);
    },

    format(value, fmt, locale) {
        // Convert to number for Intl formatting
        const num = isDecimalInstance(value) ? parseFloat(value.toString()) : value;
        if (locale) {
            return new Intl.NumberFormat(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);
        }
        return num.toFixed(2);
    }
};

/**
 * Date type - calendar date without time.
 * D = Date
 *
 * In JS, dates are stored as Date objects at midnight UTC.
 * This ensures consistent behavior across timezones.
 */
const DateType = {
    name: 'date',
    code: 'D',
    js_type: 'Date',

    parse(value) {
        // Parse ISO date (YYYY-MM-DD) as midnight UTC
        return new Date(value + 'T00:00:00.000Z');
    },

    serialize(value) {
        // Output ISO date (YYYY-MM-DD) using UTC
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                timeZone: 'UTC'
            }).format(value);
        }
        return this.serialize(value);
    }
};

/**
 * DateTime type - date with time (timezone-aware).
 * DHZ = Date Hour Zulu (timezone-aware)
 *
 * DHZ preserves timezone information. When serialized, always outputs
 * with Z suffix for UTC. This allows cross-timezone operations:
 * America -> Paris (save as UTC) -> Tokyo (view as local or UTC).
 */
const DateTimeType = {
    name: 'datetime',
    code: 'DHZ',
    js_type: 'Date',

    parse(value) {
        // Parse ISO datetime
        return new Date(value);
    },

    serialize(value) {
        // Output ISO datetime with Z suffix for UTC
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        const seconds = String(value.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'UTC'
            }).format(value);
        }
        return this.serialize(value);
    }
};

/**
 * Naive DateTime type - date with time (no timezone).
 * DH = Date Hour (deprecated)
 *
 * DEPRECATED: Use DateTimeType (DHZ) instead.
 *
 * DH is for naive datetimes without timezone info.
 * Serializes as ISO format without Z suffix.
 */
const NaiveDateTimeType = {
    name: 'naive_datetime',
    code: 'DH',
    js_type: 'Date',

    parse(value) {
        return new Date(value);
    },

    serialize(value) {
        // Output ISO datetime WITHOUT Z suffix
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        const seconds = String(value.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'UTC'
            }).format(value);
        }
        return this.serialize(value);
    }
};

/**
 * Time type - time without date.
 * H = Hour
 *
 * In JS, time is stored as Date on epoch (1970-01-01) UTC.
 * This allows smart detection: any Date with year=1970, month=0, day=1
 * is treated as time-only.
 */
const TimeType = {
    name: 'time',
    code: 'H',
    js_type: 'Date',

    parse(value) {
        // Parse time string (HH:MM:SS) as Date on epoch UTC
        return new Date('1970-01-01T' + value + 'Z');
    },

    serialize(value) {
        // Extract time part using UTC
        if (value instanceof Date) {
            const hours = String(value.getUTCHours()).padStart(2, '0');
            const minutes = String(value.getUTCMinutes()).padStart(2, '0');
            const seconds = String(value.getUTCSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }
        return String(value);
    }
};

/**
 * None/Null type - explicit null values.
 * NN = None/Null
 *
 * Type code NN represents None/null values. Content before :: is ignored.
 * Matches Python NoneType behavior.
 */
const NoneType = {
    name: 'none',
    code: 'NN',
    js_type: 'null',

    parse(value) {
        // Always returns null, ignoring input
        return null;
    },

    serialize(value) {
        // Serialize null as empty string
        return '';
    }
};

/**
 * Register all built-in types.
 */
function register_builtins() {
    registry.register(IntType);
    registry.register(FloatType);
    registry.register(BoolType);
    registry.register(StrType);
    registry.register(JsonType);
    registry.register(DecimalType);
    registry.register(DateType);
    registry.register(DateTimeType);
    registry.register(NaiveDateTimeType);  // DH - deprecated
    registry.register(TimeType);
    registry.register(NoneType);
}

// Auto-register on module load
register_builtins();

module.exports = {
    IntType,
    FloatType,
    BoolType,
    StrType,
    JsonType,
    DecimalType,
    DateType,
    DateTimeType,
    NaiveDateTimeType,
    TimeType,
    NoneType,
    register_builtins,
    // Decimal library info
    DecimalLib,
    decimalLibName,
    isDecimalInstance
};

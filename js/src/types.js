/**
 * TYTX Built-in Types
 *
 * Defines the 9 built-in data types for the TYTX protocol.
 *
 * @module types
 */

const { registry } = require('./registry');

/**
 * Integer type - whole numbers.
 * Genropy: L for long/int
 */
const IntType = {
    name: 'int',
    code: 'L',
    aliases: ['LONG', 'LONGINT', 'I', 'INT', 'INTEGER'],
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
 * Genropy: R for real/float
 */
const FloatType = {
    name: 'float',
    code: 'R',
    aliases: ['REAL', 'FLOAT', 'F'],
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
    aliases: ['boolean', 'BOOL', 'BOOLEAN'],
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
 * Genropy: T for text
 */
const StrType = {
    name: 'str',
    code: 'T',
    aliases: ['TEXT', 'P', 'A', 'S', 'STRING'],
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
 * Genropy: JS for json
 */
const JsonType = {
    name: 'json',
    code: 'JS',
    aliases: ['JSON', 'J'],
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
 * Note: JavaScript has no native Decimal, so we use Number.
 * Genropy: N for numeric/decimal
 */
const DecimalType = {
    name: 'decimal',
    code: 'N',
    aliases: ['NUMERIC', 'DECIMAL', 'D'],
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
 * Date type - calendar date without time.
 * Genropy: D for date
 */
const DateType = {
    name: 'date',
    code: 'D',
    aliases: ['DATE'],
    js_type: 'Date',

    parse(value) {
        // Parse ISO date (YYYY-MM-DD)
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    serialize(value) {
        // Output ISO date (YYYY-MM-DD)
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(value);
        }
        return this.serialize(value);
    }
};

/**
 * DateTime type - date with time.
 * Genropy: DH for datetime
 */
const DateTimeType = {
    name: 'datetime',
    code: 'DH',
    aliases: ['DATETIME', 'DT', 'DHZ', 'timestamp'],
    js_type: 'Date',

    parse(value) {
        // Parse ISO datetime
        return new Date(value);
    },

    serialize(value) {
        // Output ISO datetime
        return value.toISOString();
    },

    format(value, fmt, locale) {
        if (locale) {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(value);
        }
        return this.serialize(value);
    }
};

/**
 * Time type - time without date.
 * Genropy: H for time (hour)
 */
const TimeType = {
    name: 'time',
    code: 'H',
    aliases: ['TIME', 'HZ'],
    js_type: 'string',

    parse(value) {
        // Return time as string (JS has no native time type)
        return value;
    },

    serialize(value) {
        // If Date object, extract time part
        if (value instanceof Date) {
            const hours = String(value.getHours()).padStart(2, '0');
            const minutes = String(value.getMinutes()).padStart(2, '0');
            const seconds = String(value.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }
        return String(value);
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
    registry.register(TimeType);
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
    TimeType,
    register_builtins
};

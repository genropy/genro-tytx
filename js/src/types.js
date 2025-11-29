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
 */
const IntType = {
    name: 'int',
    code: 'I',
    aliases: ['integer', 'long', 'INT', 'INTEGER', 'LONG', 'LONGINT'],
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
 */
const FloatType = {
    name: 'float',
    code: 'F',
    aliases: ['double', 'real', 'FLOAT', 'REAL', 'R'],
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
 */
const StrType = {
    name: 'str',
    code: 'S',
    aliases: ['string', 'text', 'T', 'TEXT', 'A', 'P'],
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
 */
const JsonType = {
    name: 'json',
    code: 'J',
    aliases: ['JS'],
    js_type: 'object',

    parse(value) {
        return JSON.parse(value);
    },

    serialize(value) {
        return JSON.stringify(value);
    }
};

/**
 * Comma-separated list type.
 */
const ListType = {
    name: 'list',
    code: 'L',
    aliases: ['array'],
    js_type: 'Array',

    parse(value) {
        return value ? value.split(',') : [];
    },

    serialize(value) {
        if (Array.isArray(value)) {
            return value.map(String).join(',');
        }
        return String(value);
    }
};

/**
 * Decimal type - exact decimal numbers (for money, etc.).
 * Note: JavaScript has no native Decimal, so we use Number.
 */
const DecimalType = {
    name: 'decimal',
    code: 'D',
    aliases: ['dec', 'numeric', 'N', 'NUMERIC', 'DECIMAL'],
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
 */
const DateType = {
    name: 'date',
    code: 'd',
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
 */
const DateTimeType = {
    name: 'datetime',
    code: 'dt',
    aliases: ['DATETIME', 'DT', 'DH', 'DHZ', 'timestamp'],
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
 * Register all built-in types.
 */
function register_builtins() {
    registry.register(IntType);
    registry.register(FloatType);
    registry.register(BoolType);
    registry.register(StrType);
    registry.register(JsonType);
    registry.register(ListType);
    registry.register(DecimalType);
    registry.register(DateType);
    registry.register(DateTimeType);
}

// Auto-register on module load
register_builtins();

module.exports = {
    IntType,
    FloatType,
    BoolType,
    StrType,
    JsonType,
    ListType,
    DecimalType,
    DateType,
    DateTimeType,
    register_builtins
};

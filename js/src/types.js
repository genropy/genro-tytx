/**
 * TYTX Base - Built-in Types
 *
 * Scalar types for the TYTX protocol.
 *
 * @module types
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

const { registry, isDecimalInstance, DecimalLib, decimalLibName } = require('./registry');

/**
 * Integer type (L = Long)
 */
const IntType = {
    code: 'L',
    parse(value) {
        return parseInt(value, 10);
    },
    serialize(value) {
        return String(Math.trunc(value));
    }
};

/**
 * Float type (R = Real)
 */
const FloatType = {
    code: 'R',
    parse(value) {
        return parseFloat(value);
    },
    serialize(value) {
        return String(value);
    }
};

/**
 * Boolean type (B)
 */
const BoolType = {
    code: 'B',
    parse(value) {
        const lower = String(value).toLowerCase();
        return ['true', '1', 'yes', 't', 'on', 'y'].includes(lower);
    },
    serialize(value) {
        return value ? '1' : '0';
    }
};

/**
 * String type (T = Text)
 */
const StrType = {
    code: 'T',
    parse(value) {
        return String(value);
    },
    serialize(value) {
        return String(value);
    }
};

/**
 * Decimal type (N = Numeric)
 * Uses big.js or decimal.js if available.
 */
const DecimalType = {
    code: 'N',
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
    }
};

/**
 * Date type (D)
 */
const DateType = {
    code: 'D',
    parse(value) {
        return new Date(value + 'T00:00:00.000Z');
    },
    serialize(value) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};

/**
 * DateTime type (DHZ = Date Hour Zulu)
 * Serializes with millisecond precision per spec 6.3.
 */
const DateTimeType = {
    code: 'DHZ',
    parse(value) {
        return new Date(value);
    },
    serialize(value) {
        // Use toISOString() for millisecond precision
        // Omit .000 when milliseconds are zero for cleaner output
        const iso = value.toISOString();
        return iso.replace('.000Z', 'Z');
    }
};

/**
 * Naive DateTime type (DH - deprecated)
 */
const NaiveDateTimeType = {
    code: 'DH',
    parse(value) {
        return new Date(value);
    },
    serialize(value) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        const seconds = String(value.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }
};

/**
 * Time type (H = Hour)
 * Serializes with millisecond precision per spec 6.4.
 */
const TimeType = {
    code: 'H',
    parse(value) {
        return new Date('1970-01-01T' + value + 'Z');
    },
    serialize(value) {
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        const seconds = String(value.getUTCSeconds()).padStart(2, '0');
        const millis = value.getUTCMilliseconds();
        if (millis === 0) {
            return `${hours}:${minutes}:${seconds}`;
        }
        return `${hours}:${minutes}:${seconds}.${String(millis).padStart(3, '0')}`;
    }
};

/**
 * Register all built-in types.
 */
function registerBuiltins() {
    registry.register(IntType);
    registry.register(FloatType);
    registry.register(BoolType);
    registry.register(StrType);
    registry.register(DecimalType);
    registry.register(DateType);
    registry.register(DateTimeType);
    registry.register(NaiveDateTimeType);
    registry.register(TimeType);
}

// Auto-register on module load
registerBuiltins();

module.exports = {
    IntType,
    FloatType,
    BoolType,
    StrType,
    DecimalType,
    DateType,
    DateTimeType,
    NaiveDateTimeType,
    TimeType,
    registerBuiltins,
    DecimalLib,
    decimalLibName,
    isDecimalInstance
};

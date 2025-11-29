/**
 * TYTX (Typed Text) - A protocol for exchanging typed data over text-based formats.
 *
 * Public API:
 *     // Text conversion
 *     from_text("100::D")       ’ 100 (Number)
 *     as_text(100)              ’ "100"
 *     as_typed_text(100)        ’ "100::I"
 *
 *     // JSON conversion
 *     as_json(data)             ’ standard JSON (for external systems)
 *     as_typed_json(data)       ’ JSON with ::type (TYTX format)
 *     from_json(json_str)       ’ object with hydrated values
 *
 *     // XML conversion
 *     as_xml(data)              ’ standard XML (for external systems)
 *     as_typed_xml(data)        ’ XML with ::type (TYTX format)
 *     from_xml(xml_str)         ’ object with attrs/value structure
 *
 * @module genro-tytx
 * @version 0.1.0
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

// Import registry and ensure types are registered
const { TypeRegistry, registry } = require('./registry');
require('./types'); // Side effect: registers built-in types

// Import utilities
const { as_json, as_typed_json, from_json } = require('./json_utils');
const { as_xml, as_typed_xml, from_xml } = require('./xml_utils');

// Import type definitions
const {
    IntType,
    FloatType,
    BoolType,
    StrType,
    JsonType,
    ListType,
    DecimalType,
    DateType,
    DateTimeType
} = require('./types');

// Public API functions (bound to registry)
const from_text = registry.from_text.bind(registry);
const as_text = registry.as_text.bind(registry);
const as_typed_text = registry.as_typed_text.bind(registry);

const VERSION = '0.1.0';

module.exports = {
    // Version
    VERSION,

    // Text API
    from_text,
    as_text,
    as_typed_text,

    // JSON API
    as_json,
    as_typed_json,
    from_json,

    // XML API
    as_xml,
    as_typed_xml,
    from_xml,

    // Registry
    registry,
    TypeRegistry,

    // Type definitions
    IntType,
    FloatType,
    BoolType,
    StrType,
    JsonType,
    ListType,
    DecimalType,
    DateType,
    DateTimeType
};

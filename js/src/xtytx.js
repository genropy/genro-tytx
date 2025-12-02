/**
 * XTYTX envelope processing for TYTX JavaScript implementation.
 *
 * This module provides transport-agnostic logic for processing XTYTX envelopes.
 * XTYTX is the extended envelope format that includes:
 * - gstruct: Global struct definitions (registered globally) - for type hydration
 * - lstruct: Local struct definitions (document-specific) - for type hydration
 * - gschema: Global JSON Schema definitions (registered globally) - for validation
 * - lschema: Local JSON Schema definitions (document-specific) - for validation
 * - data: The actual TYTX payload
 *
 * TYTX is a transport format, not a validator. Validation is delegated to JSON Schema.
 *
 * @module xtytx
 */

const { registry } = require('./registry');

/**
 * Registry for JSON Schema definitions.
 * JSON Schemas are used for client-side validation. TYTX core does not
 * perform validation - it only handles type hydration.
 */
class SchemaRegistry {
    constructor() {
        this._schemas = {};
    }

    /**
     * Register a JSON Schema by name.
     * @param {string} name - Schema name (typically matches struct code)
     * @param {Object} schema - JSON Schema object
     */
    register(name, schema) {
        this._schemas[name] = schema;
    }

    /**
     * Remove a schema by name.
     * @param {string} name - Schema name
     */
    unregister(name) {
        delete this._schemas[name];
    }

    /**
     * Get schema by name.
     * @param {string} name - Schema name
     * @returns {Object|undefined} JSON Schema or undefined
     */
    get(name) {
        return this._schemas[name];
    }

    /**
     * Return list of all registered schema names.
     * @returns {string[]} Array of schema names
     */
    listSchemas() {
        return Object.keys(this._schemas);
    }
}

// Global schema registry instance
const schemaRegistry = new SchemaRegistry();

/**
 * @typedef {Object} XtytxResult
 * @property {*} data - The hydrated data from the envelope (or null if empty)
 * @property {Object|null} globalSchemas - gschema entries from envelope (registered globally)
 * @property {Object|null} localSchemas - lschema entries from envelope (document-specific)
 */

/**
 * Process XTYTX envelope (transport-agnostic).
 *
 * Processing steps:
 * 1. Register gschema entries globally (overwrites existing)
 * 2. Register gstruct entries globally (overwrites existing)
 * 3. Build localStructs context from lstruct
 * 4. Build localSchemas context from lschema
 * 5. Decode data using hydrateFunc with local contexts
 * 6. Return XtytxResult with data and schema contexts
 *
 * @param {Object} envelope - Parsed XTYTX envelope
 * @param {Function} hydrateFunc - Function to hydrate parsed data: (dataStr, localStructs) => hydratedData
 * @param {string} [tytxPrefix='TYTX://'] - Prefix to strip from data field
 * @returns {XtytxResult} Result with hydrated data and schema contexts
 * @throws {Error} If required struct fields are missing
 */
function processEnvelope(envelope, hydrateFunc, tytxPrefix = 'TYTX://') {
    const { gstruct, lstruct } = envelope;
    let { data } = envelope;

    // Validate required fields
    if (gstruct === undefined) {
        throw new Error('XTYTX envelope missing required field: gstruct');
    }
    if (lstruct === undefined) {
        throw new Error('XTYTX envelope missing required field: lstruct');
    }
    if (data === undefined) {
        throw new Error('XTYTX envelope missing required field: data');
    }

    // Optional JSON Schema fields
    const gschema = envelope.gschema || null;
    const lschema = envelope.lschema || null;

    // Register gschema entries globally (overwrites existing)
    if (gschema) {
        for (const [name, schema] of Object.entries(gschema)) {
            schemaRegistry.register(name, schema);
        }
    }

    // Register gstruct entries globally (overwrites existing)
    for (const [code, schema] of Object.entries(gstruct)) {
        registry.register_struct(code, schema);
    }

    // If data is empty, return null with schema contexts
    if (!data) {
        return {
            data: null,
            globalSchemas: gschema,
            localSchemas: lschema,
        };
    }

    // Strip TYTX:// prefix from data if present
    if (data.startsWith(tytxPrefix)) {
        data = data.slice(tytxPrefix.length);
    }

    // Hydrate data with lstruct as local context
    const localStructs = Object.keys(lstruct).length > 0 ? lstruct : null;
    const hydrated = hydrateFunc(data, localStructs);

    return {
        data: hydrated,
        globalSchemas: gschema,
        localSchemas: lschema,
    };
}

module.exports = {
    SchemaRegistry,
    schemaRegistry,
    processEnvelope,
};

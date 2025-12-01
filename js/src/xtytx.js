/**
 * XTYTX envelope processing for TYTX JavaScript implementation.
 *
 * This module provides transport-agnostic logic for processing XTYTX envelopes.
 * XTYTX is the extended envelope format that includes:
 * - gstruct: Global struct definitions (registered globally)
 * - lstruct: Local struct definitions (document-specific)
 * - gvalidation: Global validation definitions (registered globally)
 * - lvalidation: Local validation definitions (document-specific)
 * - data: The actual TYTX payload
 *
 * @module xtytx
 */

const { registry } = require('./registry');
const { validationRegistry } = require('./validation');

/**
 * @typedef {Object} XtytxResult
 * @property {*} data - The hydrated data from the envelope (or null if empty)
 * @property {Object|null} globalValidations - gvalidation entries from envelope
 * @property {Object|null} localValidations - lvalidation entries from envelope
 */

/**
 * Process XTYTX envelope (transport-agnostic).
 *
 * Processing steps:
 * 1. Register gstruct entries globally (overwrites existing)
 * 2. Register gvalidation entries globally (overwrites existing)
 * 3. Build localStructs context from lstruct
 * 4. Build localValidations context from lvalidation
 * 5. Decode data using hydrateFunc with local contexts
 * 6. Return XtytxResult with data and validation contexts
 *
 * @param {Object} envelope - Parsed XTYTX envelope
 * @param {Function} hydrateFunc - Function to hydrate parsed data: (dataStr, localStructs) => hydratedData
 * @param {string} [tytxPrefix='TYTX://'] - Prefix to strip from data field
 * @returns {XtytxResult} Result with hydrated data and validation contexts
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

    // Optional validation fields
    const gvalidation = envelope.gvalidation || null;
    const lvalidation = envelope.lvalidation || null;

    // Register gstruct entries globally (overwrites existing)
    for (const [code, schema] of Object.entries(gstruct)) {
        registry.register_struct(code, schema);
    }

    // Register gvalidation entries globally (overwrites existing)
    if (gvalidation) {
        for (const [name, definition] of Object.entries(gvalidation)) {
            validationRegistry.register(name, definition);
        }
    }

    // If data is empty, return null with validation contexts
    if (!data) {
        return {
            data: null,
            globalValidations: gvalidation,
            localValidations: lvalidation,
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
        globalValidations: gvalidation,
        localValidations: lvalidation,
    };
}

module.exports = {
    processEnvelope,
};

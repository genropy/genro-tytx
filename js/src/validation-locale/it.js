/**
 * Italian locale validations for TYTX.
 *
 * Usage:
 *     const { validationRegistry } = require('genro-tytx');
 *     const it = require('genro-tytx/validation-locale/it');
 *
 *     // Register all Italian validations
 *     it.registerAll(validationRegistry);
 *
 *     // Or register individually
 *     validationRegistry.register('cf', it.VALIDATIONS.cf);
 *
 * @module validation-locale/it
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

/**
 * Italian validation definitions.
 * @type {Object.<string, import('../validation').ValidationDef>}
 */
const VALIDATIONS = {
    // Codice Fiscale
    cf: {
        pattern: '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$',
        len: 16,
        message: 'Codice Fiscale non valido'
    },

    // Partita IVA
    piva: {
        pattern: '^[0-9]{11}$',
        len: 11,
        message: 'Partita IVA non valida'
    },

    // Telefono italiano
    phone_it: {
        pattern: '^(\\+39)?[ ]?[0-9]{2,4}[ ]?[0-9]{4,8}$',
        message: 'Numero di telefono non valido'
    },

    // CAP (Codice Avviamento Postale)
    cap: {
        pattern: '^[0-9]{5}$',
        len: 5,
        message: 'CAP non valido'
    },

    // Targa auto italiana (formato attuale AA000AA)
    targa: {
        pattern: '^[A-Z]{2}[0-9]{3}[A-Z]{2}$',
        len: 7,
        message: 'Targa non valida (formato AA000AA)'
    },

    // Codice SDI (Sistema di Interscambio) per fatturazione elettronica
    sdi: {
        pattern: '^[A-Z0-9]{7}$',
        len: 7,
        message: 'Codice SDI non valido'
    },

    // PEC (Posta Elettronica Certificata)
    pec: {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.pec\\.it$',
        message: 'Indirizzo PEC non valido'
    },

    // Codice ATECO (attività economica)
    ateco: {
        pattern: '^[0-9]{2}\\.[0-9]{2}(\\.[0-9]{1,2})?$',
        message: 'Codice ATECO non valido (formato XX.XX o XX.XX.X)'
    },

    // Numero REA (Repertorio Economico Amministrativo)
    rea: {
        pattern: '^[A-Z]{2}[0-9]{6,7}$',
        message: 'Numero REA non valido (formato PPNNNNNN)'
    },

    // IBAN italiano
    iban_it: {
        pattern: '^IT[0-9]{2}[A-Z][0-9]{10}[A-Z0-9]{12}$',
        len: 27,
        message: 'IBAN italiano non valido'
    },

    // Codice CIG (Codice Identificativo Gara)
    cig: {
        pattern: '^[A-Z0-9]{10}$',
        len: 10,
        message: 'Codice CIG non valido'
    },

    // Codice CUP (Codice Unico Progetto)
    // Format: J31B17000510007 (1 letter + 2 digits + 1 letter + 2 digits + 9 alphanumeric)
    cup: {
        pattern: '^[A-Z][0-9]{2}[A-Z][0-9]{2}[A-Z0-9]{9}$',
        len: 15,
        message: 'Codice CUP non valido'
    }
};

/**
 * Register all Italian validations in the given registry.
 *
 * @param {import('../validation').ValidationRegistry} registry - ValidationRegistry instance
 */
function registerAll(registry) {
    for (const [name, definition] of Object.entries(VALIDATIONS)) {
        registry.register(name, definition);
    }
}

/**
 * Unregister all Italian validations from the given registry.
 *
 * @param {import('../validation').ValidationRegistry} registry - ValidationRegistry instance
 */
function unregisterAll(registry) {
    for (const name of Object.keys(VALIDATIONS)) {
        registry.unregister(name);
    }
}

module.exports = {
    VALIDATIONS,
    registerAll,
    unregisterAll
};

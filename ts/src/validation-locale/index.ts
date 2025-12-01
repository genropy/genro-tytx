/**
 * Locale-specific validations for TYTX.
 *
 * Available locales:
 *     - it: Italian validations (cf, piva, cap, targa, sdi, pec, etc.)
 *
 * Usage:
 *     import { validationRegistry } from 'genro-tytx';
 *     import { it } from 'genro-tytx/validation-locale';
 *
 *     // Register all Italian validations
 *     it.registerAll(validationRegistry);
 *
 * @module validation-locale
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

export * as it from './it';

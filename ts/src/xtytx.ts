/**
 * XTYTX envelope processing for TYTX TypeScript implementation.
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

import type { StructSchema, TytxValue } from './types.js';
import type { ValidationDef } from './validation.js';
import { registry } from './registry.js';
import { validationRegistry } from './validation.js';

/** XTYTX envelope structure */
export interface XtytxEnvelope {
  gstruct: Record<string, StructSchema>;
  lstruct: Record<string, StructSchema>;
  gvalidation?: Record<string, ValidationDef>;
  lvalidation?: Record<string, ValidationDef>;
  data: string;
}

/**
 * Result of processing an XTYTX envelope.
 */
export interface XtytxResult {
  /** The hydrated data from the envelope (or null if empty) */
  data: TytxValue;
  /** gvalidation entries from envelope (already registered globally) */
  globalValidations: Record<string, ValidationDef> | null;
  /** lvalidation entries from envelope (for document-specific use) */
  localValidations: Record<string, ValidationDef> | null;
}

/**
 * Type for hydration function passed to processEnvelope.
 */
export type HydrateFunc = (data: string, localStructs: Record<string, StructSchema> | null) => TytxValue;

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
 * @param envelope - Parsed XTYTX envelope
 * @param hydrateFunc - Function to hydrate parsed data
 * @param tytxPrefix - Prefix to strip from data field (default "TYTX://")
 * @returns XtytxResult with hydrated data and validation contexts
 */
export function processEnvelope(
  envelope: XtytxEnvelope,
  hydrateFunc: HydrateFunc,
  tytxPrefix = 'TYTX://',
): XtytxResult {
  const { gstruct, lstruct, data } = envelope;

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
  const gvalidation: Record<string, ValidationDef> | undefined = envelope.gvalidation;
  const lvalidation: Record<string, ValidationDef> | undefined = envelope.lvalidation;

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
      globalValidations: gvalidation ?? null,
      localValidations: lvalidation ?? null,
    };
  }

  // Strip TYTX:// prefix from data if present
  let dataStr = data;
  if (dataStr.startsWith(tytxPrefix)) {
    dataStr = dataStr.slice(tytxPrefix.length);
  }

  // Hydrate data with lstruct as local context
  const localStructs = Object.keys(lstruct).length > 0 ? lstruct : null;
  const hydrated = hydrateFunc(dataStr, localStructs);

  return {
    data: hydrated,
    globalValidations: gvalidation ?? null,
    localValidations: lvalidation ?? null,
  };
}

/**
 * XTYTX envelope processing for TYTX TypeScript implementation.
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

import type { StructSchema, TytxValue } from './types.js';
import { registry } from './registry.js';

/** JSON Schema type alias */
export type JsonSchema = Record<string, unknown>;

/**
 * Registry for JSON Schema definitions.
 *
 * JSON Schemas are used for client-side validation. TYTX core does not
 * perform validation - it only handles type hydration.
 */
export class SchemaRegistry {
  private _schemas: Map<string, JsonSchema> = new Map();

  /**
   * Register a JSON Schema by name.
   * @param name - Schema name (typically matches struct code)
   * @param schema - JSON Schema object
   */
  register(name: string, schema: JsonSchema): void {
    this._schemas.set(name, schema);
  }

  /**
   * Remove a schema by name.
   * @param name - Schema name
   */
  unregister(name: string): void {
    this._schemas.delete(name);
  }

  /**
   * Get schema by name.
   * @param name - Schema name
   * @returns JSON Schema or undefined
   */
  get(name: string): JsonSchema | undefined {
    return this._schemas.get(name);
  }

  /**
   * Return list of all registered schema names.
   * @returns Array of schema names
   */
  listSchemas(): string[] {
    return Array.from(this._schemas.keys());
  }
}

/** Global schema registry instance */
export const schemaRegistry = new SchemaRegistry();

/** XTYTX envelope structure */
export interface XtytxEnvelope {
  gstruct: Record<string, StructSchema>;
  lstruct: Record<string, StructSchema>;
  gschema?: Record<string, JsonSchema>;
  lschema?: Record<string, JsonSchema>;
  data: string;
}

/**
 * Result of processing an XTYTX envelope.
 */
export interface XtytxResult {
  /** The hydrated data from the envelope (or null if empty) */
  data: TytxValue;
  /** gschema entries from envelope (already registered globally) */
  globalSchemas: Record<string, JsonSchema> | null;
  /** lschema entries from envelope (for document-specific use) */
  localSchemas: Record<string, JsonSchema> | null;
}

/**
 * Type for hydration function passed to processEnvelope.
 */
export type HydrateFunc = (data: string, localStructs: Record<string, StructSchema> | null) => TytxValue;

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
 * @param envelope - Parsed XTYTX envelope
 * @param hydrateFunc - Function to hydrate parsed data
 * @param tytxPrefix - Prefix to strip from data field (default "TYTX://")
 * @returns XtytxResult with hydrated data and schema contexts
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

  // Optional JSON Schema fields
  const gschema: Record<string, JsonSchema> | undefined = envelope.gschema;
  const lschema: Record<string, JsonSchema> | undefined = envelope.lschema;

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
      globalSchemas: gschema ?? null,
      localSchemas: lschema ?? null,
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
    globalSchemas: gschema ?? null,
    localSchemas: lschema ?? null,
  };
}

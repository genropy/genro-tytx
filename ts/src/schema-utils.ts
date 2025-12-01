/**
 * JSON Schema / OpenAPI utilities for TYTX TypeScript implementation.
 *
 * Provides bidirectional conversion between TYTX struct definitions (v2 format)
 * and JSON Schema / OpenAPI schemas.
 *
 * TYTX v2 Field Format:
 *   Simple field (no constraints):
 *     "name": "T"
 *
 *   Field with constraints:
 *     "name": {
 *       "type": "T",
 *       "validate": {"min": 1, "max": 100, "required": true},
 *       "ui": {"label": "Name", "hint": "Enter name"}
 *     }
 *
 * @module schema-utils
 */

import type { StructSchema, FieldValue, FieldDef } from './types.js';
import type { TypeRegistry } from './registry.js';

/** JSON Schema property definition */
export interface JsonSchemaProperty {
  type?: string;
  format?: string;
  items?: JsonSchemaProperty | JsonSchemaProperty[];
  properties?: Record<string, JsonSchemaProperty>;
  $ref?: string;
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  title?: string;
  description?: string;
  default?: unknown;
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  required?: string[];
  [key: string]: unknown;
}

/** JSON Schema object */
export interface JsonSchema extends JsonSchemaProperty {
  definitions?: Record<string, JsonSchemaProperty>;
  $defs?: Record<string, JsonSchemaProperty>;
}

/** Options for structFromJsonSchema */
export interface FromJsonSchemaOptions {
  /** Name for the root struct (used for naming nested structs) */
  name?: string;
  /** Registry to register nested structs */
  registry?: TypeRegistry;
  /** Whether to register nested structs (default: true) */
  registerNested?: boolean;
}

/** Options for structToJsonSchema */
export interface ToJsonSchemaOptions {
  /** Name/title for the root schema */
  name?: string;
  /** Registry to look up nested struct definitions */
  registry?: TypeRegistry;
  /** Whether to include definitions for nested structs (default: true) */
  includeDefinitions?: boolean;
}

// JSON Schema type/format → TYTX code mapping
const JSONSCHEMA_TO_TYTX: Record<string, string> = {
  'integer:': 'L',
  'number:': 'R',
  'number:decimal': 'N',
  'number:float': 'R',
  'number:double': 'R',
  'boolean:': 'B',
  'string:': 'T',
  'string:date': 'D',
  'string:date-time': 'DH',
  'string:time': 'H',
  'string:email': 'T',
  'string:uri': 'T',
  'string:uuid': 'T',
};

// TYTX code → JSON Schema type/format mapping
const TYTX_TO_JSONSCHEMA: Record<string, JsonSchemaProperty> = {
  L: { type: 'integer' },
  R: { type: 'number' },
  N: { type: 'number', format: 'decimal' },
  B: { type: 'boolean' },
  T: { type: 'string' },
  S: { type: 'string' },
  D: { type: 'string', format: 'date' },
  DH: { type: 'string', format: 'date-time' },
  DHZ: { type: 'string', format: 'date-time' },
  H: { type: 'string', format: 'time' },
  JS: { type: 'object' },
};

/**
 * Resolve a JSON Schema $ref to its definition.
 */
function resolveRef(ref: string, rootSchema: JsonSchema): JsonSchemaProperty {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local $ref supported, got: ${ref}`);
  }

  const parts = ref.slice(2).split('/');
  let current: Record<string, unknown> = rootSchema;

  for (const part of parts) {
    if (!(part in current)) {
      throw new Error(`Cannot resolve $ref: ${ref}`);
    }
    current = current[part] as Record<string, unknown>;
  }

  return current as JsonSchemaProperty;
}

/**
 * Build TYTX v2 field definition from JSON Schema constraints.
 */
function buildFieldDef(
  propSchema: JsonSchemaProperty,
  baseType: string,
  isRequired: boolean,
): FieldValue {
  const validate: Record<string, unknown> = {};
  const ui: Record<string, unknown> = {};

  // String constraints
  if (propSchema.minLength !== undefined) {
    validate.min = propSchema.minLength;
  }
  if (propSchema.maxLength !== undefined) {
    validate.max = propSchema.maxLength;
  }
  if (propSchema.pattern !== undefined) {
    validate.pattern = propSchema.pattern;
  }

  // Number constraints
  if (propSchema.minimum !== undefined) {
    validate.min = propSchema.minimum;
  }
  if (propSchema.maximum !== undefined) {
    validate.max = propSchema.maximum;
  }
  if ((propSchema as Record<string, unknown>).exclusiveMinimum !== undefined) {
    validate.min = (propSchema as Record<string, unknown>).exclusiveMinimum;
    validate.minExclusive = true;
  }
  if ((propSchema as Record<string, unknown>).exclusiveMaximum !== undefined) {
    validate.max = (propSchema as Record<string, unknown>).exclusiveMaximum;
    validate.maxExclusive = true;
  }

  // Enum
  if (propSchema.enum !== undefined) {
    validate.enum = propSchema.enum;
  }

  // Default
  if (propSchema.default !== undefined) {
    validate.default = propSchema.default;
  }

  // Required
  if (isRequired) {
    validate.required = true;
  }

  // UI hints from title/description
  if (propSchema.title !== undefined) {
    ui.label = propSchema.title;
  }
  if (propSchema.description !== undefined) {
    ui.hint = propSchema.description;
  }

  // Return simple type or FieldDef
  if (Object.keys(validate).length > 0 || Object.keys(ui).length > 0) {
    const fieldDef: FieldDef = { type: baseType };
    if (Object.keys(validate).length > 0) {
      fieldDef.validate = validate as FieldDef['validate'];
    }
    if (Object.keys(ui).length > 0) {
      fieldDef.ui = ui as FieldDef['ui'];
    }
    return fieldDef;
  }

  return baseType;
}

/**
 * Convert a JSON Schema property to TYTX v2 field definition.
 */
function jsonSchemaTypeToTytx(
  propSchema: JsonSchemaProperty,
  propName: string,
  rootSchema: JsonSchema,
  nestedStructs: Record<string, Record<string, FieldValue>>,
  parentName: string,
  isRequired: boolean = false,
): FieldValue {
  // Handle $ref
  if (propSchema.$ref) {
    const resolved = resolveRef(propSchema.$ref, rootSchema);
    const refName = propSchema.$ref.split('/').pop()!;
    if (resolved.type === 'object' && resolved.properties) {
      const nestedStruct = convertObjectSchema(resolved, refName, rootSchema, nestedStructs);
      nestedStructs[refName] = nestedStruct;
      const refType = `@${refName}`;
      if (isRequired) {
        return { type: refType, validate: { required: true } };
      }
      return refType;
    }
    return jsonSchemaTypeToTytx(resolved, propName, rootSchema, nestedStructs, parentName, isRequired);
  }

  // Handle oneOf (take first option)
  if (propSchema.oneOf) {
    return jsonSchemaTypeToTytx(propSchema.oneOf[0], propName, rootSchema, nestedStructs, parentName, isRequired);
  }

  // Handle anyOf (filter out null for Optional)
  if (propSchema.anyOf) {
    const nonNull = propSchema.anyOf.filter((s) => s.type !== 'null');
    if (nonNull.length > 0) {
      return jsonSchemaTypeToTytx(nonNull[0], propName, rootSchema, nestedStructs, parentName, isRequired);
    }
  }

  const schemaType = propSchema.type || '';
  const schemaFormat = propSchema.format || '';

  // Handle array type
  if (schemaType === 'array' && propSchema.items) {
    const items = propSchema.items as JsonSchemaProperty;
    const itemField = jsonSchemaTypeToTytx(items, propName, rootSchema, nestedStructs, parentName, false);
    // Extract type code from item field
    const itemType = typeof itemField === 'object' ? (itemField as FieldDef).type : itemField;
    const arrayType = `#${itemType}`;
    if (isRequired) {
      return { type: arrayType, validate: { required: true } };
    }
    return arrayType;
  }

  // Handle nested object
  if (schemaType === 'object' && propSchema.properties) {
    const nestedName = `${parentName}_${propName}`.toUpperCase();
    const nestedStruct = convertObjectSchema(propSchema, nestedName, rootSchema, nestedStructs);
    nestedStructs[nestedName] = nestedStruct;
    const refType = `@${nestedName}`;
    if (isRequired) {
      return { type: refType, validate: { required: true } };
    }
    return refType;
  }

  // Handle basic types
  const key = `${schemaType}:${schemaFormat}`;
  if (key in JSONSCHEMA_TO_TYTX) {
    return buildFieldDef(propSchema, JSONSCHEMA_TO_TYTX[key], isRequired);
  }

  // Fallback: try without format
  const keyNoFormat = `${schemaType}:`;
  if (keyNoFormat in JSONSCHEMA_TO_TYTX) {
    return buildFieldDef(propSchema, JSONSCHEMA_TO_TYTX[keyNoFormat], isRequired);
  }

  // Default to string
  return buildFieldDef(propSchema, 'T', isRequired);
}

/**
 * Convert a JSON Schema object to TYTX v2 struct dict.
 */
function convertObjectSchema(
  schema: JsonSchemaProperty,
  name: string,
  rootSchema: JsonSchema,
  nestedStructs: Record<string, Record<string, FieldValue>>,
): Record<string, FieldValue> {
  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);
  const struct: Record<string, FieldValue> = {};

  for (const [propName, propSchema] of Object.entries(properties)) {
    const isRequired = requiredFields.has(propName);
    struct[propName] = jsonSchemaTypeToTytx(propSchema, propName, rootSchema, nestedStructs, name, isRequired);
  }

  return struct;
}

/**
 * Convert JSON Schema to TYTX v2 struct definition.
 *
 * @example
 * ```ts
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     name: { type: 'string', minLength: 1, title: 'Name' }
 *   },
 *   required: ['id', 'name']
 * };
 * const struct = structFromJsonSchema(schema);
 * // {
 * //   id: { type: 'L', validate: { required: true } },
 * //   name: { type: 'T', validate: { min: 1, required: true }, ui: { label: 'Name' } }
 * // }
 * ```
 */
export function structFromJsonSchema(
  schema: JsonSchema,
  options: FromJsonSchemaOptions = {},
): Record<string, FieldValue> {
  const { name = 'ROOT', registry, registerNested = true } = options;

  if (schema.type !== 'object') {
    throw new Error("JSON Schema must have type: 'object'");
  }

  const nestedStructs: Record<string, Record<string, FieldValue>> = {};
  const struct = convertObjectSchema(schema, name, schema, nestedStructs);

  // Register nested structs if requested
  if (registerNested && registry) {
    for (const [structName, structDef] of Object.entries(nestedStructs)) {
      registry.register_struct(structName, structDef);
    }
  }

  return struct;
}

/**
 * Convert TYTX v2 field definition to JSON Schema property definition.
 */
function tytxFieldToJsonSchema(
  field: FieldValue,
  definitions: Record<string, JsonSchemaProperty>,
  registry?: TypeRegistry,
  requiredFields?: Set<string>,
  fieldName?: string,
): JsonSchemaProperty {
  // Handle v2 FieldDef object
  if (typeof field === 'object' && field !== null && 'type' in field) {
    const fieldDef = field as FieldDef;
    const typeCode = fieldDef.type || 'T';
    const validate = fieldDef.validate || {};
    const ui = fieldDef.ui || {};

    // Get base schema for the type
    const result = typeCodeToJsonSchema(typeCode, definitions, registry);

    // Apply validate constraints
    if (validate.min !== undefined) {
      if (result.type === 'string') {
        result.minLength = validate.min;
      } else {
        result.minimum = validate.min;
      }
    }
    if (validate.max !== undefined) {
      if (result.type === 'string') {
        result.maxLength = validate.max;
      } else {
        result.maximum = validate.max;
      }
    }
    if (validate.length !== undefined) {
      result.minLength = validate.length;
      result.maxLength = validate.length;
    }
    if (validate.pattern !== undefined) {
      result.pattern = validate.pattern;
    }
    if (validate.enum !== undefined) {
      result.enum = validate.enum;
    }
    if (validate.default !== undefined) {
      result.default = validate.default;
    }
    if (validate.required && requiredFields && fieldName) {
      requiredFields.add(fieldName);
    }

    // Apply ui hints
    if (ui.label !== undefined) {
      result.title = ui.label;
    }
    if (ui.hint !== undefined) {
      result.description = ui.hint;
    }

    return result;
  }

  // Simple type code string
  return typeCodeToJsonSchema(field as string, definitions, registry);
}

/**
 * Convert TYTX type code to JSON Schema.
 */
function typeCodeToJsonSchema(
  typeCode: string,
  definitions: Record<string, JsonSchemaProperty>,
  registry?: TypeRegistry,
): JsonSchemaProperty {
  // Handle array type (#X)
  if (typeCode.startsWith('#')) {
    const innerType = typeCode.slice(1);
    const itemsSchema = typeCodeToJsonSchema(innerType, definitions, registry);
    return { type: 'array', items: itemsSchema };
  }

  // Handle struct reference (@STRUCT)
  if (typeCode.startsWith('@')) {
    const structName = typeCode.slice(1);
    // Add to definitions if we have a registry
    if (registry && !(structName in definitions)) {
      const structDef = registry.get_struct(structName);
      if (structDef) {
        definitions[structName] = structToSchemaObject(structDef, definitions, registry);
      }
    }
    return { $ref: `#/definitions/${structName}` };
  }

  // Basic type conversion
  if (typeCode in TYTX_TO_JSONSCHEMA) {
    return { ...TYTX_TO_JSONSCHEMA[typeCode] };
  }

  // Default to string
  return { type: 'string' };
}

/**
 * Convert TYTX v2 struct to JSON Schema object definition.
 */
function structToSchemaObject(
  struct: StructSchema,
  definitions: Record<string, JsonSchemaProperty>,
  registry?: TypeRegistry,
): JsonSchemaProperty {
  if (typeof struct === 'object' && !Array.isArray(struct)) {
    const properties: Record<string, JsonSchemaProperty> = {};
    const requiredFields = new Set<string>();

    for (const [propName, field] of Object.entries(struct)) {
      properties[propName] = tytxFieldToJsonSchema(field, definitions, registry, requiredFields, propName);
    }

    const result: JsonSchemaProperty = { type: 'object', properties };
    if (requiredFields.size > 0) {
      result.required = Array.from(requiredFields).sort();
    }
    return result;
  }

  if (Array.isArray(struct)) {
    if (struct.length === 1) {
      // Homogeneous array
      const itemSchema = tytxFieldToJsonSchema(struct[0], definitions, registry);
      return { type: 'array', items: itemSchema };
    }
    // Positional (tuple-like)
    const itemsList = struct.map((t) => tytxFieldToJsonSchema(t, definitions, registry));
    return { type: 'array', items: itemsList, minItems: struct.length, maxItems: struct.length };
  }

  if (typeof struct === 'string') {
    // String schema (e.g., "name:T,qty:L")
    if (struct.includes(':')) {
      const properties: Record<string, JsonSchemaProperty> = {};
      for (const field of struct.split(',')) {
        const trimmed = field.trim();
        if (trimmed.includes(':')) {
          const colonIdx = trimmed.indexOf(':');
          const name = trimmed.slice(0, colonIdx).trim();
          const typeCode = trimmed.slice(colonIdx + 1).trim();
          properties[name] = tytxFieldToJsonSchema(typeCode, definitions, registry);
        }
      }
      return { type: 'object', properties };
    }
    // Anonymous fields (e.g., "T,L,N")
    const itemsList = struct.split(',').map((t) => tytxFieldToJsonSchema(t.trim(), definitions, registry));
    return { type: 'array', items: itemsList, minItems: itemsList.length, maxItems: itemsList.length };
  }

  return { type: 'object' };
}

/**
 * Convert TYTX v2 struct to JSON Schema.
 *
 * @example
 * ```ts
 * const struct = {
 *   id: { type: 'L', validate: { required: true } },
 *   name: { type: 'T', validate: { min: 1 }, ui: { label: 'Name' } },
 *   price: 'N'
 * };
 * const schema = structToJsonSchema(struct);
 * // {
 * //   type: 'object',
 * //   properties: {
 * //     id: { type: 'integer' },
 * //     name: { type: 'string', minLength: 1, title: 'Name' },
 * //     price: { type: 'number', format: 'decimal' }
 * //   },
 * //   required: ['id']
 * // }
 * ```
 */
export function structToJsonSchema(
  struct: StructSchema,
  options: ToJsonSchemaOptions = {},
): JsonSchema {
  const { name, registry, includeDefinitions = true } = options;

  const definitions: Record<string, JsonSchemaProperty> = {};
  const schema: JsonSchema = structToSchemaObject(struct, definitions, registry);

  if (name) {
    schema.title = name;
  }

  if (includeDefinitions && Object.keys(definitions).length > 0) {
    schema.definitions = definitions;
  }

  return schema;
}

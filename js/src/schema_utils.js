/**
 * JSON Schema / OpenAPI utilities for TYTX JavaScript implementation.
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
 * @module schema_utils
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

// JSON Schema type/format → TYTX code mapping
const JSONSCHEMA_TO_TYTX = {
  'integer:': 'L',
  'number:': 'R',
  'number:decimal': 'N',
  'number:float': 'R',
  'number:double': 'R',
  'boolean:': 'B',
  'string:': 'T',
  'string:date': 'D',
  'string:date-time': 'DHZ', // DHZ is canonical for timezone-aware datetime
  'string:time': 'H',
  'string:email': 'T',
  'string:uri': 'T',
  'string:uuid': 'T',
};

// TYTX code → JSON Schema type/format mapping
const TYTX_TO_JSONSCHEMA = {
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
 * @param {string} ref - The $ref string
 * @param {Object} rootSchema - Root schema with definitions
 * @returns {Object} Resolved schema
 * @throws {Error} If ref is not local or cannot be resolved
 */
function resolveRef(ref, rootSchema) {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local $ref supported, got: ${ref}`);
  }

  const parts = ref.slice(2).split('/');
  let current = rootSchema;

  for (const part of parts) {
    if (!(part in current)) {
      throw new Error(`Cannot resolve $ref: ${ref}`);
    }
    current = current[part];
  }

  return current;
}

/**
 * Build TYTX v2 field definition from JSON Schema constraints.
 * @param {Object} propSchema - Property schema with constraints
 * @param {string} baseType - Base TYTX type code
 * @param {boolean} isRequired - Whether the field is required
 * @returns {string|Object} Simple type code or FieldDef object
 */
function buildFieldDef(propSchema, baseType, isRequired) {
  const validate = {};
  const ui = {};

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
  if (propSchema.exclusiveMinimum !== undefined) {
    validate.min = propSchema.exclusiveMinimum;
    validate.minExclusive = true;
  }
  if (propSchema.exclusiveMaximum !== undefined) {
    validate.max = propSchema.exclusiveMaximum;
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
    const fieldDef = { type: baseType };
    if (Object.keys(validate).length > 0) {
      fieldDef.validate = validate;
    }
    if (Object.keys(ui).length > 0) {
      fieldDef.ui = ui;
    }
    return fieldDef;
  }

  return baseType;
}

/**
 * Convert a JSON Schema property to TYTX v2 field definition.
 * @param {Object} propSchema - Property schema
 * @param {string} propName - Property name
 * @param {Object} rootSchema - Root schema with definitions
 * @param {Object} nestedStructs - Output object for nested structs
 * @param {string} parentName - Parent struct name
 * @param {boolean} isRequired - Whether this field is required
 * @returns {string|Object} TYTX type code or FieldDef object
 */
function jsonSchemaTypeToTytx(propSchema, propName, rootSchema, nestedStructs, parentName, isRequired = false) {
  // Handle $ref
  if (propSchema.$ref) {
    const resolved = resolveRef(propSchema.$ref, rootSchema);
    const refName = propSchema.$ref.split('/').pop();
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
    const itemField = jsonSchemaTypeToTytx(propSchema.items, propName, rootSchema, nestedStructs, parentName, false);
    // Extract type code from item field
    const itemType = typeof itemField === 'object' ? itemField.type : itemField;
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
 * @param {Object} schema - Object schema
 * @param {string} name - Struct name
 * @param {Object} rootSchema - Root schema
 * @param {Object} nestedStructs - Output object for nested structs
 * @returns {Object} TYTX v2 struct definition
 */
function convertObjectSchema(schema, name, rootSchema, nestedStructs) {
  const properties = schema.properties || {};
  const requiredFields = new Set(schema.required || []);
  const struct = {};

  for (const [propName, propSchema] of Object.entries(properties)) {
    const isRequired = requiredFields.has(propName);
    struct[propName] = jsonSchemaTypeToTytx(propSchema, propName, rootSchema, nestedStructs, name, isRequired);
  }

  return struct;
}

/**
 * Convert JSON Schema to TYTX v2 struct definition.
 *
 * @param {Object} schema - JSON Schema object
 * @param {Object} [options] - Options
 * @param {string} [options.name='ROOT'] - Name for the root struct
 * @param {Object} [options.registry] - Registry to register nested structs
 * @param {boolean} [options.registerNested=true] - Whether to register nested structs
 * @returns {Object} TYTX v2 struct definition
 * @throws {Error} If schema is not an object type
 *
 * @example
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
 */
function structFromJsonSchema(schema, options = {}) {
  const { name = 'ROOT', registry = null, registerNested = true } = options;

  if (schema.type !== 'object') {
    throw new Error("JSON Schema must have type: 'object'");
  }

  const nestedStructs = {};
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
 * @param {string|Object} field - TYTX field (simple type code or FieldDef object)
 * @param {Object} definitions - Definitions object for $refs
 * @param {Object} [registry] - Optional registry for struct lookups
 * @param {Set} [requiredFields] - Set to collect required field names
 * @param {string} [fieldName] - Field name (for required tracking)
 * @returns {Object} JSON Schema property definition
 */
function tytxFieldToJsonSchema(field, definitions, registry, requiredFields, fieldName) {
  // Handle v2 FieldDef object
  if (typeof field === 'object' && field !== null && 'type' in field) {
    const typeCode = field.type || 'T';
    const validate = field.validate || {};
    const ui = field.ui || {};

    // Get base schema for the type
    const result = typeCodeToJsonSchema(typeCode, definitions, registry);

    // Apply validate constraints
    if ('min' in validate) {
      if (result.type === 'string') {
        result.minLength = validate.min;
      } else {
        result.minimum = validate.min;
      }
    }
    if ('max' in validate) {
      if (result.type === 'string') {
        result.maxLength = validate.max;
      } else {
        result.maximum = validate.max;
      }
    }
    if ('length' in validate) {
      result.minLength = validate.length;
      result.maxLength = validate.length;
    }
    if ('pattern' in validate) {
      result.pattern = validate.pattern;
    }
    if ('enum' in validate) {
      result.enum = validate.enum;
    }
    if ('default' in validate) {
      result.default = validate.default;
    }
    if (validate.required && requiredFields && fieldName) {
      requiredFields.add(fieldName);
    }

    // Apply ui hints
    if ('label' in ui) {
      result.title = ui.label;
    }
    if ('hint' in ui) {
      result.description = ui.hint;
    }

    return result;
  }

  // Simple type code string
  return typeCodeToJsonSchema(field, definitions, registry);
}

/**
 * Convert TYTX type code to JSON Schema.
 * @param {string} typeCode - TYTX type code (e.g., "L", "@ADDRESS", "#L")
 * @param {Object} definitions - Definitions object for $refs
 * @param {Object} [registry] - Optional registry for struct lookups
 * @returns {Object} JSON Schema property definition
 */
function typeCodeToJsonSchema(typeCode, definitions, registry) {
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
 * @param {Object|Array|string} struct - TYTX v2 struct definition
 * @param {Object} definitions - Definitions object for $refs
 * @param {Object} [registry] - Optional registry for struct lookups
 * @returns {Object} JSON Schema object definition
 */
function structToSchemaObject(struct, definitions, registry) {
  if (typeof struct === 'object' && !Array.isArray(struct)) {
    const properties = {};
    const requiredFields = new Set();

    for (const [propName, field] of Object.entries(struct)) {
      properties[propName] = tytxFieldToJsonSchema(field, definitions, registry, requiredFields, propName);
    }

    const result = { type: 'object', properties };
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
      const properties = {};
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
 * @param {Object|Array|string} struct - TYTX v2 struct definition
 * @param {Object} [options] - Options
 * @param {string} [options.name] - Name/title for the root schema
 * @param {Object} [options.registry] - Registry to look up nested struct definitions
 * @param {boolean} [options.includeDefinitions=true] - Whether to include definitions for nested structs
 * @returns {Object} JSON Schema object
 *
 * @example
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
 */
function structToJsonSchema(struct, options = {}) {
  const { name = null, registry = null, includeDefinitions = true } = options;

  const definitions = {};
  const schema = structToSchemaObject(struct, definitions, registry);

  if (name) {
    schema.title = name;
  }

  if (includeDefinitions && Object.keys(definitions).length > 0) {
    schema.definitions = definitions;
  }

  return schema;
}

module.exports = {
  structFromJsonSchema,
  structToJsonSchema,
  JSONSCHEMA_TO_TYTX,
  TYTX_TO_JSONSCHEMA,
};

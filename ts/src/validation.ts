/**
 * Validation system for TYTX TypeScript implementation.
 *
 * Provides:
 * - ValidationRegistry: Named validation rules with boolean expressions
 * - STANDARD_VALIDATIONS: Pre-defined common validations (email, cf, iban, etc.)
 *
 * Validation Expression Syntax:
 *     validation:name           # Single validation
 *     validation:a&b            # AND - all must pass
 *     validation:a|b            # OR - at least one must pass
 *     validation:!a             # NOT - must NOT pass
 *     validation:!a&b|c         # Combined: (!a AND b) OR c
 *
 * Operator Precedence:
 *     ! (NOT)  - highest (1)
 *     & (AND)  - medium (2)
 *     | (OR)   - lowest (3)
 *
 * @module validation
 */

/**
 * Definition of a named validation rule.
 */
export interface ValidationDef {
  /** Regex pattern to match */
  pattern?: string;
  /** Exact length constraint */
  len?: number;
  /** Minimum value/length */
  min?: number;
  /** Maximum value/length */
  max?: number;
  /** Human-readable error message */
  message?: string;
  /** Machine-readable error code */
  code?: string;
}

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends Error {
  validationName?: string;
  code?: string;

  constructor(message: string, validationName?: string, code?: string) {
    super(message);
    this.name = 'ValidationError';
    this.validationName = validationName;
    this.code = code;
  }
}

/**
 * Registry for named validation rules.
 *
 * Validations are referenced by name in type metadata:
 *     T[validation:email]
 *     T[validation:latin&uppercase]
 *     T[validation:cf|piva]
 */
export class ValidationRegistry {
  private validations: Map<string, ValidationDef> = new Map();
  private compiledPatterns: Map<string, RegExp> = new Map();

  /**
   * Register a named validation.
   *
   * @param name - Validation name (e.g., 'email', 'cf', 'latin')
   * @param definition - Validation definition with pattern, message, etc.
   *
   * @example
   * registry.register('email', {
   *     pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
   *     message: 'Invalid email address'
   * });
   */
  register(name: string, definition: ValidationDef): void {
    this.validations.set(name, definition);
    // Pre-compile pattern if present
    if (definition.pattern) {
      this.compiledPatterns.set(name, new RegExp(definition.pattern));
    }
  }

  /**
   * Remove a validation by name.
   */
  unregister(name: string): void {
    this.validations.delete(name);
    this.compiledPatterns.delete(name);
  }

  /**
   * Get validation definition by name.
   */
  get(name: string): ValidationDef | undefined {
    return this.validations.get(name);
  }

  /**
   * Validate a value against a named validation.
   *
   * Resolution order:
   * 1. localValidations (XTYTX lvalidation)
   * 2. globalValidations (XTYTX gvalidation)
   * 3. registry (pre-registered)
   *
   * @param value - String value to validate
   * @param name - Validation name
   * @param localValidations - Document-local validations (highest priority)
   * @param globalValidations - Global validations from XTYTX envelope
   * @returns True if valid, false otherwise
   * @throws Error if validation name not found in any scope
   */
  validate(
    value: string,
    name: string,
    localValidations?: Record<string, ValidationDef> | null,
    globalValidations?: Record<string, ValidationDef> | null,
  ): boolean {
    // Resolve validation definition
    let definition: ValidationDef | undefined;
    let useCache = true;

    if (localValidations && name in localValidations) {
      definition = localValidations[name];
      useCache = false; // Don't use cache for local validations
    } else if (globalValidations && name in globalValidations) {
      definition = globalValidations[name];
      useCache = false; // Don't use cache for global validations
    } else {
      definition = this.validations.get(name);
    }

    if (!definition) {
      throw new Error(`Validation '${name}' not found`);
    }

    return this.checkDefinition(value, definition, name, useCache);
  }

  /**
   * Check value against a validation definition.
   */
  private checkDefinition(
    value: string,
    definition: ValidationDef,
    name: string,
    useCache = true,
  ): boolean {
    // Check pattern
    if (definition.pattern) {
      let pattern: RegExp | undefined;
      if (useCache) {
        pattern = this.compiledPatterns.get(name);
      }
      if (!pattern) {
        pattern = new RegExp(definition.pattern);
      }
      if (!pattern.test(value)) {
        return false;
      }
    }

    // Check exact length
    if (definition.len !== undefined) {
      if (value.length !== definition.len) {
        return false;
      }
    }

    // Check min length (for strings)
    if (definition.min !== undefined) {
      if (value.length < definition.min) {
        return false;
      }
    }

    // Check max length (for strings)
    if (definition.max !== undefined) {
      if (value.length > definition.max) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate a value against a boolean expression of validations.
   *
   * Supports:
   * - Single: "email"
   * - AND: "latin&uppercase" (all must pass)
   * - OR: "cf|piva" (at least one must pass)
   * - NOT: "!numeric" (must NOT pass)
   * - Combined: "!numeric&latin" (NOT has highest precedence)
   *
   * Precedence: ! > & > |
   *
   * @param value - String value to validate
   * @param expression - Validation expression (e.g., "latin&cf|latin&piva")
   * @param localValidations - Document-local validations
   * @param globalValidations - Global validations from XTYTX envelope
   * @returns True if expression evaluates to true, false otherwise
   */
  validateExpression(
    value: string,
    expression: string,
    localValidations?: Record<string, ValidationDef> | null,
    globalValidations?: Record<string, ValidationDef> | null,
  ): boolean {
    return this.evalExpression(value, expression, localValidations, globalValidations);
  }

  /**
   * Evaluate a validation expression.
   *
   * Uses recursive descent parsing with precedence:
   * - OR (|) is lowest precedence, evaluated last
   * - AND (&) is medium precedence
   * - NOT (!) is highest precedence, evaluated first
   */
  private evalExpression(
    value: string,
    expr: string,
    localValidations?: Record<string, ValidationDef> | null,
    globalValidations?: Record<string, ValidationDef> | null,
  ): boolean {
    // Split by OR first (lowest precedence)
    const orParts = this.splitByOperator(expr, '|');
    if (orParts.length > 1) {
      // OR: at least one must be true
      return orParts.some((part) =>
        this.evalExpression(value, part, localValidations, globalValidations),
      );
    }

    // Split by AND (medium precedence)
    const andParts = this.splitByOperator(expr, '&');
    if (andParts.length > 1) {
      // AND: all must be true
      return andParts.every((part) =>
        this.evalExpression(value, part, localValidations, globalValidations),
      );
    }

    // Handle NOT (highest precedence)
    const trimmedExpr = expr.trim();
    if (trimmedExpr.startsWith('!')) {
      const name = trimmedExpr.slice(1).trim();
      return !this.validate(value, name, localValidations, globalValidations);
    }

    // Single validation name
    return this.validate(value, trimmedExpr, localValidations, globalValidations);
  }

  /**
   * Split expression by operator, respecting any future grouping.
   */
  private splitByOperator(expr: string, op: string): string[] {
    // Simple split for now (no parentheses support)
    return expr
      .split(op)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * Return list of all registered validation names.
   */
  listValidations(): string[] {
    return Array.from(this.validations.keys());
  }
}

/**
 * Standard validations pre-defined for common use cases.
 */
export const STANDARD_VALIDATIONS: Record<string, ValidationDef> = {
  // Internet & Communication
  email: {
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    message: 'Invalid email address',
  },
  url: {
    pattern: '^https?://[^\\s/$.?#].[^\\s]*$',
    message: 'Invalid URL',
  },
  domain: {
    pattern: '^([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}$',
    message: 'Invalid domain name',
  },
  ipv4: {
    pattern: '^((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}$',
    message: 'Invalid IPv4 address',
  },
  phone: {
    pattern: '^\\+?[1-9]\\d{1,14}$',
    message: 'Invalid phone number',
  },

  // Identifiers
  uuid: {
    pattern:
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
    message: 'Invalid UUID v4',
  },
  uuid_any: {
    pattern:
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    message: 'Invalid UUID',
  },
  slug: {
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    message: 'Invalid slug (use lowercase, numbers, hyphens)',
  },

  // Italian Fiscal
  cf: {
    pattern: '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$',
    len: 16,
    message: 'Invalid Italian fiscal code (Codice Fiscale)',
  },
  piva: {
    pattern: '^[0-9]{11}$',
    len: 11,
    message: 'Invalid Italian VAT number (Partita IVA)',
  },
  phone_it: {
    pattern: '^(\\+39)?[ ]?[0-9]{2,4}[ ]?[0-9]{4,8}$',
    message: 'Invalid Italian phone number',
  },
  cap_it: {
    pattern: '^[0-9]{5}$',
    len: 5,
    message: 'Invalid Italian postal code (CAP)',
  },

  // European Standards
  iban: {
    pattern: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$',
    message: 'Invalid IBAN',
  },
  bic: {
    pattern: '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$',
    message: 'Invalid BIC/SWIFT code',
  },
  vat_eu: {
    pattern: '^[A-Z]{2}[0-9A-Z]{2,12}$',
    message: 'Invalid EU VAT number',
  },

  // Text Constraints
  latin: {
    pattern: '^[\\x00-\\x7F]+$',
    message: 'Only ASCII/Latin characters allowed',
  },
  latin_ext: {
    pattern: '^[\\x00-\\xFF]+$',
    message: 'Only Latin characters allowed',
  },
  uppercase: {
    pattern: '^[A-Z]+$',
    message: 'Must be uppercase letters only',
  },
  lowercase: {
    pattern: '^[a-z]+$',
    message: 'Must be lowercase letters only',
  },
  alphanumeric: {
    pattern: '^[a-zA-Z0-9]+$',
    message: 'Only letters and numbers allowed',
  },
  no_spaces: {
    pattern: '^\\S+$',
    message: 'Spaces not allowed',
  },
  single_line: {
    pattern: '^[^\\r\\n]+$',
    message: 'Must be single line',
  },

  // Numeric Formats
  positive_int: {
    pattern: '^[1-9][0-9]*$',
    message: 'Must be a positive integer',
  },
  non_negative_int: {
    pattern: '^(0|[1-9][0-9]*)$',
    message: 'Must be zero or positive integer',
  },
  decimal: {
    pattern: '^-?[0-9]+(\\.[0-9]+)?$',
    message: 'Must be a decimal number',
  },
  percentage: {
    pattern: '^(100(\\.0+)?|[0-9]{1,2}(\\.[0-9]+)?)$',
    min: 0,
    max: 100,
    message: 'Must be a percentage (0-100)',
  },

  // Date & Time Formats
  iso_date: {
    pattern: '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
    message: 'Invalid date format (use YYYY-MM-DD)',
  },
  iso_datetime: {
    pattern:
      '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](Z|[+-][0-9]{2}:[0-9]{2})?$',
    message: 'Invalid datetime format (use ISO 8601)',
  },
  time: {
    pattern: '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$',
    message: 'Invalid time format (use HH:MM or HH:MM:SS)',
  },
  year: {
    pattern: '^[0-9]{4}$',
    len: 4,
    message: 'Invalid year (use YYYY)',
  },

  // Security
  password_strong: {
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
    min: 8,
    message: 'Password must have 8+ chars, uppercase, lowercase, digit, special char',
  },
  hex: {
    pattern: '^[0-9a-fA-F]+$',
    message: 'Must be hexadecimal',
  },
  base64: {
    pattern: '^[A-Za-z0-9+/]+=*$',
    message: 'Must be valid Base64',
  },
};

/**
 * Create a new ValidationRegistry, optionally with standard validations.
 *
 * @param includeStandard - If true, pre-register all STANDARD_VALIDATIONS
 * @returns New ValidationRegistry instance
 */
export function createValidationRegistry(includeStandard = true): ValidationRegistry {
  const registry = new ValidationRegistry();
  if (includeStandard) {
    for (const [name, definition] of Object.entries(STANDARD_VALIDATIONS)) {
      registry.register(name, definition);
    }
  }
  return registry;
}

/**
 * Global validation registry instance (with standard validations).
 */
export const validationRegistry = createValidationRegistry(true);

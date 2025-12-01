# TYTX Validation Metadata Specification

**Version**: 1.1
**Status**: Draft
**Date**: 2025-12-01

This document defines the standard for embedding validation rules directly into TYTX type definitions.

## Design Decision: Named Validations

### Problem

Inline regex patterns in metadata cause parsing conflicts with TYTX grammar:

- `|` is used for enum separation (`enum:A|B|C`)
- `[` and `]` delimit the metadata block
- `,` separates facets
- Complex regex like `[\p{IsBasicLatin}]+` or `^[A-Z]{6}[0-9]{2}...` break the parser

### Solution

**Named Validations**: Complex validation rules (especially regex patterns) are registered separately and referenced by name.

- **Inline facets**: Simple constraints (`max:80`, `required:true`, `enum:A|B|C`)
- **Named validations**: Complex patterns registered in the registry and referenced by name

### Syntax

```text
# Simple inline constraints
T[max:80,required:true]

# Named validation reference
T[validation:cf]

# Multiple named validations (AND logic)
T[validation:latin&uppercase]

# Mixed inline + named
T[max:80,validation:latin]
```

### Operators

| Operator | Context | Meaning | Precedence |
|----------|---------|---------|------------|
| `!` | `validation:` facet | NOT (validation must fail) | 1 (highest) |
| `&` | `validation:` facet | AND (all must pass) | 2 |
| `\|` | `validation:` facet | OR (at least one must pass) | 3 (lowest) |
| `\|` | `enum:` facet | OR (one of the values) | - |
| `,` | metadata block | Facet separator | - |

**Examples:**

```text
# AND - all must pass
T[validation:latin&uppercase]

# OR - at least one must pass
T[validation:cf|piva]

# NOT - validation must NOT pass
T[validation:!numeric]

# Combined (evaluated as: (!a) AND b)
T[validation:!numeric&latin]

# Complex (evaluated as: (a AND b) OR (c AND d))
T[validation:a&b|c&d]

# Practical: accept CF or PIVA, must be latin
T[validation:latin&cf|latin&piva]
```

## 1. Syntax

Validation metadata is appended to the type code using square brackets `[]`.
Multiple constraints are separated by commas.

**Format**: `TypeCode[key:value, key:value]`

### Parsing Rules
1.  **Brackets**: The metadata section starts with `[` and ends with `]`.
2.  **Key-Value Pairs**: Inside brackets, rules are defined as `key:value`.
3.  **Separators**: Rules are separated by commas `,`.
4.  **Whitespace**: Whitespace around keys and values should be trimmed.
5.  **Values**: Values are strings. If a value contains a comma or closing bracket, it must be escaped (implementation dependent, suggested `\` prefix).

### Examples

- `T[len:16]`
- `N[min:0, max:100]`
- `T[reg:^[A-Z]{2}$]`

## 2. Standard Facets

The following keys are reserved for standard validation facets, mapped from XSD.

### String Facets (Applies to `T`, `D`, `JS` serialized)

| Key | XSD Equivalent | Description | Value Format |
| :--- | :--- | :--- | :--- |
| `min` | `minLength` | Minimum character length | Integer |
| `max` | `maxLength` | Maximum character length | Integer |
| `len` | `length` | Exact character length | Integer |
| `reg` | `pattern` | Regular Expression | Regex String |
| `enum`| `enumeration`| Allowed values list | Pipe-separated `A|B|C` |

### Numeric Facets (Applies to `L`, `R`, `N`)

| Key | XSD Equivalent | Description | Value Format |
| :--- | :--- | :--- | :--- |
| `min` | `minInclusive` | Minimum value (inclusive) | Number |
| `max` | `maxInclusive` | Maximum value (inclusive) | Number |
| `exc_min` | `minExclusive` | Minimum value (exclusive) | Number |
| `exc_max` | `maxExclusive` | Maximum value (exclusive) | Number |
| `dig` | `totalDigits` | Total number of digits | Integer |
| `dec` | `fractionDigits`| Maximum decimal places | Integer |

### Miscellaneous

| Key | Description | Value Format |
| :--- | :--- | :--- |
| `def` | Default value if missing/null | String representation |
| `fmt` | Format hint (e.g. for Dates) | Format string |

## 3. Implementation Guidelines

### Parsing
Parsers should extract the metadata dictionary during type lookup.
`T[len:5]` -> Type: `T`, Metadata: `{'len': '5'}`.

### Validation Timing

- **Serialization**: Optional. Libraries may offer a "strict" mode to validate data before sending.
- **Hydration**: Optional. Libraries may validate data upon parsing.
- **Schema Generation**: Metadata is primarily useful for generating UI forms, SQL schemas, or Swagger/OpenAPI definitions from TYTX structs.

### UI / Presentation Facets

These keys are used by UI generators to render user-friendly forms.

| Key | Description | Value Format | Example |
| :--- | :--- | :--- | :--- |
| `lbl` | Label (human readable name) | String | `T[lbl:First Name]` |
| `hint` | Helper text / tooltip | String | `T[hint:Enter your legal name]` |
| `ph` | Placeholder text | String | `T[ph:John Doe]` |
| `hidden`| Hidden field | Boolean | `T[hidden:true]` |
| `ro` | Read-only field | Boolean | `T[ro:true]` |

### Dynamic / Conditional Facets

Facets like `hidden`, `ro`, and `required` can depend on other field values.
Syntax: `key:field_name operator value`

Operators: `=`, `!=`.

| Key | Example | Meaning |
| :--- | :--- | :--- |
| `hidden` | `T[hidden:type=private]` | Hidden if sibling field `type` is "private" |
| `ro` | `T[ro:status=closed]` | Read-only if `status` is "closed" |
| `req` | `T[req:has_vat=true]` | Required if `has_vat` is true |

> **Note**: Paths are relative to the current struct. Complex logic should be handled by external rules, but simple dependencies are supported here.

## 4. Examples

### Italian Fiscal Code (Codice Fiscale)
```text
T[len:16, reg:^[A-Z0-9]{16}$, lbl:Codice Fiscale, ph:RSSMRA...]
```

### Percentage (0-100)
```text
N[min:0, max:100, dec:2]
```

### Enum (Gender)

```text
T[enum:M|F|NB]
```

## 5. Named Validations

Named validations solve the problem of complex regex patterns conflicting with TYTX grammar.

### 5.1 Registration API

```python
# Python API
registry.register_validation('latin', {
    'pattern': r'[\p{IsBasicLatin}]+',
    'message': 'Only Latin characters allowed'
})

registry.register_validation('cf', {
    'pattern': r'^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$',
    'len': 16,
    'message': 'Invalid Italian fiscal code'
})

registry.register_validation('uppercase', {
    'pattern': r'^[A-Z]+$',
    'message': 'Must be uppercase'
})
```

```javascript
// JavaScript API
registry.registerValidation('latin', {
    pattern: /[\p{IsBasicLatin}]+/u,
    message: 'Only Latin characters allowed'
});
```

### 5.2 Validation Definition

A named validation can include:

| Property | Type | Description |
|----------|------|-------------|
| `pattern` | string/regex | Regular expression to match |
| `len` | integer | Exact length constraint |
| `min` | number | Minimum value/length |
| `max` | number | Maximum value/length |
| `message` | string | Human-readable error message |
| `code` | string | Machine-readable error code |

### 5.3 Usage in Type Definitions

```text
# Single named validation
T[validation:cf]

# Multiple validations (AND - all must pass)
T[validation:latin&uppercase]

# Mixed with inline facets
T[max:80,validation:latin]

# In struct definitions
@PERSONA = {
    codice_fiscale: T[validation:cf],
    nome: T[max:50,validation:latin],
    cognome: T[max:50,validation:latin&uppercase]
}
```

### 5.4 XTYTX Integration

Named validations can be included in XTYTX envelopes:

```json
{
    "gstruct": {},
    "lstruct": {
        "CEDENTE": {
            "codice_fiscale": "T[validation:cf]",
            "ragione_sociale": "T[max:80,validation:latin]"
        }
    },
    "gvalidation": {
        "email": {
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
            "message": "Invalid email format"
        }
    },
    "lvalidation": {
        "latin": {
            "pattern": "[\\p{IsBasicLatin}]+",
            "message": "Only Latin characters"
        },
        "cf": {
            "pattern": "^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$",
            "len": 16,
            "message": "Invalid Italian fiscal code"
        }
    },
    "data": "TYTX://..."
}
```

**Scopes:**

- `gvalidation`: Global validations (pre-registered, shared across systems)
- `lvalidation`: Local validations (document-specific, override global)

### 5.5 Resolution Order

When resolving a validation name:

1. Check `lvalidation` (local, document-specific)
2. Check `gvalidation` (global, in XTYTX envelope)
3. Check registry (pre-registered in code)
4. Error if not found

### 5.6 Deprecated: Inline Regex

The `reg` facet for inline regex is **deprecated** for complex patterns:

```text
# DEPRECATED - may cause parsing issues
T[reg:^[A-Z]{6}[0-9]{2}...]

# RECOMMENDED - use named validation
T[validation:cf]
```

Simple patterns without special characters may still use `reg`:

```text
# OK - simple pattern, no special chars
T[reg:^[A-Z]+$]

# Better - use named for clarity
T[validation:uppercase]
```

### 5.7 Standard Validations

The following validations are provided as built-in standards. Implementations SHOULD pre-register these.

#### Internet & Communication

```python
# Email (RFC 5322 simplified)
register_validation('email', {
    'pattern': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    'message': 'Invalid email address'
})

# URL (http/https)
register_validation('url', {
    'pattern': r'^https?://[^\s/$.?#].[^\s]*$',
    'message': 'Invalid URL'
})

# Domain name
register_validation('domain', {
    'pattern': r'^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$',
    'message': 'Invalid domain name'
})

# IPv4 address
register_validation('ipv4', {
    'pattern': r'^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$',
    'message': 'Invalid IPv4 address'
})

# Phone (international E.164)
register_validation('phone', {
    'pattern': r'^\+?[1-9]\d{1,14}$',
    'message': 'Invalid phone number'
})
```

#### Identifiers

```python
# UUID v4
register_validation('uuid', {
    'pattern': r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
    'message': 'Invalid UUID v4'
})

# UUID (any version)
register_validation('uuid_any', {
    'pattern': r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    'message': 'Invalid UUID'
})

# Slug (URL-friendly identifier)
register_validation('slug', {
    'pattern': r'^[a-z0-9]+(?:-[a-z0-9]+)*$',
    'message': 'Invalid slug (use lowercase, numbers, hyphens)'
})
```

#### Italian Fiscal

```python
# Codice Fiscale (Italian tax code)
register_validation('cf', {
    'pattern': r'^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$',
    'len': 16,
    'message': 'Invalid Italian fiscal code (Codice Fiscale)'
})

# Partita IVA (Italian VAT number)
register_validation('piva', {
    'pattern': r'^[0-9]{11}$',
    'len': 11,
    'message': 'Invalid Italian VAT number (Partita IVA)'
})

# Italian phone
register_validation('phone_it', {
    'pattern': r'^(\+39)?[ ]?[0-9]{2,4}[ ]?[0-9]{4,8}$',
    'message': 'Invalid Italian phone number'
})

# Italian CAP (postal code)
register_validation('cap_it', {
    'pattern': r'^[0-9]{5}$',
    'len': 5,
    'message': 'Invalid Italian postal code (CAP)'
})
```

#### European Standards

```python
# IBAN (International Bank Account Number)
register_validation('iban', {
    'pattern': r'^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$',
    'message': 'Invalid IBAN'
})

# BIC/SWIFT code
register_validation('bic', {
    'pattern': r'^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$',
    'message': 'Invalid BIC/SWIFT code'
})

# EU VAT number (generic format)
register_validation('vat_eu', {
    'pattern': r'^[A-Z]{2}[0-9A-Z]{2,12}$',
    'message': 'Invalid EU VAT number'
})
```

#### Text Constraints

```python
# Latin characters only (Basic Latin block)
register_validation('latin', {
    'pattern': r'^[\x00-\x7F]+$',
    'message': 'Only ASCII/Latin characters allowed'
})

# Latin with extended (Latin-1 Supplement)
register_validation('latin_ext', {
    'pattern': r'^[\x00-\xFF]+$',
    'message': 'Only Latin characters allowed'
})

# Uppercase only
register_validation('uppercase', {
    'pattern': r'^[A-Z]+$',
    'message': 'Must be uppercase letters only'
})

# Lowercase only
register_validation('lowercase', {
    'pattern': r'^[a-z]+$',
    'message': 'Must be lowercase letters only'
})

# Alphanumeric
register_validation('alphanumeric', {
    'pattern': r'^[a-zA-Z0-9]+$',
    'message': 'Only letters and numbers allowed'
})

# No whitespace
register_validation('no_spaces', {
    'pattern': r'^\S+$',
    'message': 'Spaces not allowed'
})

# Single line (no newlines)
register_validation('single_line', {
    'pattern': r'^[^\r\n]+$',
    'message': 'Must be single line'
})
```

#### Numeric Formats

```python
# Positive integer
register_validation('positive_int', {
    'pattern': r'^[1-9][0-9]*$',
    'message': 'Must be a positive integer'
})

# Non-negative integer (0 or positive)
register_validation('non_negative_int', {
    'pattern': r'^(0|[1-9][0-9]*)$',
    'message': 'Must be zero or positive integer'
})

# Decimal number (with optional sign)
register_validation('decimal', {
    'pattern': r'^-?[0-9]+(\.[0-9]+)?$',
    'message': 'Must be a decimal number'
})

# Percentage (0-100)
register_validation('percentage', {
    'pattern': r'^(100(\.0+)?|[0-9]{1,2}(\.[0-9]+)?)$',
    'min': 0,
    'max': 100,
    'message': 'Must be a percentage (0-100)'
})
```

#### Date & Time Formats

```python
# ISO 8601 date (YYYY-MM-DD)
register_validation('iso_date', {
    'pattern': r'^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
    'message': 'Invalid date format (use YYYY-MM-DD)'
})

# ISO 8601 datetime
register_validation('iso_datetime', {
    'pattern': r'^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](Z|[+-][0-9]{2}:[0-9]{2})?$',
    'message': 'Invalid datetime format (use ISO 8601)'
})

# Time (HH:MM or HH:MM:SS)
register_validation('time', {
    'pattern': r'^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$',
    'message': 'Invalid time format (use HH:MM or HH:MM:SS)'
})

# Year (4 digits)
register_validation('year', {
    'pattern': r'^[0-9]{4}$',
    'len': 4,
    'message': 'Invalid year (use YYYY)'
})
```

#### Security

```python
# Strong password (min 8 chars, upper, lower, digit, special)
register_validation('password_strong', {
    'pattern': r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$',
    'min': 8,
    'message': 'Password must have 8+ chars, uppercase, lowercase, digit, special char'
})

# Hex string (for tokens, hashes)
register_validation('hex', {
    'pattern': r'^[0-9a-fA-F]+$',
    'message': 'Must be hexadecimal'
})

# Base64 string
register_validation('base64', {
    'pattern': r'^[A-Za-z0-9+/]+=*$',
    'message': 'Must be valid Base64'
})
```

#### Summary Table

| Name | Category | Description |
|------|----------|-------------|
| `email` | Internet | Email address |
| `url` | Internet | HTTP/HTTPS URL |
| `domain` | Internet | Domain name |
| `ipv4` | Internet | IPv4 address |
| `phone` | Internet | International phone (E.164) |
| `uuid` | Identifier | UUID v4 |
| `uuid_any` | Identifier | UUID any version |
| `slug` | Identifier | URL-friendly slug |
| `cf` | Italian | Codice Fiscale |
| `piva` | Italian | Partita IVA |
| `phone_it` | Italian | Italian phone |
| `cap_it` | Italian | CAP (postal code) |
| `iban` | European | IBAN |
| `bic` | European | BIC/SWIFT |
| `vat_eu` | European | EU VAT number |
| `latin` | Text | ASCII only |
| `latin_ext` | Text | Latin-1 |
| `uppercase` | Text | Uppercase only |
| `lowercase` | Text | Lowercase only |
| `alphanumeric` | Text | Letters + digits |
| `no_spaces` | Text | No whitespace |
| `single_line` | Text | No newlines |
| `positive_int` | Numeric | Positive integer |
| `non_negative_int` | Numeric | Zero or positive |
| `decimal` | Numeric | Decimal number |
| `percentage` | Numeric | 0-100 |
| `iso_date` | DateTime | YYYY-MM-DD |
| `iso_datetime` | DateTime | ISO 8601 datetime |
| `time` | DateTime | HH:MM:SS |
| `year` | DateTime | YYYY |
| `password_strong` | Security | Strong password |
| `hex` | Security | Hexadecimal |
| `base64` | Security | Base64 encoded |

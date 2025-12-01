# TYTX Validation Metadata Specification

**Version**: 1.0
**Status**: Draft
**Date**: 2025-12-01

This document defines the standard for embedding validation rules directly into TYTX type definitions.

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
*   `T[len:16]`
*   `N[min:0, max:100]`
*   `T[reg:^[A-Z]{2}$]`

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
*   **Serialization**: Optional. Libraries may offer a "strict" mode to validate data before sending.
*   **Hydration**: Optional. Libraries may validate data upon parsing.
*   **Schema Generation**: Metadata is primarily useful for generating UI forms, SQL schemas, or Swagger/OpenAPI definitions from TYTX structs.

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

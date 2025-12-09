# TYTX JavaScript Implementation Specification

**Date**: 2025-12-09
**Status**: 🔴 TO BE REVIEWED

## Overview

This document specifies how TYTX types are represented in JavaScript, which lacks native `date` and `time` types.

## Date/Time Representation

JavaScript has only one date type: `Date`. To represent Python's three temporal types (`date`, `datetime`, `time`), we use conventions based on the `Date` content.

### Type Detection Rules

All temporal values use native `Date` objects. The TYTX type is determined by inspecting the Date content:

| TYTX Type | Suffix | JavaScript Representation |
|-----------|--------|---------------------------|
| `date` | `::D` | `Date` UTC with `hours=0, minutes=0, seconds=0, ms=0` |
| `time` | `::H` | `Date` UTC with `year=1970, month=0, day=1` (Unix epoch) |
| `datetime` | `::DHZ` | `Date` UTC with actual date and time |

### Detection Function

```javascript
function getDateType(d) {
    const isEpochDate = d.getUTCFullYear() === 1970 &&
                        d.getUTCMonth() === 0 &&
                        d.getUTCDate() === 1;
    const isMidnight = d.getUTCHours() === 0 &&
                       d.getUTCMinutes() === 0 &&
                       d.getUTCSeconds() === 0 &&
                       d.getUTCMilliseconds() === 0;

    if (isEpochDate && !isMidnight) return 'H';   // time only
    if (isMidnight && !isEpochDate) return 'D';   // date only
    return 'DHZ';                                  // full datetime
}
```

## Serialization Examples

### Date (::D)

```javascript
// Python: date(2025, 3, 9)
// Serialized: "2025-03-09::D"

// JavaScript equivalent:
new Date(Date.UTC(2025, 2, 9, 0, 0, 0, 0))  // Note: month is 0-indexed

// Serialize:
"2025-03-09::D"
```

### Time (::H)

```javascript
// Python: time(10, 30, 0)
// Serialized: "10:30:00.000::H"

// JavaScript equivalent:
new Date(Date.UTC(1970, 0, 1, 10, 30, 0, 0))  // Epoch date + time

// Serialize:
"10:30:00.000::H"
```

### Datetime (::DHZ)

```javascript
// Python: datetime(2025, 3, 9, 10, 30, 0)
// Serialized: "2025-03-09T10:30:00.000Z::DHZ"

// JavaScript equivalent:
new Date(Date.UTC(2025, 2, 9, 10, 30, 0, 0))

// Serialize:
"2025-03-09T10:30:00.000Z::DHZ"
```

## Deserialization Examples

### from_tytx("2025-03-09::D")

```javascript
// Parse date string, create Date at midnight UTC
const [year, month, day] = "2025-03-09".split('-').map(Number);
new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
// Result: 2025-03-09T00:00:00.000Z
```

### from_tytx("10:30:00.000::H")

```javascript
// Parse time string, create Date at epoch with time
const [h, m, rest] = "10:30:00.000".split(':');
const [s, ms] = rest.split('.');
new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), Number(s), Number(ms)));
// Result: 1970-01-01T10:30:00.000Z
```

### from_tytx("2025-03-09T10:30:00.000Z::DHZ")

```javascript
// Parse ISO datetime string
new Date("2025-03-09T10:30:00.000Z");
// Result: 2025-03-09T10:30:00.000Z
```

## Edge Cases

### Midnight on Epoch (1970-01-01T00:00:00.000Z)

This is ambiguous - could be date, time, or datetime. Convention:

- Treat as `datetime` (::DHZ) since it's the least likely to be intentional as date-only or time-only

### Creating Date vs Time vs Datetime in Code

```javascript
// To create a DATE (::D):
const myDate = new Date(Date.UTC(2025, 2, 9));  // Defaults to midnight

// To create a TIME (::H):
const myTime = new Date(Date.UTC(1970, 0, 1, 10, 30, 0, 0));

// To create a DATETIME (::DHZ):
const myDatetime = new Date(Date.UTC(2025, 2, 9, 10, 30, 0, 0));
```

## Decimal Handling

JavaScript doesn't have a native Decimal type. The implementation should detect available libraries and fall back gracefully:

### Detection Priority

1. **`decimal.js`** - if installed, use `Decimal` class
2. **`big.js`** - if installed, use `Big` class
3. **`number` (fallback)** - if no library available, use native `Number` (with precision loss warning)

### Detection Function

```javascript
let DecimalClass = null;
let decimalLibrary = null;

// Try decimal.js first
try {
    DecimalClass = (await import('decimal.js')).default;
    decimalLibrary = 'decimal.js';
} catch {
    // Try big.js
    try {
        DecimalClass = (await import('big.js')).default;
        decimalLibrary = 'big.js';
    } catch {
        // No library available, will use Number
        decimalLibrary = 'number';
    }
}

export function createDecimal(value) {
    if (DecimalClass) {
        return new DecimalClass(value);
    }
    // Fallback to Number (precision loss possible)
    return Number(value);
}

export function isDecimal(value) {
    if (DecimalClass) {
        return value instanceof DecimalClass;
    }
    return false;  // No way to distinguish from regular number
}
```

### Serialization

```javascript
function serializeDecimal(v) {
    // Works for Decimal, Big, or Number
    return v.toString();
}
```

### Deserialization

```javascript
function deserializeDecimal(s) {
    return createDecimal(s);  // Uses best available library
}
```

### Notes

- When no Decimal library is available, `::N` values deserialize to `Number`
- This may cause precision loss for very large or very precise values
- The library used can be checked via exported `decimalLibrary` variable

## Summary

No wrapper classes needed. Native `Date` with UTC values, distinguished by content:

- **Date**: Any date at midnight UTC (except epoch)
- **Time**: Epoch date (1970-01-01) with non-midnight time
- **Datetime**: Everything else

Decimal uses best available library (decimal.js > big.js > Number fallback).

# Claude Code Instructions - genro-tytx

## Project Context

**genro-tytx** (TYTX - Typed Text) is a protocol for exchanging typed data over text-based formats like JSON, XML, and MessagePack.

**Naming Convention**:
- **Package name**: `genro-tytx` (PyPI package name, with hyphen)
- **Import name**: `genro_tytx` (Python imports, with underscore)
- **Repository**: `genropy/genro-tytx`
- **Protocol name**: TYTX (Typed Text)

### Current Status
- **Development Status**: Pre-Alpha (`Development Status :: 2 - Pre-Alpha`)
- **Version**: 0.1.0
- **Has Implementation**: No (specification phase)
- **Dependencies**: NONE (Python stdlib only, optional orjson/msgpack)

### Project Overview

TYTX provides:
- Protocol specification for typed text encoding
- Python implementation (hydrate/serialize)
- JavaScript implementation (for browser/Node.js)
- Encoders for JSON, XML, MessagePack
- Extensible type registry

## Repository Information

- **Owner**: genropy
- **Repository**: https://github.com/genropy/genro-tytx
- **Documentation**: https://genro-tytx.readthedocs.io (planned)
- **License**: Apache License 2.0
- **Copyright**: Softwell S.r.l. (2025)

## Project Structure

```
genro-tytx/
├── src/genro_tytx/          # Python implementation
│   ├── __init__.py          # Package exports
│   ├── registry.py          # Type registry
│   ├── types.py             # Built-in types (Decimal, date, etc.)
│   ├── hydrate.py           # Hydration (string → Python)
│   ├── serialize.py         # Serialization (Python → string)
│   └── encoders/            # Format-specific encoders
│       ├── __init__.py
│       ├── json.py          # JSON encoder/decoder
│       ├── xml.py           # XML encoder/decoder
│       └── msgpack.py       # MessagePack encoder/decoder
├── js/                      # JavaScript implementation
│   ├── src/
│   │   ├── index.ts         # Package exports
│   │   ├── registry.ts      # Type registry
│   │   ├── types.ts         # Built-in types
│   │   ├── hydrate.ts       # Hydration
│   │   └── serialize.ts     # Serialization
│   ├── package.json         # NPM package config
│   └── tsconfig.json        # TypeScript config
├── spec/                    # Protocol specification
│   ├── tytx-protocol.md     # Main specification
│   ├── type-codes.md        # Type code registry
│   └── formats/             # Format-specific specs
│       ├── json.md
│       ├── xml.md
│       └── msgpack.md
├── tests/                   # Python tests
├── docs/                    # Sphinx documentation
├── pyproject.toml           # Python package config
├── README.md                # Project overview
├── LICENSE                  # Apache 2.0 license
└── CLAUDE.md                # This file
```

## Language Policy

- **Code, comments, and commit messages**: English
- **Documentation**: English (primary)
- **Communication with user**: Italian (per user preference)

## Git Commit Policy

- **NEVER** include Claude as co-author in commits
- **ALWAYS** remove "Co-Authored-By: Claude <noreply@anthropic.com>" line
- Use conventional commit messages following project style

## Development Guidelines

### Core Principles

1. **Zero dependencies (core)**: Only Python stdlib for core functionality
2. **Optional performance**: orjson, msgpack as optional extras
3. **Dual implementation**: Python + JavaScript must stay in sync
4. **Specification-first**: Protocol spec is the source of truth
5. **Extensible**: Custom types can be registered

### The TYTX Protocol

#### Syntax

```
value::type_code
```

#### Built-in Type Codes

| Code | Alias | Python Type | Description |
|------|-------|-------------|-------------|
| `I` | `int` | `int` | Integer |
| `D` | `decimal` | `Decimal` | Decimal (exact) |
| `d` | `date` | `date` | ISO Date |
| `dt` | `datetime` | `datetime` | ISO DateTime |
| `B` | `bool` | `bool` | Boolean |
| `L` | `list` | `list` | Comma-separated list |
| `T` | `table` | `Table` | Tabular data |

#### Global Marker

```
{"price": "100::D"}::TYTX
```

The `::TYTX` suffix indicates the entire payload contains typed values.

#### MessagePack Integration

```python
# TYTX uses ExtType code 42
ExtType(42, b'{"price": "100::D"}::TYTX')
```

### JavaScript Distribution

The JavaScript implementation needs to be available without Python:

1. **NPM package**: Publish to npm as `genro-tytx`
2. **CDN**: Available via unpkg/jsdelivr
3. **Browser bundle**: UMD build for direct `<script>` inclusion
4. **TypeScript**: Full type definitions included

### Testing

Both implementations must:
- Unit tests for all types
- Round-trip tests (serialize → hydrate → original)
- Cross-implementation tests (Python serialize → JS hydrate)
- Edge cases (null, empty, unicode, etc.)

## Coding Style Rules (MANDATORY)

### 1. No globals

No global variables at module level (except constants and type aliases).

### 2. No class methods

Avoid `@classmethod`. Use module-level functions or alternative patterns.

### 3. Simple patterns only

- Always use simple, direct patterns
- For complex patterns → ask for approval before implementing

## Implementation Workflow (6 Steps)

For each implementation block:

1. **Preliminary Discussion**: Clarify scope, make design decisions
2. **Module Docstring (Source of Truth)**: Detailed docstring
3. **Write Tests First**: Based on docstring
4. **Implementation**: Implement to pass all tests
5. **Documentation**: User-facing docs
6. **Commit**: One commit per block

## Mistakes to Avoid

❌ **DON'T**:
- Break Python/JavaScript parity
- Add dependencies without strong justification
- Modify protocol spec without discussion
- Include Claude as co-author in commits

✅ **DO**:
- Keep implementations minimal and focused
- Follow the specification strictly
- Write tests for both Python and JavaScript
- Document all type codes

## Quick Reference

| File | Purpose |
|------|---------|
| spec/tytx-protocol.md | Protocol specification |
| src/genro_tytx/ | Python implementation |
| js/src/ | JavaScript implementation |
| tests/ | Python test suite |

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0
**Python**: 3.10+
**Part of**: Genro Modules ecosystem

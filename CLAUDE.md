# Claude Code Instructions - genro-tytx

**Parent Document**: This project follows all policies from the central [meta-genro-modules CLAUDE.md](https://github.com/softwellsrl/meta-genro-modules/blob/main/CLAUDE.md)

## Project-Specific Context

### Current Status
- Development Status: Alpha
- Has Implementation: Yes
  - Python: 65 tests passing
  - JavaScript: 29 tests passing
  - TypeScript: 29 tests passing

## Critical Rules

### ⚠️ MAI USARE GLOB TROPPO VORACI

**MAI** usare pattern glob troppo ampi che possono causare crash:
- ❌ `**/*` - troppo vorace
- ❌ `**/*.py` su directory molto grandi
- ✅ Usare path specifici
- ✅ Limitare la ricerca a directory note

Il crash avviene quando il glob restituisce troppi risultati.

## Project-Specific Guidelines

### Type Codes Specification
I type codes sono definiti in `spec/type-codes.md` - questa è la fonte di verità.

### Test-First Development
Ogni modifica al codice deve essere accompagnata da test.

### Package Names
- Python: `genro_tytx` (import from `genro_tytx`)
- npm: `genro-tytx`

---

**All general policies are inherited from the parent document.**

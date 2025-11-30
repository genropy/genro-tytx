# TYTX - Decisioni Architetturali

**Versione**: 0.1.0
**Data**: 2025-11-29
**Status**: 🔴 DA REVISIONARE

---

## 1. Source of Truth: Classi Python

### Decisione

Le **classi Python** sono la fonte di verità per la definizione dei tipi TYTX.
L'implementazione JavaScript viene **generata** dalle definizioni Python.

### Alternative Considerate

| Approccio | Pro | Contro |
|-----------|-----|--------|
| **JSON schema** → Python + JS | Linguaggio neutro, facile da leggere | Meno espressivo, duplica logica parse/serialize |
| **Python** → genera JS | Espressivo, un solo posto per la logica | Richiede codegen |
| **Definizioni separate** Python e JS | Massima flessibilità per linguaggio | Rischio disallineamento |

### Motivazione

1. **Python-first**: il framework principale è Python, quindi ha senso che Python sia il master
2. **Espressività**: le classi Python possono contenere logica complessa (validazione, format, etc.)
3. **Ereditarietà nativa**: Python supporta ereditarietà di classi, perfetto per tipi derivati (es. `MoneyType` eredita da `DecimalType`)
4. **Single point of truth**: modifiche in un solo posto, JS sempre sincronizzato

---

## 2. Gerarchia dei Tipi

### Decisione

I tipi TYTX sono organizzati in una **gerarchia con ereditarietà**:

- **Tipi base** (primitivi): `T`, `N`, `L`, `D`, `DH`, `B`, etc.
- **Tipi derivati**: ereditano da un tipo base e fissano/aggiungono parametri

### Esempio

```python
class DecimalType(DataType):
    """Tipo base per numeri decimali."""
    name = "decimal"
    code = "N"
    python_type = Decimal
    sql_type = "DECIMAL"
    precision = None  # Nessun limite
    format = None     # Nessun format di default


class MoneyType(DecimalType):
    """Tipo derivato per valori monetari."""
    name = "money"
    code = "MNY"
    precision = 2           # Fissato a 2 decimali
    format = "€ #,##0.00"   # Format di default
    sql_type = "DECIMAL(15,2)"
```

### Motivazione

1. **Riuso del codice**: i tipi derivati ereditano `parse()` e `serialize()` dal base
2. **Configurazione dichiarativa**: basta sovrascrivere attributi di classe
3. **Estensibilità**: facile creare nuovi tipi (EUR, USD, PCT, etc.)
4. **Nessun parametro inline**: la sintassi `value::type` resta semplice

---

## 3. Parametri NON Inline

### Decisione

I parametri dei tipi (precision, format, etc.) sono **definiti nella classe**, non passati nella sintassi `value::type`.

### Sintassi

```
✅ Corretto:   "100.50::MNY"     → Money con precision=2
❌ Sbagliato:  "100.50::N:2"     → NON supportato
```

### Motivazione

1. **Semplicità**: la sintassi `value::type` resta minimale e predicibile
2. **Leggibilità**: `::MNY` è più chiaro di `::N:2:€`
3. **Validazione**: il tipo `MNY` garantisce precision=2, non serve validare parametri

---

## 4. Attributi Standard dei Tipi

### Decisione

Ogni tipo TYTX definisce questi attributi:

| Attributo | Tipo | Descrizione | Obbligatorio |
|-----------|------|-------------|--------------|
| `name` | str | Nome leggibile | ✅ |
| `code` | str | Codice breve (es. "N", "MNY") | ✅ |
| `python_type` | type | Tipo Python corrispondente | ✅ |
| `sql_type` | str | Tipo SQL per DDL | ✅ |
| `align` | str | Allineamento display ("L", "R", "C") | ❌ |
| `empty` | any | Valore per stringa vuota | ❌ |
| `precision` | int | Decimali (per numerici) | ❌ |
| `format` | str | Pattern di formattazione | ❌ |

### Motivazione

1. **Display**: `align`, `empty` supportano rendering in UI e tabelle
2. **SQL generation**: `sql_type` permette di generare schema DDL
3. **Multi-target**: stessi metadati servono Python, JS, SQL
4. **Estensibilità**: attributi opzionali per casi specifici

---

## 5. Type Codes Mnemonici

### Decisione

I codici tipo sono **mnemonici** per facilitare la memorizzazione.

### Type Codes

| Code | Python Type | Note |
|------|-------------|------|
| `T` | str | **T**ext |
| `L` | int | **L**ong integer |
| `R` | float | **R**eal number |
| `B` | bool | **B**oolean |
| `D` | date | **D**ate |
| `DHZ` | datetime | **D**ate **H**our **Z**ulu (UTC) |
| `DH` | datetime | **D**ate **H**our (naive, deprecated) |
| `H` | time | **H**our |
| `N` | Decimal | **N**umeric |
| `JS` | list/dict | **J**ava**S**cript object |

### Motivazione

1. **Memorizzazione facile**: ogni codice è un acronimo del tipo
2. **Compattezza**: codici brevi per payload compatti
3. **Leggibilità**: facile capire il tipo guardando il codice

---

## 6. Plugin per Tipi Aggiuntivi

### Decisione

Tipi non-core sono definiti in **moduli plugin separati**.

### Struttura

```
genro-tytx/
├── src/genro_tytx/
│   ├── base.py         # DataType base class
│   ├── builtin.py      # Tipi core (T, N, I, D, etc.)
│   ├── registry.py     # TypeRegistry
│   │
│   └── plugins/        # Tipi pluggabili
│       ├── __init__.py
│       ├── money.py    # MNY, EUR, USD, GBP...
│       ├── geo.py      # LAT, LNG, COORD...
│       └── units.py    # KG, M, KM, PCT...
```

### Uso

```python
from genro_tytx import registry, parse

# Core types sempre disponibili
parse("100::N")  # → Decimal("100")

# Plugin: import esplicito
from genro_tytx.plugins import money
money.register(registry)

parse("100.00::MNY")  # → Money
parse("100.00::EUR")  # → Euro
```

### Motivazione

1. **Modularità**: non tutti i progetti hanno bisogno di tutti i tipi
2. **Dipendenze opzionali**: plugin possono avere dipendenze extra
3. **Estensibilità**: facile aggiungere nuovi plugin
4. **Namespace pulito**: core resta minimale

---

## 7. Generazione JavaScript

### Decisione

Il codice JavaScript viene **generato** dalle classi Python tramite uno script di codegen.

### Workflow

```bash
# Genera JS dai tipi Python
python -m genro_tytx.codegen js > js/src/generated/types.js

# Genera JSON per documentazione
python -m genro_tytx.codegen json > spec/types.json
```

### Output JS Generato

```javascript
// js/src/generated/types.js
// AUTO-GENERATED - DO NOT EDIT

export const DecimalType = {
  name: "decimal",
  code: "N",
  sqlType: "DECIMAL",

  parse(value) {
    return new Decimal(value);
  },

  serialize(value) {
    return value.toString();
  }
};

export const MoneyType = {
  ...DecimalType,
  name: "money",
  code: "MNY",
  precision: 2,
  format: "€ #,##0.00",
  sqlType: "DECIMAL(15,2)"
};
```

### Motivazione

1. **Single source of truth**: Python è il master
2. **Sempre sincronizzato**: JS non può divergere
3. **Automazione CI**: generazione in pipeline
4. **Opzionale**: progetti solo-Python non hanno bisogno di JS

---

## 8. Formato nella Sintassi TYTX

### Decisione

Il `format` è un attributo del tipo, usato **solo per serializzazione/display**, non per parsing.

### Esempio

```python
class MoneyType(DecimalType):
    format = "€ #,##0.00"

    def serialize(self, value: Decimal) -> str:
        # Usa self.format per display formattato
        return str(value)  # Base: solo valore

    def serialize_display(self, value: Decimal) -> str:
        # Versione formattata per UI
        return format_decimal(value, self.format)
```

### Motivazione

1. **Separazione concerns**: parsing ≠ display
2. **Precisione**: `"€ 1.234,56"` è ambiguo da parsare (locale-dependent)
3. **Semplicità**: `parse()` riceve sempre formato standard ISO/numerico

---

## 9. Riepilogo Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                    PYTHON (Source of Truth)                 │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  DataType   │◄───│ DecimalType │◄───│  MoneyType  │     │
│  │   (base)    │    │    (N)      │    │   (MNY)     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │  Registry   │  ← Registra tutti i tipi                  │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
          │
          │ codegen
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    JAVASCRIPT (Generated)                   │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ DecimalType │    │  MoneyType  │    │   ...       │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │  registry   │  ← Auto-registra tipi generati            │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
          │
          │ export
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    spec/types.json                          │
│                    (Documentazione)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. API Pubblica TYTX vs Wrapper Legacy

### Principio

TYTX espone un'**API moderna e pulita**. Wrapper opzionali possono aggiungere metodi legacy per retrocompatibilità con sistemi esistenti.

### API Pubblica TYTX (Moderna)

Queste sono le API che TYTX espone direttamente:

```python
from genro_tytx import fromText, asText, asTypedText, registry, DataType

# Parsing - un'unica funzione intelligente
value = fromText("100.50::N")          # → Decimal (tipo embedded nel testo)
value = fromText("100.50", "N")        # → Decimal (tipo esplicito)
value = fromText("100.50")             # → "100.50" (nessun tipo, ritorna stringa)

# Serializzazione
text = asText(Decimal("100.50"))       # → "100.50" (solo valore)
typed = asTypedText(Decimal("100.50")) # → "100.50::N" (con tipo)

# Registry
registry.register(MyCustomType)        # Registra tipo custom
registry.get("N")                      # → DecimalType
registry.get_for_value(value)          # → tipo per valore Python
registry.is_typed("100::N")            # → True

# Tipi custom
class MyType(DataType):
    name = "mytype"
    code = "MT"
    # ...
```

| Metodo/Funzione | Descrizione |
|-----------------|-------------|
| `fromText(text)` | Parse stringa → Python (tipo embedded se presente) |
| `fromText(text, type_code)` | Parse stringa con tipo esplicito |
| `asText(value)` | Python → stringa (solo valore, senza tipo) |
| `asTypedText(value)` | Python → stringa `value::type` (con tipo) |
| `registry.register(type_cls)` | Registra un tipo |
| `registry.get(code_or_name)` | Ottiene tipo per codice/nome |
| `registry.get_for_value(value)` | Ottiene tipo per valore Python |
| `registry.is_typed(text)` | Verifica se stringa è `value::type` |

### Wrapper Legacy (Opzionale)

Eventuali wrapper **NON sono parte di TYTX core**. Possono vivere in moduli separati `genro_tytx.compat` e aggiungere solo metodi legacy:

```python
# genro_tytx/compat/legacy.py

from genro_tytx import registry

class LegacyCatalog:
    """Wrapper legacy per compatibilità con sistemi esistenti."""

    # Metodi legacy che delegano a TYTX
    def fromTypedText(self, txt):
        return registry.parse(txt)  # Delega a API moderna

    def asTypedText(self, obj, quoted=False):
        result = registry.serialize(obj)
        return self.quoted(result) if quoted else result

    # Metodi legacy che NON esistono in TYTX
    def quoted(self, s):
        """Legacy: aggiunge virgolette."""
        return f'"{s}"' if '"' not in s else f"'{s}'"

    def addClass(self, cls, key, altcls=None,
                 align='L', empty=None, typegetter=None):
        """Legacy: registra tipo con sintassi vecchia."""
        # Converte in formato TYTX e delega
        ...

    def getEmpty(self, key):
        """Legacy: valore vuoto per tipo."""
        ...

    def getAlign(self, key):
        """Legacy: allineamento per tipo."""
        ...

    def asText(self, obj, quoted=False, translate_cb=None):
        """Legacy: serializza senza tipo."""
        ...

    def asTextAndType(self, obj):
        """Legacy: ritorna (text, type_code)."""
        ...
```

### Tabella Comparativa

| Funzionalità | TYTX (moderno) | gnrclasses (legacy) |
|--------------|----------------|---------------------|
| Parse | `fromText()` | `fromText()` / `fromTypedText()` ✅ |
| Serialize con tipo | `asTypedText()` | `asTypedText()` ✅ stessa API |
| Serialize senza tipo | `asText()` | `asText()` ✅ stessa API |
| Registra tipo | `registry.register()` | `addClass()` |
| Ottieni tipo | `registry.get()` | `getClass()` |
| È typed? | `registry.is_typed()` | `isTypedText()` |
| Quoting | ❌ Non esposto | `quoted()` |
| Allineamento | `type.align` (attributo) | `getAlign()` |
| Valore vuoto | `type.empty` (attributo) | `getEmpty()` |
| Tipo da valore | `registry.get_for_value()` | `getClassKey()`, `getType()` |
| Text + Type tuple | ❌ Non esposto | `asTextAndType()` |
| Translation callback | ❌ Non supportato | `asText(translate_cb=...)` |

### Razionale

1. **TYTX è pulito**: API minimale, nomi chiari, senza legacy
2. **Wrapper è opzionale**: progetti nuovi non lo importano
3. **Separazione netta**: `genro_tytx` vs `genro_tytx.compat`
4. **Migrazione graduale**: sistemi esistenti usano wrapper, poi migrano a TYTX diretto

### Test di Compatibilità

```python
# tests/test_compat.py

from genro_tytx.compat import LegacyCatalog

def test_legacy_catalog_compat():
    """Verifica che wrapper esponga API legacy."""
    cc = LegacyCatalog()

    # Metodi legacy funzionano
    res = cc.isTypedText("foobar::HTML")
    assert res == True

    res = cc.fromTypedText("42::L")
    assert res == 42

    res = cc.asTypedText(42)
    assert res == "42::L"

    res = cc.asTypedText(42, quoted=True)
    assert res == '"42::L"'
```

---

## 11. Prossimi Passi

1. **Aggiornare `base.py`**: aggiungere attributi standard (`sql_type`, `align`, `empty`, etc.)
2. **Aggiornare `builtin.py`**: aggiornare tipi (codici L, R, DHZ, etc.)
3. **Creare `compat/legacy.py`**: wrapper compatibile (opzionale)
4. **Creare `codegen.py`**: generatore JS e JSON
5. **Creare struttura `plugins/`**: primo plugin `money.py`
6. **Test cross-language**: Python serializza → JS deserializza

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0

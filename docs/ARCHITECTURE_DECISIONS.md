# TYTX - Decisioni Architetturali

**Versione**: 0.2.0
**Data**: 2025-11-30
**Status**: 🟡 PARZIALMENTE APPROVATO

---

## 1. Tre Implementazioni Parallele

### Decisione

TYTX ha **tre implementazioni ufficiali** indipendenti che seguono la stessa specifica:

| Implementazione | Package | Runtime |
|----------------|---------|---------|
| **Python** | `genro-tytx` (PyPI) | Python 3.10+ |
| **JavaScript** | `genro-tytx` (npm) | Node.js, Browser |
| **TypeScript** | `genro-tytx` (npm) | Node.js, Browser |

Non c'è generazione automatica di codice tra le implementazioni.

### Motivazione

1. **Ottimizzazione per piattaforma**: ogni linguaggio usa idiomi nativi
2. **Zero dipendenze di build**: non serve codegen
3. **Semplicità**: la specifica è la fonte di verità, non il codice
4. **Type safety**: TypeScript fornisce tipi statici per sviluppatori TS

---

## 2. Type Codes Mnemonici

### Decisione

I codici tipo sono **mnemonici** per facilitare la memorizzazione.

### Type Codes Built-in

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

## 3. Custom Types con Prefisso X_

### Decisione

I tipi custom definiti dall'utente usano il prefisso `X_` per evitare collisioni con i tipi built-in.

### Pattern `register_class`

```python
# Python
registry.register_class(
    code="UUID",  # diventa "X_UUID"
    cls=uuid.UUID,
    serialize=lambda u: str(u),
    parse=lambda s: uuid.UUID(s)
)
```

```javascript
// JavaScript
registry.register_class({
    code: "UUID",  // diventa "X_UUID"
    cls: null,
    serialize: (u) => String(u),
    parse: (s) => s
});
```

### Namespace

| Prefisso | Tipo | Esempio | Gestito da |
|----------|------|---------|------------|
| (nessuno) | Built-in | `::L`, `::D`, `::DHZ` | TYTX core |
| `X_` | Custom | `::X_UUID`, `::X_INV` | `register_class` |

### Motivazione

1. **Nessuna collisione**: impossibile sovrascrivere tipi built-in
2. **Chiaro nel wire format**: si vede subito che è custom
3. **Fallback sicuro**: se JS non conosce `X_XXX`, resta stringa
4. **Futuro-proof**: TYTX può aggiungere nuovi built-in senza conflitti

---

## 4. Struttura XML con attrs/value

### Decisione

La struttura XML usa `{"tag": {"attrs": {...}, "value": ...}}` sia in Python che JS.

### Motivazione

1. **Separazione chiara**: attributi e contenuto sono distinti
2. **Parità Python/JS**: stessa struttura su entrambe le piattaforme
3. **Gestione di casi complessi**: elementi con attributi e figli

---

## 5. MessagePack con ExtType 42

### Decisione

TYTX usa MessagePack ExtType code **42** per payload tipizzati.

### Formato

```python
ExtType(42, b'{"price": "100::N"}')
```

Il contenuto è JSON con valori TYTX encoded.

### Motivazione

1. **Identificazione univoca**: ExtType 42 è riservato a TYTX
2. **Interoperabilità**: JSON interno è leggibile ovunque
3. **Efficienza**: msgpack per il trasporto, JSON per la struttura

---

## 6. API Pubblica snake_case

### Decisione

Tutte le API pubbliche usano **snake_case** sia in Python che JavaScript.

### API Core

| Funzione | Descrizione |
|----------|-------------|
| `from_text(text, type_code=None)` | Parse stringa tipizzata |
| `as_text(value, format=None, locale=None)` | Serializza senza tipo |
| `as_typed_text(value, compact_array=False)` | Serializza con tipo |
| `from_json(json_str)` | Parse JSON con idratazione |
| `as_json(data)` | JSON standard |
| `as_typed_json(data)` | JSON con tipi TYTX |
| `from_xml(xml_str)` | Parse XML |
| `as_xml(data, root_tag=None)` | XML standard |
| `as_typed_xml(data, root_tag=None)` | XML con tipi TYTX |
| `from_msgpack(data)` | Parse MessagePack |
| `as_msgpack(data)` | MessagePack standard |
| `as_typed_msgpack(data)` | MessagePack con ExtType 42 |

### Motivazione

1. **Consistenza**: stesso stile su tutte le piattaforme
2. **Python-friendly**: snake_case è lo standard Python (PEP 8)
3. **Predicibilità**: utenti sanno sempre cosa aspettarsi

---

## 7. Zero Dipendenze Core

### Decisione

Il core TYTX non ha dipendenze runtime, solo stdlib.

### Dipendenze Opzionali

**Python:**

- `orjson` - JSON più veloce
- `msgpack` - supporto MessagePack

**JavaScript:**

- `big.js` o `decimal.js` - Decimal preciso
- `@msgpack/msgpack` - MessagePack

### Motivazione

1. **Installazione leggera**: funziona out-of-the-box
2. **Nessun conflitto**: no dependency hell
3. **Opt-in performance**: chi vuole può aggiungere orjson/msgpack

---

## 8. Dual Output: Standard e Typed

### Decisione

Ogni formato ha due funzioni di output:

- `as_*` → output standard (per sistemi esterni)
- `as_typed_*` → output con tipi TYTX

### Esempio

```python
data = {"price": Decimal("100.50")}

as_json(data)        # '{"price": 100.5}'      (standard)
as_typed_json(data)  # '{"price": "100.50::N"}' (TYTX)
```

### Motivazione

1. **Interoperabilità**: `as_json` produce JSON valido per qualsiasi sistema
2. **Preservazione tipi**: `as_typed_json` mantiene informazione di tipo
3. **Scelta esplicita**: l'utente decide quale usare

---

## 9. DataType Interno per Built-in

### Decisione

`DataType` è una classe base **interna** usata solo per i tipi built-in.
Gli utenti usano `register_class` per tipi custom.

### Motivazione

1. **API semplice**: `register_class` è più facile da usare
2. **Nessuna ereditarietà**: pattern funzionale
3. **Separazione**: core stabile, custom flessibile

---

## 10. Fallback Graceful

### Decisione

Tipi sconosciuti vengono restituiti come stringhe, senza errori.

### Comportamento

```python
from_text("value::UNKNOWN")  # → "value::UNKNOWN" (stringa)
from_text("value::X_FOO")  # → "value::X_FOO" (se non registrato)
```

### Motivazione

1. **Robustezza**: nessun crash per tipi mancanti
2. **Debugging facile**: il valore originale è preservato
3. **Interoperabilità**: Python e JS possono avere tipi diversi registrati

---

**Copyright**: Softwell S.r.l. (2025)
**License**: Apache License 2.0

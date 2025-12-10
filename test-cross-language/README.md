# Test Cross-Language

Test interop Python/JS per TYTX (JSON, XML, MessagePack) con dataset condiviso e scenari heavy.

## Struttura
- `dataset_spec.json`: specifica unica dei casi (scalari, compositi, recordset da 2k righe/30 colonne).
- `python/`: builder + test `pytest` per JSON/XML/MessagePack/HTTP wrappers.
- `js/`: builder + test `node:test` per JSON.

## Dataset
- Copre scalari nativi e speciali (Decimal, date, datetime naive/UTC, time con millisecondi, bool, int/float, string, null).
- Strutture complesse (liste miste, dizionari annidati).
- Recordset realistico (2k righe, 30 colonne con pattern deterministici) per stress su dimensioni e tempi.

## Esecuzione
```bash
# Python
pytest test-cross-language/python/test_full_suite.py

# JS
node --test test-cross-language/js/test_full_suite.js
```

### Requisiti opzionali
- Python: `msgpack` per i test MessagePack.
- JS: `big.js` o `decimal.js` per confronti Decimal più precisi; altrimenti usa Number.

## Metriche
Ogni test stampa su stderr durata (s) e dimensione payload (byte) per visibilità di performance/ingombri.

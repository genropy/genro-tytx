# Copyright 2025 Softwell S.r.l.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Italian locale validations for TYTX.

Usage:
    from genro_tytx.validation_locale import it
    from genro_tytx import validation_registry

    # Register all Italian validations
    it.register_all(validation_registry)

    # Or register individually
    validation_registry.register('cf', it.VALIDATIONS['cf'])
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..struct import ValidationDef, ValidationRegistry

VALIDATIONS: dict[str, "ValidationDef"] = {
    # Codice Fiscale
    "cf": {
        "pattern": r"^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$",
        "len": 16,
        "message": "Codice Fiscale non valido",
    },
    # Partita IVA
    "piva": {
        "pattern": r"^[0-9]{11}$",
        "len": 11,
        "message": "Partita IVA non valida",
    },
    # Telefono italiano
    "phone_it": {
        "pattern": r"^(\+39)?[ ]?[0-9]{2,4}[ ]?[0-9]{4,8}$",
        "message": "Numero di telefono non valido",
    },
    # CAP (Codice Avviamento Postale)
    "cap": {
        "pattern": r"^[0-9]{5}$",
        "len": 5,
        "message": "CAP non valido",
    },
    # Targa auto italiana (formato attuale AA000AA)
    "targa": {
        "pattern": r"^[A-Z]{2}[0-9]{3}[A-Z]{2}$",
        "len": 7,
        "message": "Targa non valida (formato AA000AA)",
    },
    # Codice SDI (Sistema di Interscambio) per fatturazione elettronica
    "sdi": {
        "pattern": r"^[A-Z0-9]{7}$",
        "len": 7,
        "message": "Codice SDI non valido",
    },
    # PEC (Posta Elettronica Certificata)
    "pec": {
        "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.pec\.it$",
        "message": "Indirizzo PEC non valido",
    },
    # Codice ATECO (attività economica)
    "ateco": {
        "pattern": r"^[0-9]{2}\.[0-9]{2}(\.[0-9]{1,2})?$",
        "message": "Codice ATECO non valido (formato XX.XX o XX.XX.X)",
    },
    # Numero REA (Repertorio Economico Amministrativo)
    "rea": {
        "pattern": r"^[A-Z]{2}[0-9]{6,7}$",
        "message": "Numero REA non valido (formato PPNNNNNN)",
    },
    # IBAN italiano
    "iban_it": {
        "pattern": r"^IT[0-9]{2}[A-Z][0-9]{10}[A-Z0-9]{12}$",
        "len": 27,
        "message": "IBAN italiano non valido",
    },
    # Codice CIG (Codice Identificativo Gara)
    "cig": {
        "pattern": r"^[A-Z0-9]{10}$",
        "len": 10,
        "message": "Codice CIG non valido",
    },
    # Codice CUP (Codice Unico Progetto)
    # Format: J31B17000510007 (1 letter + 2 digits + 1 letter + 2 digits + 9 alphanumeric)
    "cup": {
        "pattern": r"^[A-Z][0-9]{2}[A-Z][0-9]{2}[A-Z0-9]{9}$",
        "len": 15,
        "message": "Codice CUP non valido",
    },
}


def register_all(registry: "ValidationRegistry") -> None:
    """Register all Italian validations in the given registry.

    Args:
        registry: ValidationRegistry instance to register validations in
    """
    for name, definition in VALIDATIONS.items():
        registry.register(name, definition)


def unregister_all(registry: "ValidationRegistry") -> None:
    """Unregister all Italian validations from the given registry.

    Args:
        registry: ValidationRegistry instance to unregister validations from
    """
    for name in VALIDATIONS:
        registry.unregister(name)


__all__ = ["VALIDATIONS", "register_all", "unregister_all"]

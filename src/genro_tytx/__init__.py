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

"""
TYTX (Typed Text) - A protocol for exchanging typed data over text-based formats.

TYTX solves the "stringly typed" problem of JSON and other text formats by
encoding type information directly into value strings using a concise syntax.

Syntax
------
The core syntax is ``value::type_code``:

- ``value``: The string representation of the data
- ``::``: The separator
- ``type_code``: A short code (e.g., ``I``, ``D``, ``dt``) identifying the type

Examples
--------
>>> from genro_tytx import hydrate, serialize
>>> from decimal import Decimal
>>> from datetime import date

# Hydrate TYTX values to Python objects
>>> hydrate({"price": "100.50::D", "date": "2025-01-15::d"})
{'price': Decimal('100.50'), 'date': datetime.date(2025, 1, 15)}

# Serialize Python objects to TYTX values
>>> serialize({"price": Decimal("100.50"), "date": date(2025, 1, 15)})
{'price': '100.50::D', 'date': '2025-01-15::d'}

Built-in Type Codes
-------------------
- ``I`` / ``int``: Integer
- ``D`` / ``decimal``: Decimal (exact)
- ``d`` / ``date``: ISO Date
- ``dt`` / ``datetime``: ISO DateTime
- ``B`` / ``bool``: Boolean
- ``L`` / ``list``: Comma-separated list
- ``T`` / ``table``: Tabular data

Global Marker
-------------
For entire payloads containing TYTX values, append ``::TYTX``::

    {"price": "100::D", "date": "2025-01-15::d"}::TYTX

"""

__version__ = "0.1.0"
__all__ = [
    "__version__",
    # Core functions (to be implemented)
    # "hydrate",
    # "serialize",
    # "registry",
]

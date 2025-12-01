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

"""Locale-specific validations for TYTX.

Available locales:
    - it: Italian validations (cf, piva, cap, targa, sdi, pec, etc.)

Usage:
    from genro_tytx.validation_locale import it
    from genro_tytx import validation_registry

    # Register all Italian validations
    it.register_all(validation_registry)

    # Or import and use specific validations
    validation_registry.register('cf', it.VALIDATIONS['cf'])
"""

from . import it

__all__ = ["it"]

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

"""Test package version and imports."""

import genro_tytx


def test_version_exists() -> None:
    """Test that version is defined."""
    assert hasattr(genro_tytx, "__version__")
    assert isinstance(genro_tytx.__version__, str)


def test_version_format() -> None:
    """Test that version follows semver format."""
    version = genro_tytx.__version__
    parts = version.split(".")
    assert len(parts) >= 2, "Version should have at least major.minor"
    assert all(part.isdigit() for part in parts[:2]), "Major and minor should be numeric"

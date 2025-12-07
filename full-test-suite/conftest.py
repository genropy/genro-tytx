# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Pytest configuration for E2E tests."""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

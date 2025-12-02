"""Tests for msgpack_utils, including XTYTX ExtType handling."""

import json
from decimal import Decimal

import pytest

# Skip entire module if msgpack is not installed
pytest.importorskip("msgpack")

from genro_tytx import registry
from genro_tytx.msgpack_utils import XTYTX_EXT_TYPE, packb, tytx_decoder, unpackb


def test_tytx_exttype_roundtrip_decimal():
    """ExtType 42 roundtrip preserves Decimal via TYTX JSON."""
    data = {"price": Decimal("10.50")}
    packed = packb(data)
    restored = unpackb(packed)
    assert restored["price"] == Decimal("10.50")


def test_tyxtx_exttype_envelope():
    """ExtType 43 (XTYTX) decodes via tytx_decoder."""
    try:
        registry.register_struct("POINT", {"x": "L"})
        envelope = {
            "gstruct": {"POINT": {"x": "L"}},
            "lstruct": {},
            "gschema": {},
            "lschema": {},
            "data": '{"pt": "{\\"x\\": \\"1\\"}::@POINT"}',
        }
        payload = json.dumps(envelope).encode("utf-8")

        import msgpack

        packed = msgpack.packb(msgpack.ExtType(XTYTX_EXT_TYPE, payload))
        result = msgpack.unpackb(packed, ext_hook=tytx_decoder)
        assert result.data == {"pt": {"x": 1}}
    finally:
        registry.unregister_struct("POINT")

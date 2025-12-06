# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for XML encoding/decoding."""

from datetime import date, datetime
from decimal import Decimal

import pytest

from genro_tytx_base import to_xml, from_xml


class TestXmlEncode:
    """Tests for to_xml encoding."""

    def test_decimal(self):
        result = to_xml({"price": Decimal("100.50")})
        assert '_type="N"' in result
        assert ">100.50<" in result

    def test_date(self):
        result = to_xml({"d": date(2025, 1, 15)})
        assert '_type="D"' in result
        assert ">2025-01-15<" in result

    def test_nested(self):
        result = to_xml({
            "invoice": {
                "total": Decimal("999.99"),
            }
        })
        assert "<invoice>" in result
        assert '<total _type="N">999.99</total>' in result

    def test_list(self):
        result = to_xml({"items": [1, 2, 3]})
        assert "<item " in result or "<item>" in result
        assert "_type" in result


class TestXmlDecode:
    """Tests for from_xml decoding."""

    def test_decimal(self):
        result = from_xml('<root><price _type="N">100.50</price></root>')
        assert result == {"price": Decimal("100.50")}

    def test_date(self):
        result = from_xml('<root><d _type="D">2025-01-15</d></root>')
        assert result == {"d": date(2025, 1, 15)}

    def test_nested(self):
        result = from_xml('''
            <root>
                <invoice>
                    <total _type="N">999.99</total>
                </invoice>
            </root>
        ''')
        assert result == {"invoice": {"total": Decimal("999.99")}}


class TestXmlRoundTrip:
    """Tests for XML roundtrip."""

    def test_decimal_roundtrip(self):
        original = {"price": Decimal("100.50")}
        encoded = to_xml(original, declaration=False)
        decoded = from_xml(encoded)
        assert decoded == original

    def test_nested_roundtrip(self):
        original = {
            "invoice": {
                "total": Decimal("999.99"),
                "date": date(2025, 1, 15),
            }
        }
        encoded = to_xml(original, declaration=False)
        decoded = from_xml(encoded)
        assert decoded == original

# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Tests for HTTP utilities."""

from decimal import Decimal

import pytest

from genro_tytx import (
    get_content_type,
    encode_body,
    decode_body,
    make_headers,
    MIME_JSON,
    MIME_TYTX_JSON,
    MIME_XML,
    MIME_TYTX_XML,
    MIME_MSGPACK,
    MIME_TYTX_MSGPACK,
)


class TestContentType:
    """Tests for get_content_type."""

    def test_json_tytx(self):
        assert get_content_type("json", tytx=True) == MIME_TYTX_JSON

    def test_json_plain(self):
        assert get_content_type("json", tytx=False) == MIME_JSON

    def test_xml_tytx(self):
        assert get_content_type("xml", tytx=True) == MIME_TYTX_XML

    def test_xml_plain(self):
        assert get_content_type("xml", tytx=False) == MIME_XML

    def test_msgpack_tytx(self):
        assert get_content_type("msgpack", tytx=True) == MIME_TYTX_MSGPACK

    def test_msgpack_plain(self):
        assert get_content_type("msgpack", tytx=False) == MIME_MSGPACK

    def test_unknown_format(self):
        with pytest.raises(ValueError):
            get_content_type("unknown")


class TestEncodeBody:
    """Tests for encode_body."""

    def test_json(self):
        result = encode_body({"price": Decimal("100.50")}, format="json")
        assert isinstance(result, str)
        assert "::JS" in result

    def test_xml(self):
        result = encode_body(
            {
                "root": {
                    "attrs": {},
                    "value": {"price": {"attrs": {}, "value": Decimal("100.50")}},
                }
            },
            format="xml",
        )
        assert isinstance(result, str)
        assert "::N" in result

    def test_msgpack(self):
        result = encode_body({"price": Decimal("100.50")}, format="msgpack")
        assert isinstance(result, bytes)

    def test_unknown_format(self):
        with pytest.raises(ValueError):
            encode_body({"test": 1}, format="unknown")


class TestDecodeBody:
    """Tests for decode_body."""

    def test_json_by_content_type(self):
        body = '{"price": "100.50::N"}::JS'
        result = decode_body(body, content_type="application/json")
        assert result == {"price": Decimal("100.50")}

    def test_json_default_no_content_type(self):
        """Default to JSON when no content_type specified."""
        body = '{"price": "100.50::N"}::JS'
        result = decode_body(body)
        assert result == {"price": Decimal("100.50")}

    def test_json_bytes(self):
        """JSON body as bytes."""
        body = b'{"price": "100.50::N"}::JS'
        result = decode_body(body, format="json")
        assert result == {"price": Decimal("100.50")}

    def test_xml_by_content_type(self):
        body = "<root><price>100.50::N</price></root>"
        result = decode_body(body, content_type="application/xml")
        # XML returns the new attrs/value structure
        assert result == {
            "root": {
                "attrs": {},
                "value": {"price": {"attrs": {}, "value": Decimal("100.50")}},
            }
        }

    def test_xml_bytes(self):
        """XML body as bytes."""
        body = b"<root><price>100.50::N</price></root>"
        result = decode_body(body, format="xml")
        assert result["root"]["value"]["price"]["value"] == Decimal("100.50")

    def test_msgpack_by_content_type(self):
        """Decode msgpack by content type."""
        from genro_tytx import to_msgpack

        original = {"price": Decimal("100.50")}
        packed = to_msgpack(original)
        result = decode_body(packed, content_type="application/msgpack")
        assert result == original

    def test_msgpack_explicit_format(self):
        """Decode msgpack with explicit format."""
        from genro_tytx import to_msgpack

        original = {"price": Decimal("100.50")}
        packed = to_msgpack(original)
        result = decode_body(packed, format="msgpack")
        assert result == original

    def test_explicit_format(self):
        body = '{"price": "100.50::N"}::JS'
        result = decode_body(body, format="json")
        assert result == {"price": Decimal("100.50")}

    def test_unknown_format(self):
        with pytest.raises(ValueError):
            decode_body('{"test": 1}', format="unknown")


class TestMakeHeaders:
    """Tests for make_headers."""

    def test_json_headers(self):
        headers = make_headers("json", tytx=True, accept=True)
        assert headers["Content-Type"] == MIME_TYTX_JSON
        assert headers["Accept"] == MIME_TYTX_JSON

    def test_no_accept(self):
        headers = make_headers("json", tytx=True, accept=False)
        assert "Accept" not in headers

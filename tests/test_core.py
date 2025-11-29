from datetime import date, datetime
from decimal import Decimal

from genro_tytx import parse, serialize
from genro_tytx.xml_utils import dict_to_xml, xml_to_dict


class TestTypeRegistry:
    def test_parse_int(self):
        assert parse("123::I") == 123
        assert parse("123::int") == 123

    def test_parse_float(self):
        assert parse("123.45::F") == 123.45

    def test_parse_bool(self):
        assert parse("true::B") is True
        assert parse("false::B") is False

    def test_parse_str(self):
        assert parse("hello::S") == "hello"

    def test_parse_json(self):
        assert parse('{"a":1}::J') == {"a": 1}

    def test_parse_list(self):
        assert parse("a,b,c::L") == ["a", "b", "c"]

    def test_parse_decimal(self):
        assert parse("123.45::D") == Decimal("123.45")

    def test_parse_date(self):
        assert parse("2025-01-15::d") == date(2025, 1, 15)

    def test_parse_datetime(self):
        assert parse("2025-01-15T10:00:00::dt") == datetime(2025, 1, 15, 10, 0, 0)

    def test_parse_no_type(self):
        assert parse("123") == "123"

    def test_serialize(self):
        assert serialize(123) == "123::I"
        assert serialize(123.45) == "123.45::F"
        assert serialize(True) == "true::B"
        assert serialize(False) == "false::B"
        assert serialize(Decimal("123.45")) == "123.45::D"
        assert serialize(date(2025, 1, 15)) == "2025-01-15::d"
        assert serialize(datetime(2025, 1, 15, 10, 0, 0)) == "2025-01-15T10:00:00::dt"
        assert serialize({"a": 1}) == '{"a": 1}::J'
        assert serialize("hello") == "hello"

class TestXMLUtils:
    def test_dict_to_xml_simple(self):
        data = {"root": {"@attr": 123, "#text": "content"}}
        xml = dict_to_xml(data)
        assert 'attr="123::I"' in xml
        assert '>content</root>' in xml

    def test_dict_to_xml_typed_content(self):
        data = {"root": Decimal("10.50")}
        xml = dict_to_xml(data)
        assert '>10.50::D</root>' in xml

    def test_xml_to_dict_simple(self):
        xml = '<root attr="123::I">content</root>'
        data = xml_to_dict(xml)
        assert data["root"]["@attr"] == 123
        assert data["root"]["#text"] == "content"

    def test_xml_to_dict_typed_content(self):
        xml = '<root>10.50::D</root>'
        data = xml_to_dict(xml)
        assert data["root"] == Decimal("10.50")

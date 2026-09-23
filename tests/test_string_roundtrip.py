# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Contract tests for top-level strings on the JSON transport (issue #43).

A top-level string is JSON-quoted before the transport wrapping, so a string
and the value it spells never encode to the same text. The last class drives
the JavaScript client through node so the two wires are checked against each
other, not only against themselves.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from genro_tytx import from_tytx, to_tytx

STRINGS = [
    "42",
    "true",
    "false",
    "null",
    "1.5",
    "[1,2]",
    '{"a":1}',
    "hello",
    "",
    "x::JS",
    'say "hi"',
    '"q"',
    "àè",
]
NON_STRINGS = [42, 1.5, True, False, None, [1, 2], {"a": 1}, ["42", "true"], {"code": "42"}]
TRANSPORTS = [None, "json"]
JS_SRC = Path(__file__).resolve().parents[1] / "js" / "src" / "index.js"


class TestTopLevelString:
    """A string comes back as the same string, never as the value it spells."""

    @pytest.mark.parametrize("transport", TRANSPORTS)
    @pytest.mark.parametrize("value", STRINGS)
    def test_roundtrip(self, value, transport):
        decoded = from_tytx(to_tytx(value, transport), transport)
        assert decoded == value
        assert isinstance(decoded, str)

    @pytest.mark.parametrize("transport", TRANSPORTS)
    def test_string_and_number_encode_differently(self, transport):
        assert to_tytx("42", transport) != to_tytx(42, transport)


class TestNonStringUnchanged:
    """Values that already round-tripped keep doing so."""

    @pytest.mark.parametrize("transport", TRANSPORTS)
    @pytest.mark.parametrize("value", NON_STRINGS, ids=repr)
    def test_roundtrip(self, value, transport):
        decoded = from_tytx(to_tytx(value, transport), transport)
        assert decoded == value
        assert type(decoded) is type(value)


JS_ECHO = """
import { fromTytx, toTytx } from JS_SRC_URL;
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const wire = JSON.parse(Buffer.concat(chunks).toString('utf8'));
process.stdout.write(JSON.stringify({
    decoded: wire.python.map((w) => fromTytx(w, 'json')),
    encoded: wire.values.map((v) => toTytx(v, 'json')),
}));
""".replace("JS_SRC_URL", json.dumps(str(JS_SRC)))


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
class TestStringPythonJavaScript:
    """Python and JavaScript write the same wire and read each other's."""

    def test_same_wire_both_ways(self):
        wire = {"python": [to_tytx(v, "json") for v in STRINGS], "values": STRINGS}
        result = subprocess.run(
            ["node", "--input-type=module", "-e", JS_ECHO],
            input=json.dumps(wire), text=True, capture_output=True, check=True,
        )
        reply = json.loads(result.stdout)
        assert reply["decoded"] == STRINGS
        assert reply["encoded"] == wire["python"]
        assert [from_tytx(w, "json") for w in reply["encoded"]] == STRINGS

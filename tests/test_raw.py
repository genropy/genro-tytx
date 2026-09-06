# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""Contract tests for the RAW type: bytes over JSON, XML and MessagePack.

On the text transports bytes travel as standard base64 under the "RAW" code;
on msgpack they are the native bin type, with no base64 and no extension.
The last class drives the JavaScript client through node so the two
implementations are checked against each other, not only against themselves.
"""

import base64
import json
import shutil
import subprocess
from pathlib import Path

import msgpack
import pytest

from genro_tytx import from_tytx, to_tytx

SAMPLES = [
    b"",
    b"\x00",
    b"\x00\x00\x00",
    b"a",
    b"ab",
    b"abc",
    b"abcd",
    b"\xff\xfe\xfd",
    bytes(range(256)),
]
TRANSPORTS = [None, "json", "msgpack"]
JS_SRC = Path(__file__).resolve().parents[1] / "js" / "src" / "index.js"


def _wrapped(blob: bytes) -> dict:
    """The shape every test round-trips: bytes inside a dict and inside a list."""
    return {"blob": blob, "items": [blob, "k", 1], "n": len(blob)}


class TestRawWireFormat:
    def test_scalar_is_standard_base64(self):
        assert to_tytx(b"ab") == "YWI=::RAW"
        assert to_tytx(b"") == "::RAW"
        assert to_tytx(b"\x00") == "AA==::RAW"
        assert to_tytx(bytes(range(3))) == "AAEC::RAW"

    def test_inside_structure_marks_the_json(self):
        encoded = to_tytx({"b": b"\x00"})
        assert encoded == '{"b":"AA==::RAW"}::JS'

    def test_msgpack_is_native_bin(self):
        """No base64 and no extension type: a plain msgpack reader sees the bytes."""
        packed = to_tytx({"b": b"\x00ab"}, "msgpack")
        assert msgpack.unpackb(packed) == {"b": b"\x00ab"}

    def test_invalid_base64_is_an_error(self):
        with pytest.raises(ValueError):
            from_tytx("not base64!::RAW")

    @pytest.mark.parametrize(
        "bad", ["YQ::RAW", "Y Q==::RAW", "Y*==::RAW", "YQ==\n::RAW", "YQ=::RAW", " YQ==::RAW"]
    )
    def test_lenient_base64_is_refused(self, bad):
        """Missing padding, inner space, character outside the alphabet,
        trailing newline, short padding: refused, same as the JS client."""
        with pytest.raises(ValueError):
            from_tytx(bad)

    def test_bytearray_is_not_bytes(self):
        """Exact-type lookup: only bytes is RAW."""
        with pytest.raises(TypeError, match="not JSON serializable"):
            to_tytx({"b": bytearray(b"ab")})


class TestRawRoundtrip:
    @pytest.mark.parametrize("blob", SAMPLES, ids=lambda b: f"len{len(b)}")
    @pytest.mark.parametrize("transport", TRANSPORTS)
    def test_dict_and_list(self, blob, transport):
        decoded = from_tytx(to_tytx(_wrapped(blob), transport), transport)
        assert decoded == _wrapped(blob)
        assert type(decoded["blob"]) is bytes
        assert type(decoded["items"][0]) is bytes

    @pytest.mark.parametrize("blob", SAMPLES, ids=lambda b: f"len{len(b)}")
    def test_xml_text_and_attribute(self, blob):
        value = {"root": {"attrs": {"sig": blob}, "value": _wrapped(blob)}}
        decoded = from_tytx(to_tytx(value, "xml"), "xml")
        assert decoded["root"]["attrs"] == {"sig": blob}
        assert decoded["root"]["value"] == _wrapped(blob)


JS_ECHO = """
import { toTytx, fromTytx } from JS_SRC_URL;
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const wire = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const decodeJson = fromTytx(wire.json, 'json');
const decodeMp = fromTytx(new Uint8Array(Buffer.from(wire.msgpack, 'base64')), 'msgpack');
const check = (v) => v.blob instanceof Uint8Array && v.items[0] instanceof Uint8Array
    && v.blob.length === v.n && v.items[0].length === v.n;
if (!check(decodeJson) || !check(decodeMp)) { throw new Error('not Uint8Array on the JS side'); }
process.stdout.write(JSON.stringify({
    json: toTytx(decodeJson, 'json'),
    msgpack: Buffer.from(toTytx(decodeMp, 'msgpack')).toString('base64'),
}));
""".replace("JS_SRC_URL", json.dumps(str(JS_SRC)))


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
class TestRawPythonJavaScript:
    """Python -> JS -> Python on json and msgpack, same bytes at every hop."""

    @pytest.mark.parametrize("blob", SAMPLES, ids=lambda b: f"len{len(b)}")
    def test_roundtrip_through_node(self, blob):
        value = _wrapped(blob)
        wire = {
            "json": to_tytx(value, "json"),
            "msgpack": base64.b64encode(to_tytx(value, "msgpack")).decode("ascii"),
        }
        result = subprocess.run(
            ["node", "--input-type=module", "-e", JS_ECHO],
            input=json.dumps(wire), text=True, capture_output=True, check=True,
        )
        reply = json.loads(result.stdout)
        assert from_tytx(reply["json"], "json") == value
        assert from_tytx(base64.b64decode(reply["msgpack"]), "msgpack") == value

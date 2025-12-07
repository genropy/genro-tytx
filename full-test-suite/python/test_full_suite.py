"""
Full interoperability test suite (Python side).

Uses the shared dataset spec to run exhaustive encode/decode checks for
JSON, XML, MessagePack, and HTTP wrappers. Performance snapshots are
printed (duration + payload size).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

import pytest

# Allow importing dataset_builder without altering project package layout
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from dataset_builder import build_dataset  # type: ignore

from genro_tytx import (
    MIME_TYTX_JSON,
    MIME_TYTX_MSGPACK,
    MIME_TYTX_XML,
    decode_body,
    encode_body,
    from_json,
    from_msgpack,
    from_text,
    from_xml,
    make_headers,
    to_msgpack,
    to_typed_json,
    to_typed_text,
    to_xml,
    tytx_equivalent,
)

DATASET = build_dataset()


def _measure(fn, *args, **kwargs):
    start = time.perf_counter()
    result = fn(*args, **kwargs)
    duration = time.perf_counter() - start
    return result, duration


def _size_of(data: Any) -> int:
    if isinstance(data, str):
        return len(data.encode("utf-8"))
    if isinstance(data, bytes):
        return len(data)
    return 0


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_json_roundtrip(payload: Any, capsys):
    encoded, t_enc = _measure(to_typed_text, payload)
    decoded, t_dec = _measure(from_text, encoded)
    assert tytx_equivalent(payload, decoded)
    print(f"[json] size={_size_of(encoded)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_json_prefix_roundtrip(payload: Any, capsys):
    encoded, t_enc = _measure(to_typed_json, payload)
    decoded, t_dec = _measure(from_json, encoded)
    assert tytx_equivalent(payload, decoded)
    print(f"[json+prefix] size={_size_of(encoded)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_xml_roundtrip(payload: Any, capsys):
    wrapped = {"root": {"attrs": {}, "value": payload}}
    encoded, t_enc = _measure(to_xml, wrapped, declaration=False)
    decoded, t_dec = _measure(from_xml, encoded)
    assert tytx_equivalent(wrapped, decoded)
    print(f"[xml] size={_size_of(encoded)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_msgpack_roundtrip(payload: Any, capsys):
    msgpack = pytest.importorskip("msgpack")
    encoded, t_enc = _measure(to_msgpack, payload)
    decoded, t_dec = _measure(from_msgpack, encoded)
    assert tytx_equivalent(payload, decoded)
    print(f"[msgpack] size={_size_of(encoded)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_http_roundtrip_json(payload: Any, capsys):
    body, t_enc = _measure(encode_body, payload, "json")
    headers = make_headers("json", tytx=True, accept=True)
    assert headers["Content-Type"] == MIME_TYTX_JSON
    decoded, t_dec = _measure(decode_body, body, MIME_TYTX_JSON)
    assert tytx_equivalent(payload, decoded)
    print(f"[http/json] size={_size_of(body)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_http_roundtrip_xml(payload: Any, capsys):
    body, t_enc = _measure(encode_body, {"root": {"attrs": {}, "value": payload}}, "xml")
    headers = make_headers("xml", tytx=True, accept=True)
    assert headers["Content-Type"] == MIME_TYTX_XML
    decoded, t_dec = _measure(decode_body, body, MIME_TYTX_XML)
    # decode_body(xml) returns wrapped structure
    expected = {"root": {"attrs": {}, "value": payload}}
    assert tytx_equivalent(expected, decoded)
    print(f"[http/xml] size={_size_of(body)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


@pytest.mark.parametrize("payload", DATASET["payloads"])
def test_http_roundtrip_msgpack(payload: Any, capsys):
    pytest.importorskip("msgpack")
    body, t_enc = _measure(encode_body, payload, "msgpack")
    headers = make_headers("msgpack", tytx=True, accept=True)
    assert headers["Content-Type"] == MIME_TYTX_MSGPACK
    decoded, t_dec = _measure(decode_body, body, MIME_TYTX_MSGPACK)
    assert tytx_equivalent(payload, decoded)
    print(f"[http/msgpack] size={_size_of(body)}B enc={t_enc:.6f}s dec={t_dec:.6f}s", file=sys.stderr)


def test_performance_snapshot_heavy_recordset(capsys):
    payload = {"records": DATASET["recordset"]}
    encoded_json, t_enc_json = _measure(to_typed_text, payload)
    decoded_json, t_dec_json = _measure(from_text, encoded_json)
    assert tytx_equivalent(payload, decoded_json)

    encoded_msgpack, t_enc_mp = None, None
    decoded_msgpack, t_dec_mp = None, None
    try:
        encoded_msgpack, t_enc_mp = _measure(to_msgpack, payload)
        decoded_msgpack, t_dec_mp = _measure(from_msgpack, encoded_msgpack)
        assert tytx_equivalent(payload, decoded_msgpack)
    except ImportError:
        # msgpack optional
        pass

    print(
        f"[heavy] json size={_size_of(encoded_json)}B enc={t_enc_json:.6f}s dec={t_dec_json:.6f}s",
        file=sys.stderr,
    )
    if encoded_msgpack is not None:
        print(
            f"[heavy] msgpack size={_size_of(encoded_msgpack)}B enc={t_enc_mp:.6f}s dec={t_dec_mp:.6f}s",
            file=sys.stderr,
        )

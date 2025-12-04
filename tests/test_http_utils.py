from __future__ import annotations

import json
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest

from genro_tytx.http_utils import (
    build_xtytx_envelope,
    fetch_typed,
    fetch_typed_request,
    fetch_xtytx,
    _hydrate_response,
    _prepare_body,
    detect_expect,
)
from genro_tytx.json_utils import as_typed_json
from genro_tytx.xtytx import XtytxResult

# Check if msgpack is available (without importing genro_tytx.msgpack_utils)
try:
    import msgpack  # noqa: F401

    HAS_MSGPACK = True
except ImportError:
    HAS_MSGPACK = False


class FakeResponse:
    def __init__(self, body: bytes, headers: dict[str, str] | None = None) -> None:
        self._body = body
        self.headers = headers or {}

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # type: ignore[override]
        return None


def test_fetch_typed_hydrates_json(monkeypatch: pytest.MonkeyPatch) -> None:
    body = as_typed_json({"price": Decimal("10.5")}).encode("utf-8")
    responses: list[Any] = [FakeResponse(body, {"Content-Type": "application/json"})]

    def fake_urlopen(req, timeout=None):  # type: ignore[override]
        return responses.pop(0)

    monkeypatch.setattr("genro_tytx.http_utils.urlopen", fake_urlopen)

    result = fetch_typed("http://example.com", method="GET")
    assert result["price"] == Decimal("10.5")


@pytest.mark.skipif(not HAS_MSGPACK, reason="msgpack not installed")
def test_fetch_typed_request_msgpack(monkeypatch: pytest.MonkeyPatch) -> None:
    from genro_tytx.msgpack_utils import packb

    captured = SimpleNamespace(request=None)
    response_body = packb({"ok": True})

    def fake_urlopen(req, timeout=None):  # type: ignore[override]
        captured.request = req
        return FakeResponse(response_body, {"Content-Type": "application/x-msgpack"})

    monkeypatch.setattr("genro_tytx.http_utils.urlopen", fake_urlopen)

    result = fetch_typed_request(
        "http://example.com", body={"value": Decimal("2.0")}, send_as="msgpack"
    )
    assert result["ok"] is True
    assert captured.request is not None
    headers = {k.lower(): v for k, v in captured.request.headers.items()}
    assert headers["x-tytx-request"] == "msgpack"
    assert headers["content-type"] == "application/x-msgpack"
    assert captured.request.data  # payload was serialized


def test_detect_expect_fallbacks_and_xtytx():
    assert detect_expect(None) == "text"
    assert detect_expect("application/xtytx") == "xtytx"
    assert detect_expect("application/xml") == "xml"
    assert detect_expect("application/msgpack") == "msgpack"
    assert detect_expect("text/plain") == "text"


def test_hydrate_response_xtytx_and_xml(monkeypatch: pytest.MonkeyPatch) -> None:
    # XTYTX path
    envelope = 'XTYTX://{"gstruct":{},"lstruct":{},"gschema":{},"lschema":{},"data":"{\\"x\\":\\"1::L\\"}"}'
    res = _hydrate_response("application/xtytx", envelope.encode("utf-8"), "xtytx")
    assert hasattr(res, "data") and res.data["x"] == 1
    # XML path
    xml_body = b"<root><a>1::L</a></root>"
    result = _hydrate_response("application/xml", xml_body, None)
    assert result["root"]["value"]["a"]["value"] == 1
    # plain typed text path
    plain = _hydrate_response("text/plain", b"5::L", None)
    assert plain == 5


def test_prepare_body_defaults():
    headers = {}
    payload = _prepare_body(body="hi", send_as="text", headers=headers)
    assert headers["Content-Type"] == "text/plain"
    assert headers["X-TYTX-Request"] == "text"
    assert payload.decode() == "hi"


def test_prepare_body_json_and_with_params():
    headers = {}
    payload = _prepare_body(body={"a": 1}, send_as="json", headers=headers)
    assert headers["Content-Type"] == "application/json"
    assert headers["X-TYTX-Request"] == "json"
    assert payload
    url = "http://example.com"
    from genro_tytx.http_utils import _with_params

    new_url = _with_params(url, {"q": "v"})
    assert "q=v" in new_url


def test_fetch_typed_bad_status(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResp:
        def __init__(self):
            self.headers = {"Content-Type": "text/plain"}
            self.status = 500
            self.body = b"error"

        def read(self):
            return self.body

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(req, timeout=None):
        raise Exception("boom")

    monkeypatch.setattr("genro_tytx.http_utils.urlopen", fake_urlopen)
    with pytest.raises(Exception):
        fetch_typed("http://example.com")


def test_fetch_typed_request_xtytx(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {}

    def fake_fetch_xtytx(url, **kwargs):
        called["url"] = url
        called["payload"] = kwargs["payload"]
        return {"ok": True}

    monkeypatch.setattr("genro_tytx.http_utils.fetch_xtytx", fake_fetch_xtytx)
    res = fetch_typed_request("http://example.com", body={"x": 1}, xtytx=True)
    assert res["ok"] is True
    assert called["payload"] == {"x": 1}


def test_build_xtytx_envelope_prefix_and_data() -> None:
    envelope_str = build_xtytx_envelope(
        payload={"a": Decimal("1.0")}, gstruct={"A": {"a": "N"}}
    )
    assert envelope_str.startswith("XTYTX://")
    payload_json = envelope_str.removeprefix("XTYTX://")
    parsed = json.loads(payload_json)
    assert parsed["gstruct"] == {"A": {"a": "N"}}
    assert parsed["data"] == as_typed_json({"a": Decimal("1.0")})


def test_fetch_xtytx_returns_result(monkeypatch: pytest.MonkeyPatch) -> None:
    envelope = {
        "gstruct": {},
        "lstruct": {},
        "gschema": {},
        "lschema": {},
        "data": as_typed_json({"total": Decimal("3.5")}),
    }
    response_text = f"XTYTX://{json.dumps(envelope)}".encode()
    responses: list[Any] = [
        FakeResponse(response_text, {"Content-Type": "application/json"})
    ]

    def fake_urlopen(req, timeout=None):  # type: ignore[override]
        return responses.pop(0)

    monkeypatch.setattr("genro_tytx.http_utils.urlopen", fake_urlopen)

    result = fetch_xtytx("http://example.com", payload={"hello": "world"})
    assert isinstance(result, XtytxResult)
    assert result.data["total"] == Decimal("3.5")

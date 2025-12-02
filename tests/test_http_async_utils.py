from __future__ import annotations

import asyncio
from decimal import Decimal

import pytest

from genro_tytx.http_async_utils import fetch_typed_async, fetch_typed_request_async
from genro_tytx.http_utils import fetch_typed


def test_fetch_typed_async_uses_thread(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {}

    def fake_fetch(url: str, **_kwargs):
        called["url"] = url
        return {"price": Decimal("1.0")}

    monkeypatch.setattr("genro_tytx.http_async_utils.fetch_typed", fake_fetch)

    result = asyncio.run(fetch_typed_async("http://example.com"))
    assert result["price"] == Decimal("1.0")
    assert called["url"] == "http://example.com"


def test_fetch_typed_request_async_delegates_xtytx(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {}

    async def fake_xt(url: str, **_kwargs):
        called["url"] = url
        return {"ok": True}

    monkeypatch.setattr("genro_tytx.http_async_utils.fetch_xtytx_async", fake_xt)

    result = asyncio.run(
        fetch_typed_request_async("http://example.com", body={"x": 1}, xtytx=True, send_as="json")
    )
    assert result["ok"] is True
    assert called["url"] == "http://example.com"


def test_fetch_typed_request_async_text(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {}

    def fake_sync(url: str, **kwargs):
        called["url"] = url
        return 5

    monkeypatch.setattr("genro_tytx.http_async_utils.fetch_typed_request", fake_sync)

    result = asyncio.run(
        fetch_typed_request_async("http://example.com", body=5, send_as="text", expect="text")
    )
    assert result == 5
    assert called["url"] == "http://example.com"

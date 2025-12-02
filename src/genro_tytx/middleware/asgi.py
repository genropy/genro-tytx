"""
ASGI middleware for hydrating TYTX/XTYTX requests.

- Detects incoming content via Content-Type or X-TYTX-Request header.
- Hydrates the body using from_json/from_text/unpackb/from_xml (or XTYTX envelope).
- Stores hydrated data in scope[store_key] (default: "tytx.data") and the raw body in scope["tytx.raw_body"].
- Replays the original body to the downstream ASGI app.

This middleware does not auto-serialize responses; it is read-only for requests.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from ..json_utils import from_json
from ..msgpack_utils import unpackb
from ..xml_utils import from_xml

Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]
Scope = dict[str, Any]


def _hydrate_body(body: bytes, req_type: str | None, content_type: str | None) -> Any:
    if not body:
        return None

    ct = (content_type or "").lower()
    kind = (req_type or "").lower()

    if kind == "msgpack" or "msgpack" in ct or "application/x-msgpack" in ct:
        return unpackb(body)

    if kind == "xml" or "xml" in ct:
        return from_xml(body.decode("utf-8"))

    # XTYTX or JSON (default)
    text = body.decode("utf-8")
    return from_json(text)


class TytxASGIMiddleware:
    """ASGI middleware to hydrate TYTX/XTYTX request bodies."""

    def __init__(
        self,
        app: Callable[[Scope, Receive, Send], Awaitable[None]],
        *,
        store_key: str = "tytx.data",
        header_name: str = "x-tytx-request",
    ) -> None:
        self.app = app
        self.store_key = store_key
        self.header_name = header_name.lower()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        # Read full body
        body_chunks: list[bytes] = []
        more_body = True
        req_type: str | None = None
        content_type: str | None = None

        # Extract headers
        headers: dict[bytes, bytes] = dict(scope.get("headers") or [])
        if b"content-type" in headers:
            content_type = headers[b"content-type"].decode("latin-1")
        if self.header_name.encode("latin-1") in headers:
            req_type = headers[self.header_name.encode("latin-1")].decode("latin-1")

        while more_body:
            message = await receive()
            body_chunks.append(message.get("body", b""))
            more_body = message.get("more_body", False)

        body = b"".join(body_chunks)
        scope["tytx.raw_body"] = body
        try:
            scope[self.store_key] = _hydrate_body(body, req_type, content_type)
        except Exception:
            # Do not break the app; leave raw body if hydration fails
            scope[self.store_key] = None

        consumed = False

        async def replay_receive() -> dict[str, Any]:
            nonlocal consumed
            if consumed:
                return {"type": "http.request", "body": b"", "more_body": False}
            consumed = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay_receive, send)


__all__ = ["TytxASGIMiddleware"]

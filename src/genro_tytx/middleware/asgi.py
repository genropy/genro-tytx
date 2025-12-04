"""
ASGI middleware for hydrating TYTX/XTYTX requests.

- Detects incoming content via Content-Type or X-TYTX-Request header.
- Hydrates the body using from_json/from_text/unpackb/from_xml (or XTYTX envelope).
- Stores hydrated data in scope[store_key] (default: "tytx.data") and the raw body in scope["tytx.raw_body"].
- Stores detected mode in scope["tytx.mode"] ("json", "tytx", "xtytx", "msgpack", "xml", or None).
- Optionally hydrates query params and stores in scope["tytx.query"].
- Replays the original body to the downstream ASGI app.

This middleware does not auto-serialize responses; it is read-only for requests.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import parse_qs

from ..json_utils import detect_tytx_mode, from_json
from ..msgpack_utils import unpackb
from ..registry import registry
from ..xml_utils import from_xml

Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]
Scope = dict[str, Any]


def _hydrate_body(
    body: bytes, req_type: str | None, content_type: str | None
) -> tuple[Any, str | None]:
    """Hydrate body and return (data, mode) tuple."""
    if not body:
        return None, None

    ct = (content_type or "").lower()
    kind = (req_type or "").lower()

    if kind == "msgpack" or "msgpack" in ct or "application/x-msgpack" in ct:
        return unpackb(body), "msgpack"

    if kind == "xml" or "xml" in ct:
        return from_xml(body.decode("utf-8")), "xml"

    # XTYTX, TYTX, or JSON (default)
    text = body.decode("utf-8")
    mode = detect_tytx_mode(text)
    if mode is None:
        mode = "json"
    return from_json(text), mode


def _hydrate_query_params(query_string: bytes) -> dict[str, Any]:
    """
    Parse and hydrate query string parameters with TYTX types.

    Values with ::TYPE suffix are hydrated to their Python types.
    Multi-value params are returned as lists.

    Args:
        query_string: Raw query string bytes from scope.

    Returns:
        Dict with hydrated values. Single values are unwrapped,
        multi-values remain as lists.
    """
    if not query_string:
        return {}

    parsed = parse_qs(query_string.decode("utf-8"), keep_blank_values=True)
    result: dict[str, Any] = {}

    for key, values in parsed.items():
        hydrated = [registry.from_text(v) for v in values]
        # Unwrap single values
        result[key] = hydrated[0] if len(hydrated) == 1 else hydrated

    return result


class TytxASGIMiddleware:
    """
    ASGI middleware to hydrate TYTX/XTYTX request bodies.

    Args:
        app: The ASGI application to wrap.
        store_key: Key to store hydrated data in scope (default: "tytx.data").
        header_name: Header name for TYTX request type (default: "x-tytx-request").
        hydrate_query: If True, hydrate query params and store in scope["tytx.query"].

    Scope keys set by middleware:
        - scope[store_key]: Hydrated body data (or None if hydration fails).
        - scope["tytx.raw_body"]: Original raw body bytes.
        - scope["tytx.mode"]: Detected mode ("json", "tytx", "xtytx", "msgpack", "xml", or None).
        - scope["tytx.query"]: Hydrated query params (only if hydrate_query=True).
    """

    def __init__(
        self,
        app: Callable[[Scope, Receive, Send], Awaitable[None]],
        *,
        store_key: str = "tytx.data",
        header_name: str = "x-tytx-request",
        hydrate_query: bool = False,
    ) -> None:
        self.app = app
        self.store_key = store_key
        self.header_name = header_name.lower()
        self.hydrate_query = hydrate_query

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

        # Hydrate body and detect mode
        try:
            data, mode = _hydrate_body(body, req_type, content_type)
            scope[self.store_key] = data
            scope["tytx.mode"] = mode
        except Exception:
            # Do not break the app; leave raw body if hydration fails
            scope[self.store_key] = None
            scope["tytx.mode"] = None

        # Hydrate query params if enabled
        if self.hydrate_query:
            try:
                scope["tytx.query"] = _hydrate_query_params(
                    scope.get("query_string", b"")
                )
            except Exception:
                scope["tytx.query"] = {}

        consumed = False

        async def replay_receive() -> dict[str, Any]:
            nonlocal consumed
            if consumed:
                return {"type": "http.request", "body": b"", "more_body": False}
            consumed = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay_receive, send)


__all__ = ["TytxASGIMiddleware"]

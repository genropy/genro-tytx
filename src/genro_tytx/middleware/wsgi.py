"""
WSGI middleware for hydrating TYTX/XTYTX requests.

- Detects incoming content via Content-Type or X-TYTX-Request header.
- Hydrates the body using from_json/from_text/unpackb/from_xml (or XTYTX envelope).
- Stores hydrated data in environ[store_key] (default: "tytx.data") and raw body in environ["tytx.raw_body"].
- Re-injects the original body into wsgi.input for downstream apps.
"""

from __future__ import annotations

import io
from collections.abc import Callable
from typing import Any

from ..json_utils import from_json
from ..msgpack_utils import unpackb
from ..xml_utils import from_xml


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


class TytxWSGIMiddleware:
    """WSGI middleware to hydrate TYTX/XTYTX request bodies."""

    def __init__(
        self,
        app: Callable,
        *,
        store_key: str = "tytx.data",
        header_name: str = "HTTP_X_TYTX_REQUEST",
    ) -> None:
        self.app = app
        self.store_key = store_key
        self.header_name = header_name

    def __call__(self, environ: dict[str, Any], start_response: Callable) -> Any:
        # Read body
        content_length = environ.get("CONTENT_LENGTH")
        try:
            length = int(content_length) if content_length else 0
        except (TypeError, ValueError):
            length = 0

        body = environ["wsgi.input"].read(length) if length > 0 else b""
        environ["tytx.raw_body"] = body

        content_type = environ.get("CONTENT_TYPE")
        req_type = environ.get(self.header_name)

        try:
            environ[self.store_key] = _hydrate_body(body, req_type, content_type)
        except Exception:
            environ[self.store_key] = None

        # Replay body to downstream app
        environ["wsgi.input"] = io.BytesIO(body)
        return self.app(environ, start_response)


__all__ = ["TytxWSGIMiddleware"]

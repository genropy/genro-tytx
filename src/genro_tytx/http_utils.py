# Copyright 2025 Softwell S.r.l.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Minimal fetch-style helpers for Python clients.

These helpers mirror the JS/TS wrappers:
- fetch_typed: hydrate responses (json/text/xml/msgpack/XTYTX)
- fetch_typed_request: serialize a payload (send_as: json/text/msgpack) or XTYTX envelope
- fetch_xtytx: convenience wrapper that always sends XTYTX
- build_xtytx_envelope: build XTYTX envelope string (with XTYTX:// prefix)

Implementation uses urllib from the standard library to avoid extra dependencies.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

from .json_utils import _hydrate_json, as_typed_json, from_json
from .msgpack_utils import packb, unpackb
from .registry import registry
from .xml_utils import from_xml
from .xtytx import XtytxResult, process_envelope

JsonLike = Mapping[str, Any] | None

XTYTX_PREFIX = "XTYTX://"
TYTX_PREFIX = "TYTX://"


def detect_expect(content_type: str | None) -> str:
    """Infer expected format from a Content-Type header."""
    if not content_type:
        return "text"
    ct = content_type.lower()
    if "xtytx" in ct:
        return "xtytx"
    if "json" in ct:
        return "json"
    if "xml" in ct:
        return "xml"
    if "msgpack" in ct or "application/x-msgpack" in ct:
        return "msgpack"
    return "text"


def build_xtytx_envelope(
    *,
    payload: Any,
    gstruct: JsonLike = None,
    lstruct: JsonLike = None,
    gschema: JsonLike = None,
    lschema: JsonLike = None,
) -> str:
    """
    Build an XTYTX envelope string (prefixed with XTYTX://).

    Args:
        payload: Data to send. Strings are used as-is; other objects are serialized with
            `as_typed_json`.
        gstruct: Global struct definitions.
        lstruct: Local struct definitions.
        gschema: Global JSON Schema definitions.
        lschema: Local JSON Schema definitions.
    """
    typed_data = payload if isinstance(payload, str) else as_typed_json(payload)

    envelope = {
        "gstruct": gstruct or {},
        "lstruct": lstruct or {},
        "gschema": gschema or {},
        "lschema": lschema or {},
        "data": typed_data,
    }
    return f"{XTYTX_PREFIX}{json.dumps(envelope)}"


def _prepare_body(
    *,
    body: Any,
    send_as: str,
    headers: dict[str, str],
) -> bytes:
    """
    Serialize body according to send_as and update headers in place.
    """
    if send_as == "msgpack":
        headers["Content-Type"] = "application/x-msgpack"
        headers["X-TYTX-Request"] = "msgpack"
        return packb(body)
    if send_as == "json":
        headers["Content-Type"] = "application/json"
        headers["X-TYTX-Request"] = "json"
        return as_typed_json(body).encode("utf-8")

    # Default: typed text
    headers["Content-Type"] = "text/plain"
    headers["X-TYTX-Request"] = "text"
    return registry.as_typed_text(body).encode("utf-8")


def _hydrate_response(content_type: str | None, raw: bytes, expect: str | None = None) -> Any:
    """
    Hydrate a response payload using TYTX utilities.
    """
    chosen = expect or detect_expect(content_type)

    if chosen == "msgpack":
        return unpackb(raw)

    text = raw.decode("utf-8")

    if chosen == "xtytx" or text.startswith(XTYTX_PREFIX):
        envelope_json = text.removeprefix(XTYTX_PREFIX)
        envelope = json.loads(envelope_json)
        result: XtytxResult = process_envelope(envelope, _hydrate_json, TYTX_PREFIX)
        return result

    if chosen == "json":
        return from_json(text)
    if chosen == "xml":
        return from_xml(text)
    return registry.from_text(text)


def _with_params(url: str, params: Mapping[str, Any] | None) -> str:
    if not params:
        return url
    parsed = urlparse(url)
    query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=query))


def fetch_typed(
    url: str,
    *,
    method: str = "GET",
    headers: Mapping[str, str] | None = None,
    data: bytes | None = None,
    expect: str | None = None,
    timeout: float | None = None,
) -> Any:
    """
    Perform an HTTP request and hydrate the response according to TYTX rules.

    Raises:
        HTTPError: For non-2xx responses.
    """
    req = Request(url, data=data, headers=dict(headers or {}), method=method)
    with urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get("Content-Type") if hasattr(resp.headers, "get") else None
        raw = resp.read()
    return _hydrate_response(content_type, raw, expect)


def fetch_xtytx(
    url: str,
    *,
    payload: Any,
    method: str = "POST",
    headers: Mapping[str, str] | None = None,
    gstruct: JsonLike = None,
    lstruct: JsonLike = None,
    gschema: JsonLike = None,
    lschema: JsonLike = None,
    expect: str | None = "xtytx",
    timeout: float | None = None,
) -> Any:
    """
    Send an XTYTX envelope and hydrate the response.
    """
    envelope = build_xtytx_envelope(
        payload=payload,
        gstruct=gstruct,
        lstruct=lstruct,
        gschema=gschema,
        lschema=lschema,
    )
    hdrs = {
        "Content-Type": "application/json",
        "X-TYTX-Request": "xtytx",
        **(headers or {}),
    }
    return fetch_typed(
        url,
        method=method,
        headers=hdrs,
        data=envelope.encode("utf-8"),
        expect=expect,
        timeout=timeout,
    )


def fetch_typed_request(
    url: str,
    *,
    body: Any = None,
    send_as: str = "json",
    xtytx: bool = False,
    method: str = "POST",
    headers: Mapping[str, str] | None = None,
    params: Mapping[str, Any] | None = None,
    expect: str | None = None,
    timeout: float | None = None,
) -> Any:
    """
    Serialize a payload (json/text/msgpack) or XTYTX envelope, send it, and hydrate the response.
    """
    if xtytx:
        return fetch_xtytx(
            url,
            payload=body,
            method=method,
            headers=headers,
            expect=expect or "xtytx",
            timeout=timeout,
        )

    hdrs = dict(headers or {})
    serialized = _prepare_body(body=body, send_as=send_as, headers=hdrs)
    target = _with_params(url, params)
    return fetch_typed(
        target,
        method=method,
        headers=hdrs,
        data=serialized,
        expect=expect,
        timeout=timeout,
    )


__all__ = [
    "fetch_typed",
    "fetch_typed_request",
    "fetch_xtytx",
    "build_xtytx_envelope",
    "detect_expect",
]

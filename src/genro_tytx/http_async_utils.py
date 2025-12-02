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
Async wrappers for the HTTP helpers.

These functions mirror the sync API in http_utils, but run via asyncio.to_thread
so they can be awaited without adding extra dependencies.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from .http_utils import (
    build_xtytx_envelope,
    fetch_typed,
    fetch_typed_request,
    fetch_xtytx,
)


async def fetch_typed_async(*args: Any, **kwargs: Any) -> Any:
    """Async wrapper around fetch_typed (runs in a thread)."""
    return await asyncio.to_thread(fetch_typed, *args, **kwargs)


async def fetch_xtytx_async(*args: Any, **kwargs: Any) -> Any:
    """Async wrapper around fetch_xtytx (runs in a thread)."""
    return await asyncio.to_thread(fetch_xtytx, *args, **kwargs)


async def fetch_typed_request_async(
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
    gstruct: Mapping[str, Any] | None = None,
    lstruct: Mapping[str, Any] | None = None,
    gschema: Mapping[str, Any] | None = None,
    lschema: Mapping[str, Any] | None = None,
) -> Any:
    """
    Async wrapper around fetch_typed_request (runs in a thread).

    Parameters mirror the sync variant. The envelope builders are still
    available (build_xtytx_envelope) if you need to precompute the body.
    """
    if xtytx:
        return await fetch_xtytx_async(
            url,
            payload=body,
            method=method,
            headers=headers,
            gstruct=gstruct,
            lstruct=lstruct,
            gschema=gschema,
            lschema=lschema,
            expect=expect or "xtytx",
            timeout=timeout,
        )

    return await asyncio.to_thread(
        fetch_typed_request,
        url,
        body=body,
        send_as=send_as,
        xtytx=xtytx,
        method=method,
        headers=headers,
        params=params,
        expect=expect,
        timeout=timeout,
    )


__all__ = [
    "fetch_typed_async",
    "fetch_typed_request_async",
    "fetch_xtytx_async",
    "build_xtytx_envelope",
]

# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
ASGI Test Server for TYTX End-to-End Testing.

Runs a simple ASGI server with manual TYTX decoding for integration tests.
"""

import json
import asyncio
from datetime import date, datetime, time, timezone
from decimal import Decimal

from genro_tytx import asgi_data, to_tytx


async def app(scope, receive, send):
    """Simple ASGI app that echoes back typed data."""
    if scope["type"] != "http":
        return

    path = scope.get("path", "/")
    
    async def _send_json(data, status=200):
        """Send JSON response."""
        body = to_tytx(data).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })

    def _serialize_for_json(value):
        """Convert Python types to JSON-serializable format for echo."""
        if isinstance(value, Decimal):
            return {"_type": "Decimal", "value": str(value)}
        if isinstance(value, datetime):
            return {"_type": "datetime", "value": value.isoformat()}
        if isinstance(value, date):
            return {"_type": "date", "value": value.isoformat()}
        if isinstance(value, time):
            return {"_type": "time", "value": value.isoformat()}
        if isinstance(value, dict):
            return {k: _serialize_for_json(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_serialize_for_json(v) for v in value]
        return value

    # Decode request data using TYTX
    # asgi_data consumes the body, so we don't need to read it manually
    try:
        tytx = await asgi_data(scope, receive)
    except Exception as e:
        await _send_json({"error": str(e)}, status=400)
        return

    if path == "/echo":
        # Echo back all received data
        response_data = {
            "query": _serialize_for_json(tytx.get("query", {})),
            "headers": _serialize_for_json(tytx.get("headers", {})),
            "cookies": _serialize_for_json(tytx.get("cookies", {})),
            "body": _serialize_for_json(tytx.get("body")),
        }
        await _send_json(response_data)

    elif path == "/types":
        # Return various typed values
        response_data = {
            "decimal": Decimal("123.456"),
            "date": date(2025, 6, 15),
            "datetime": datetime(2025, 6, 15, 10, 30, 0, tzinfo=timezone.utc),
            "time": time(14, 45, 30),
            "string": "hello",
            "integer": 42,
            "boolean": True,
            "null": None,
        }
        await _send_json(response_data)

    elif path == "/compute":
        # Compute with received values
        body_data = tytx.get("body") or {}
        price = body_data.get("price", Decimal("0"))
        quantity = body_data.get("quantity", 0)
        tax_rate = body_data.get("tax_rate", Decimal("0.22"))

        subtotal = price * quantity
        tax = subtotal * tax_rate
        total = subtotal + tax

        response_data = {
            "subtotal": subtotal,
            "tax": tax,
            "total": total,
            "computed_at": datetime.now(timezone.utc),
        }
        await _send_json(response_data)

    elif path == "/health":
        await _send_json({"status": "ok"})

    else:
        await _send_json({"error": "not found"}, status=404)


async def run_server(host="127.0.0.1", port=8765):
    """Run the ASGI server using uvicorn."""
    import uvicorn
    # Use the app directly
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    print("Starting ASGI test server on http://127.0.0.1:8765")
    asyncio.run(run_server())

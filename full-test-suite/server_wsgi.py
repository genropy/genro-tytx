# Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
"""
WSGI Test Server for TYTX End-to-End Testing.

Runs a simple WSGI server with TYTXWSGIMiddleware for integration tests.
"""

import json
from datetime import date, datetime, time, timezone
from decimal import Decimal
from wsgiref.simple_server import make_server

from genro_tytx import TYTXWSGIMiddleware, to_typed_text


def app(environ, start_response):
    """Simple WSGI app that echoes back typed data."""
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")

    # Get decoded data from middleware
    tytx = environ.get("tytx", {})

    if path == "/echo":
        # Echo back all received data
        response_data = {
            "query": _serialize_for_json(tytx.get("query", {})),
            "headers": _serialize_for_json(tytx.get("headers", {})),
            "cookies": _serialize_for_json(tytx.get("cookies", {})),
            "body": _serialize_for_json(tytx.get("body")),
        }
        return _send_json(start_response, response_data)

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
        return _send_json(start_response, response_data)

    elif path == "/compute":
        # Compute with received values
        body_data = tytx.get("body", {})
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
        return _send_json(start_response, response_data)

    elif path == "/health":
        return _send_json(start_response, {"status": "ok"})

    else:
        return _send_json(start_response, {"error": "not found"}, status="404 Not Found")


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


def _send_json(start_response, data, status="200 OK"):
    """Send JSON response."""
    body = to_typed_text(data).encode("utf-8")
    headers = [
        ("Content-Type", "application/json"),
        ("Content-Length", str(len(body))),
    ]
    start_response(status, headers)
    return [body]


# Wrap with middleware
application = TYTXWSGIMiddleware(app)


def run_server(host="127.0.0.1", port=8766):
    """Run the WSGI server."""
    print(f"Starting WSGI test server on http://{host}:{port}")
    server = make_server(host, port, application)
    server.serve_forever()


if __name__ == "__main__":
    run_server()

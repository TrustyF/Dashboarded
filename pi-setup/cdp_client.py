"""Minimal Chrome DevTools Protocol client - shared by reload-dashboard.py and
hide-cursor.py so neither hand-rolls its own copy of the WebSocket handshake.

No third-party dependencies on purpose (see reload-dashboard.py's docstring) -
installed alongside the scripts that import it in /usr/local/bin/, which
Python already puts on sys.path as "the running script's own directory".
"""

import base64
import json
import os
import socket
import struct
import urllib.request
from urllib.parse import urlparse

CDP_HOST = "127.0.0.1"
CDP_PORT = 9222


def find_target(url_prefix: str):
    url = f"http://{CDP_HOST}:{CDP_PORT}/json"
    with urllib.request.urlopen(url, timeout=5) as resp:
        targets = json.load(resp)
    for target in targets:
        if target.get("type") == "page" and target.get("url", "").startswith(url_prefix):
            return target
    return None


def send_command(ws_url: str, method: str, params: dict | None = None) -> None:
    parsed = urlparse(ws_url)
    host, port, path = parsed.hostname, parsed.port or 80, parsed.path

    sock = socket.create_connection((host, port), timeout=5)
    try:
        key = base64.b64encode(os.urandom(16)).decode()
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        sock.sendall(handshake.encode())
        response = sock.recv(4096)
        status_line = response.split(b"\r\n", 1)[0]
        if b"101" not in status_line:
            raise RuntimeError(f"CDP WebSocket handshake failed: {status_line!r}")

        payload = json.dumps({"id": 1, "method": method, "params": params or {}}).encode()
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))

        frame = bytearray([0x81])  # FIN + text frame opcode
        length = len(masked)
        if length < 126:
            frame.append(0x80 | length)
        else:
            frame.append(0x80 | 126)
            frame += struct.pack(">H", length)
        frame += mask + masked

        sock.sendall(bytes(frame))
    finally:
        sock.close()

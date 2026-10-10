"""In-process WebSocket hub for real-time notifications.

Route handlers are sync (run in a threadpool), so `push()` hands messages to the
event loop with run_coroutine_threadsafe. For multiple server instances, swap this
for Redis pub/sub.
"""
import asyncio
from collections import defaultdict

from fastapi import WebSocket


class NotificationHub:
    def __init__(self):
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.loop = asyncio.get_running_loop()
        self.connections[user_id].add(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        self.connections[user_id].discard(ws)

    async def _send(self, user_id: int, payload: dict):
        for ws in list(self.connections.get(user_id, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(user_id, ws)

    def push(self, user_id: int, payload: dict):
        if not self.connections.get(user_id) or not self.loop or self.loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self.loop:
            self.loop.create_task(self._send(user_id, payload))
        else:
            asyncio.run_coroutine_threadsafe(self._send(user_id, payload), self.loop)


hub = NotificationHub()

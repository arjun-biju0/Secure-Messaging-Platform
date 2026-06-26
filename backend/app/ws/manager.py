"""
WebSocket connection manager.

Design:
- Each authenticated user may have multiple active WebSocket
  connections (e.g. multiple browser tabs). We keep a set per user_id.
- All real-time events (new message, typing, presence, receipts, group
  updates) are broadcast as JSON envelopes: {"type": ..., "payload": ...}
- Broadcasting to a "conversation" is done by looking up that
  conversation's participant user_ids (via the DB) and pushing to each
  of their connected sockets, if any.
"""
import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        conns = self.active_connections.get(user_id)
        if conns and websocket in conns:
            conns.remove(websocket)
        if conns is not None and len(conns) == 0:
            self.active_connections.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_to_user(self, user_id: int, message: dict):
        conns = self.active_connections.get(user_id)
        if not conns:
            return
        dead = []
        payload = json.dumps(message, default=str)
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.discard(ws)

    async def send_to_users(self, user_ids, message: dict):
        for uid in user_ids:
            await self.send_to_user(uid, message)


manager = ConnectionManager()

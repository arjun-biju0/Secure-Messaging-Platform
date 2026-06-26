"""
WebSocket router.

Connection: ws://host/ws?token=<jwt>

Client -> Server messages (JSON):
  {"type": "typing:start", "conversation_id": 5}
  {"type": "typing:stop",  "conversation_id": 5}
  {"type": "ping"}

Server -> Client messages (JSON), see app/ws/manager.py callers for the
full list of event types: message:new, message:status, conversation:new,
conversation:updated, conversation:removed, presence:update,
typing:update, pong.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.core.security import decode_access_token
from app.models import User, Conversation, ConversationParticipant
from app.ws.manager import manager

router = APIRouter()

# In-memory typing state: {conversation_id: {user_id: last_seen_ts}}
# Simple and sufficient for a single-process dev/demo deployment.
typing_state: dict[int, dict[int, float]] = {}


def _get_conversation_member_ids(db, conversation_id: int) -> list[int]:
    rows = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.left_at.is_(None),
        )
        .all()
    )
    return [r.user_id for r in rows]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4401)
            return

        await manager.connect(user_id, websocket)

        # Mark online + notify contacts/conversation partners
        user.is_online = True
        user.last_seen_at = datetime.now(timezone.utc)
        db.commit()

        # Figure out who should be told this user just came online: every
        # user sharing a conversation with them.
        my_conversations = (
            select(ConversationParticipant.conversation_id)
            .filter(ConversationParticipant.user_id == user_id, ConversationParticipant.left_at.is_(None))
            .subquery()
        )
        peers = (
            db.query(ConversationParticipant.user_id)
            .filter(
                ConversationParticipant.conversation_id.in_(my_conversations),
                ConversationParticipant.user_id != user_id,
                ConversationParticipant.left_at.is_(None),
            )
            .distinct()
            .all()
        )
        peer_ids = [p[0] for p in peers]
        await manager.send_to_users(
            peer_ids,
            {"type": "presence:update", "payload": {"user_id": user_id, "is_online": True}},
        )

        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type in ("typing:start", "typing:stop"):
                    conversation_id = data.get("conversation_id")
                    if not conversation_id:
                        continue
                    member_ids = _get_conversation_member_ids(db, conversation_id)
                    if user_id not in member_ids:
                        continue
                    is_typing = msg_type == "typing:start"
                    convo_typers = typing_state.setdefault(conversation_id, {})
                    if is_typing:
                        convo_typers[user_id] = datetime.now(timezone.utc).timestamp()
                    else:
                        convo_typers.pop(user_id, None)

                    others = [uid for uid in member_ids if uid != user_id]
                    await manager.send_to_users(
                        others,
                        {
                            "type": "typing:update",
                            "payload": {
                                "conversation_id": conversation_id,
                                "user_id": user_id,
                                "is_typing": is_typing,
                            },
                        },
                    )

                elif msg_type == "message:delivered_ack":
                    # Client confirms it received a message while connected;
                    # used to flip sent -> delivered in near-real-time even
                    # before the recipient opens the thread.
                    message_id = data.get("message_id")
                    conversation_id = data.get("conversation_id")
                    if message_id is None:
                        continue
                    from app.models import Message, MessageStatus, DeliveryState
                    from app.services import serialize_message

                    status_row = (
                        db.query(MessageStatus)
                        .filter(MessageStatus.message_id == message_id, MessageStatus.user_id == user_id)
                        .first()
                    )
                    if status_row and status_row.status == DeliveryState.sent:
                        status_row.status = DeliveryState.delivered
                        db.commit()
                        m = db.query(Message).options(joinedload(Message.statuses)).filter(Message.id == message_id).first()
                        if m and m.sender_id:
                            other_count = max(len(_get_conversation_member_ids(db, m.conversation_id)) - 1, 0)
                            msg_out = serialize_message(db, m, other_count)
                            await manager.send_to_user(
                                m.sender_id,
                                {"type": "message:status", "payload": msg_out.model_dump(mode="json")},
                            )

        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(user_id, websocket)
            # Clear any typing state for this user
            for convo_typers in typing_state.values():
                convo_typers.pop(user_id, None)

            if not manager.is_online(user_id):
                user.is_online = False
                user.last_seen_at = datetime.now(timezone.utc)
                db.commit()
                await manager.send_to_users(
                    peer_ids,
                    {
                        "type": "presence:update",
                        "payload": {
                            "user_id": user_id,
                            "is_online": False,
                            "last_seen_at": user.last_seen_at.isoformat(),
                        },
                    },
                )
    finally:
        db.close()

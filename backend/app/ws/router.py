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

IMPORTANT: each WebSocket connection lives for a long time (minutes to
hours), but a SQLAlchemy session/connection should not. We open a new
short-lived `with SessionLocal() as db:` block for each discrete DB
operation rather than holding one session open for the whole socket
lifetime - otherwise every concurrent connection permanently pins a
pooled connection while it just sits idle in `receive_text()`, and the
pool (5 + 10 overflow by default) exhausts after a handful of tabs/
reconnects, breaking REST requests too (they share the same pool).
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.core.security import decode_access_token
from app.models import User, ConversationParticipant
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


def _get_peer_ids(db, user_id: int) -> list[int]:
    """Every user who shares at least one conversation with `user_id`."""
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
    return [p[0] for p in peers]


def _set_online_status(user_id: int, is_online: bool):
    """Short-lived session: flip is_online, return (existed, last_seen_iso)."""
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False, None
        user.is_online = is_online
        user.last_seen_at = datetime.now(timezone.utc)
        db.commit()
        return True, user.last_seen_at.isoformat()


def _get_peer_ids_short(user_id: int) -> list[int]:
    with SessionLocal() as db:
        return _get_peer_ids(db, user_id)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4401)
        return

    # Short-lived session just to validate the user exists.
    with SessionLocal() as db:
        user_exists = db.query(User.id).filter(User.id == user_id).first() is not None
    if not user_exists:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)

    # Mark online + notify contacts/conversation partners. Each helper
    # below opens and closes its own short-lived session.
    _set_online_status(user_id, True)
    peer_ids = _get_peer_ids_short(user_id)
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
                with SessionLocal() as db:
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
                if message_id is None:
                    continue
                from app.models import Message, MessageStatus, DeliveryState
                from app.services import serialize_message

                with SessionLocal() as db:
                    status_row = (
                        db.query(MessageStatus)
                        .filter(MessageStatus.message_id == message_id, MessageStatus.user_id == user_id)
                        .first()
                    )
                    if status_row and status_row.status == DeliveryState.sent:
                        status_row.status = DeliveryState.delivered
                        db.commit()
                        m = (
                            db.query(Message)
                            .options(joinedload(Message.statuses))
                            .filter(Message.id == message_id)
                            .first()
                        )
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
            existed, last_seen_iso = _set_online_status(user_id, False)
            if existed:
                await manager.send_to_users(
                    peer_ids,
                    {
                        "type": "presence:update",
                        "payload": {
                            "user_id": user_id,
                            "is_online": False,
                            "last_seen_at": last_seen_iso,
                        },
                    },
                )

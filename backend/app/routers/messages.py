"""
Messages router:
- GET  /api/conversations/{id}/messages         paginated history (cursor by message id)
- POST /api/conversations/{id}/messages         send a message (also broadcast over WS)
- POST /api/conversations/{id}/read             mark all up to a message as read
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    User, Conversation, ConversationParticipant, Message, MessageStatus,
    DeliveryState, MessageType,
)
from app.schemas.message import SendMessageIn, MessageOut, MessagePageOut
from app.deps import get_current_user
from app.services import serialize_message
from app.ws.manager import manager

router = APIRouter(prefix="/api/conversations", tags=["messages"])


def _require_participant(db: Session, conversation_id: int, user_id: int) -> ConversationParticipant:
    p = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.left_at.is_(None),
        )
        .first()
    )
    if not p:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")
    return p


@router.get("/{conversation_id}/messages", response_model=MessagePageOut)
def list_messages(
    conversation_id: int,
    before_id: Optional[int] = Query(None, description="Return messages with id < before_id"),
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_participant(db, conversation_id, current_user.id)

    q = (
        db.query(Message)
        .options(joinedload(Message.sender), joinedload(Message.statuses))
        .filter(Message.conversation_id == conversation_id)
    )
    if before_id:
        q = q.filter(Message.id < before_id)
    q = q.order_by(Message.id.desc()).limit(limit + 1)
    rows = q.all()

    has_more = len(rows) > limit
    rows = rows[:limit]
    rows.reverse()  # chronological order for the client

    recipient_count = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.left_at.is_(None),
            ConversationParticipant.user_id != current_user.id,
        )
        .count()
    )

    messages_out = [serialize_message(db, m, recipient_count) for m in rows]
    return MessagePageOut(messages=messages_out, has_more=has_more)


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    conversation_id: int,
    body: SendMessageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_participant(db, conversation_id, current_user.id)

    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        type=MessageType.text,
        content=body.content,
        client_id=body.client_id,
    )
    db.add(message)
    db.flush()

    other_participants = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.left_at.is_(None),
            ConversationParticipant.user_id != current_user.id,
        )
        .all()
    )
    for p in other_participants:
        initial_status = DeliveryState.delivered if manager.is_online(p.user_id) else DeliveryState.sent
        db.add(MessageStatus(message_id=message.id, user_id=p.user_id, status=initial_status))

    convo.last_message_id = message.id
    convo.last_activity_at = message.created_at
    db.commit()
    db.refresh(message)

    recipient_count = len(other_participants)
    msg_out = serialize_message(db, message, recipient_count)

    # Broadcast to all other participants (and echo to the sender's
    # other devices) over the WebSocket.
    all_ids = [p.user_id for p in other_participants] + [current_user.id]
    for uid in all_ids:
        await manager.send_to_user(uid, {"type": "message:new", "payload": msg_out.model_dump(mode="json")})

        # Also push an updated conversation summary so list previews refresh
        from app.services import serialize_conversation
        from app.routers.conversations import _load_conversation
        full = _load_conversation(db, conversation_id)
        view = serialize_conversation(db, full, uid, online_checker=manager.is_online)
        await manager.send_to_user(uid, {"type": "conversation:updated", "payload": view.model_dump(mode="json")})

    return msg_out


@router.post("/{conversation_id}/read")
async def mark_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participant = _require_participant(db, conversation_id, current_user.id)

    latest_message = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .first()
    )
    if not latest_message:
        return {"message": "No messages to mark as read."}

    previous_watermark = participant.last_read_message_id or 0
    participant.last_read_message_id = latest_message.id

    # Update MessageStatus rows for messages sent by others, up to the watermark
    unread_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.id > previous_watermark,
            Message.id <= latest_message.id,
        )
        .all()
    )
    affected_sender_ids = set()
    for m in unread_messages:
        status_row = (
            db.query(MessageStatus)
            .filter(MessageStatus.message_id == m.id, MessageStatus.user_id == current_user.id)
            .first()
        )
        if status_row:
            status_row.status = DeliveryState.read
        else:
            db.add(MessageStatus(message_id=m.id, user_id=current_user.id, status=DeliveryState.read))
        if m.sender_id:
            affected_sender_ids.add(m.sender_id)

    db.commit()

    # Notify senders that their messages have been read (receipt update)
    if unread_messages:
        other_count = (
            db.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.left_at.is_(None),
                ConversationParticipant.user_id != current_user.id,
            )
            .count()
        )
        for m in unread_messages:
            db.refresh(m)
            msg_out = serialize_message(db, m, other_count)
            for sender_id in affected_sender_ids:
                await manager.send_to_user(
                    sender_id,
                    {"type": "message:status", "payload": msg_out.model_dump(mode="json")},
                )

    return {"message": "Marked as read.", "last_read_message_id": latest_message.id}

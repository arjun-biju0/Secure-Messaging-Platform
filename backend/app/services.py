"""
Shared helper functions for serializing conversations/messages and
computing derived fields (unread counts, aggregate delivery status,
"other user" for direct chats). Used by both REST routers and the
WebSocket layer so REST responses and realtime pushes stay consistent.
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import (
    Conversation, ConversationParticipant, Message, MessageStatus,
    DeliveryState, ConversationType, User,
)
from app.schemas.conversation import ConversationOut, ParticipantOut
from app.schemas.message import MessageOut, MessageStatusOut
from app.schemas.user import UserPublicOut


def serialize_user_public(user: User) -> UserPublicOut:
    return UserPublicOut.model_validate(user)


def compute_aggregate_status(db: Session, message: Message, recipient_count: int) -> str:
    """
    Returns 'sent' | 'delivered' | 'read' representing the *worst* (least
    progressed) status across all recipients - mirrors Signal: a message
    only shows as "read" once every recipient has read it, and
    "delivered" once every recipient's client has received it.
    """
    statuses = message.statuses
    if not statuses or recipient_count == 0:
        return "sent"
    if len(statuses) < recipient_count:
        # not all recipients have even a 'sent' row yet (e.g. offline) -
        # treat missing rows as 'sent' (lowest state)
        worst = "sent"
    else:
        worst = "read"
    order = {"sent": 0, "delivered": 1, "read": 2}
    worst_rank = order[worst]
    for s in statuses:
        if order[s.status.value if hasattr(s.status, "value") else s.status] < worst_rank:
            worst_rank = order[s.status.value if hasattr(s.status, "value") else s.status]
    inv = {v: k for k, v in order.items()}
    return inv[worst_rank]


def serialize_message(db: Session, message: Message, recipient_count: Optional[int] = None) -> MessageOut:
    sender_out = serialize_user_public(message.sender) if message.sender else None
    statuses_out = [
        MessageStatusOut(
            user_id=s.user_id,
            status=s.status.value if hasattr(s.status, "value") else s.status,
            updated_at=s.updated_at,
        )
        for s in message.statuses
    ]
    agg = None
    if recipient_count is not None:
        agg = compute_aggregate_status(db, message, recipient_count)
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender=sender_out,
        type=message.type.value if hasattr(message.type, "value") else message.type,
        content="This message was deleted" if message.deleted_at else message.content,
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
        client_id=message.client_id,
        aggregate_status=agg,
        statuses=statuses_out,
    )


def get_other_participant(conversation: Conversation, viewer_id: int) -> Optional[ConversationParticipant]:
    for p in conversation.participants:
        if p.user_id != viewer_id and p.left_at is None:
            return p
    return None


def compute_unread_count(db: Session, conversation_id: int, participant: ConversationParticipant) -> int:
    q = db.query(func.count(Message.id)).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != participant.user_id,
    )
    if participant.last_read_message_id:
        q = q.filter(Message.id > participant.last_read_message_id)
    return q.scalar() or 0


def serialize_conversation(
    db: Session,
    conversation: Conversation,
    viewer_id: int,
    online_checker=None,
    typing_user_ids: Optional[List[int]] = None,
) -> ConversationOut:
    my_participant = next(
        (p for p in conversation.participants if p.user_id == viewer_id), None
    )
    unread = compute_unread_count(db, conversation.id, my_participant) if my_participant else 0

    other_user_out = None
    if conversation.type == ConversationType.direct or (
        hasattr(conversation.type, "value") and conversation.type.value == "direct"
    ):
        other = get_other_participant(conversation, viewer_id)
        if other and other.user:
            user_out = serialize_user_public(other.user)
            if online_checker:
                user_out.is_online = online_checker(other.user.id)
            other_user_out = user_out

    recipient_count = max(len(conversation.participants) - 1, 0)
    last_message_out = None
    if conversation.last_message:
        last_message_out = serialize_message(db, conversation.last_message, recipient_count)

    participants_out = [
        ParticipantOut(
            user=serialize_user_public(p.user),
            role=p.role.value if hasattr(p.role, "value") else p.role,
            joined_at=p.joined_at,
        )
        for p in conversation.participants
        if p.left_at is None
    ]

    name = conversation.name
    avatar_url = conversation.avatar_url
    avatar_color = conversation.avatar_color
    if (conversation.type == ConversationType.direct or getattr(conversation.type, "value", conversation.type) == "direct") and other_user_out:
        name = other_user_out.display_name
        avatar_url = other_user_out.avatar_url
        avatar_color = other_user_out.avatar_color

    return ConversationOut(
        id=conversation.id,
        type=conversation.type.value if hasattr(conversation.type, "value") else conversation.type,
        name=name,
        avatar_url=avatar_url,
        avatar_color=avatar_color,
        description=conversation.description,
        created_at=conversation.created_at,
        last_activity_at=conversation.last_activity_at,
        last_message=last_message_out,
        unread_count=unread,
        is_muted=bool(my_participant.is_muted) if my_participant else False,
        is_archived=bool(my_participant.is_archived) if my_participant else False,
        is_pinned=bool(my_participant.is_pinned) if my_participant else False,
        participants=participants_out,
        other_user=other_user_out,
        typing_user_ids=typing_user_ids or [],
    )

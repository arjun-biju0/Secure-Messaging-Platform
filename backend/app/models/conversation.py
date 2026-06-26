"""
Conversation models.

A Conversation can be type='direct' (exactly 2 participants) or
type='group' (name + avatar + N participants, with admin roles).

ConversationParticipant is the join table tracking membership, role,
per-user mute/archive state, and a `last_read_message_id` watermark
used to compute unread counts and read receipts cheaply.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Boolean, Enum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class ConversationType(str, enum.Enum):
    direct = "direct"
    group = "group"


class ParticipantRole(str, enum.Enum):
    member = "member"
    admin = "admin"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(ConversationType), nullable=False, default=ConversationType.direct)

    # Only meaningful for groups
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    avatar_color = Column(String, nullable=False, default="#2C6BED")
    description = Column(String, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    # Denormalized pointer to the latest message, kept in sync on every
    # send so the conversation list can sort/preview without a join+max.
    last_message_id = Column(Integer, ForeignKey("messages.id", use_alter=True), nullable=True)
    last_activity_at = Column(DateTime, default=utcnow, index=True)

    participants = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    messages = relationship(
        "Message",
        back_populates="conversation",
        foreign_keys="Message.conversation_id",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    last_message = relationship("Message", foreign_keys=[last_message_id], post_update=True)


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    role = Column(Enum(ParticipantRole), nullable=False, default=ParticipantRole.member)
    joined_at = Column(DateTime, default=utcnow)
    left_at = Column(DateTime, nullable=True)  # null = still a member

    is_muted = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)

    # Watermark for unread-count / read-receipt computation
    last_read_message_id = Column(Integer, ForeignKey("messages.id", use_alter=True), nullable=True)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User", back_populates="participations")

"""
Message + MessageStatus models.

MessageStatus tracks per-recipient delivery state (sent / delivered /
read) which is what powers Signal's single-check / double-check / blue
double-check receipt UI. The sender's own row is not tracked here -
sender status is derived from the aggregate of recipient rows.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Enum, Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class MessageType(str, enum.Enum):
    text = "text"
    system = "system"  # e.g. "Alice added Bob", "Group created"


class DeliveryState(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # null for system messages

    type = Column(Enum(MessageType), nullable=False, default=MessageType.text)
    content = Column(String, nullable=False)

    created_at = Column(DateTime, default=utcnow, index=True)
    edited_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # soft delete ("This message was deleted")

    # Client-generated id lets the UI reconcile its optimistic bubble
    # with the server-confirmed message over the WebSocket.
    client_id = Column(String, nullable=True, index=True)

    conversation = relationship(
        "Conversation", back_populates="messages", foreign_keys=[conversation_id]
    )
    sender = relationship("User", back_populates="messages")
    statuses = relationship(
        "MessageStatus", back_populates="message", cascade="all, delete-orphan"
    )


class MessageStatus(Base):
    """One row per (message, recipient) pair tracking delivery progress."""
    __tablename__ = "message_statuses"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_user_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # the recipient

    status = Column(Enum(DeliveryState), nullable=False, default=DeliveryState.sent)
    updated_at = Column(DateTime, default=utcnow)

    message = relationship("Message", back_populates="statuses")
    user = relationship("User")

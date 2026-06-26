"""
Import all models here so that Base.metadata.create_all() picks up
every table, and so other modules can do `from app.models import User`.
"""
from app.models.user import User
from app.models.contact import Contact
from app.models.conversation import (
    Conversation, ConversationParticipant, ConversationType, ParticipantRole,
)
from app.models.message import Message, MessageStatus, MessageType, DeliveryState
from app.models.otp import OtpRequest

__all__ = [
    "User",
    "Contact",
    "Conversation",
    "ConversationParticipant",
    "ConversationType",
    "ParticipantRole",
    "Message",
    "MessageStatus",
    "MessageType",
    "DeliveryState",
    "OtpRequest",
]

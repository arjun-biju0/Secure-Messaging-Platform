"""
User model.

Represents a registered account. Phone verification is mocked (fixed
OTP), so there is no real SMS integration here - see app/routers/auth.py.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Either of these can be used to identify/find a user; phone is the
    # canonical Signal-style identifier, username is an optional handle.
    phone_number = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)

    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    avatar_color = Column(String, nullable=False, default="#2C6BED")  # fallback initials bubble color
    about = Column(String, nullable=True, default="Available")

    password_hash = Column(String, nullable=True)  # mocked auth; OTP-only accounts may have no password

    is_online = Column(Boolean, default=False)
    last_seen_at = Column(DateTime, default=utcnow)

    created_at = Column(DateTime, default=utcnow)

    # Relationships
    contacts = relationship(
        "Contact",
        foreign_keys="Contact.owner_id",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    participations = relationship(
        "ConversationParticipant",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    messages = relationship("Message", back_populates="sender")

"""
Contact model.

A contact is a directed relationship: owner_id has saved contact_user_id
in their address book, optionally with a custom nickname. This mirrors
how Signal lets you save someone under your own label.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id", name="uq_owner_contact"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    contact_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    nickname = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="contacts")
    contact_user = relationship("User", foreign_keys=[contact_user_id])

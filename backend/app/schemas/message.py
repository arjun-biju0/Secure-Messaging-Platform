from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.user import UserPublicOut


class SendMessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    client_id: Optional[str] = None


class MessageStatusOut(BaseModel):
    user_id: int
    status: str
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: Optional[int] = None
    sender: Optional[UserPublicOut] = None
    type: str
    content: str
    created_at: datetime
    edited_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    client_id: Optional[str] = None
    # Aggregate status as seen by the *current* viewer's perspective for
    # messages they sent (sent / delivered / read across all recipients).
    aggregate_status: Optional[str] = None
    statuses: List[MessageStatusOut] = []

    class Config:
        from_attributes = True


class MessagePageOut(BaseModel):
    messages: List[MessageOut]
    has_more: bool

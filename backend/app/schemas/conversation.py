from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.user import UserPublicOut
from app.schemas.message import MessageOut


class CreateDirectConversationIn(BaseModel):
    user_id: int


class CreateGroupIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    member_ids: List[int]
    description: Optional[str] = Field(None, max_length=200)
    avatar_color: Optional[str] = None


class UpdateGroupIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=200)
    avatar_color: Optional[str] = None


class AddMembersIn(BaseModel):
    member_ids: List[int]


class ParticipantOut(BaseModel):
    user: UserPublicOut
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: int
    type: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_color: str
    description: Optional[str] = None
    created_at: datetime
    last_activity_at: datetime
    last_message: Optional[MessageOut] = None
    unread_count: int = 0
    is_muted: bool = False
    is_archived: bool = False
    is_pinned: bool = False
    participants: List[ParticipantOut] = []
    # For direct conversations: the "other" user, for convenient display
    other_user: Optional[UserPublicOut] = None
    typing_user_ids: List[int] = []

    class Config:
        from_attributes = True


class ConversationSettingsIn(BaseModel):
    is_muted: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_pinned: Optional[bool] = None

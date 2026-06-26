from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.user import UserPublicOut


class AddContactIn(BaseModel):
    phone_number: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = Field(None, max_length=50)


class UpdateContactIn(BaseModel):
    nickname: Optional[str] = Field(None, max_length=50)


class ContactOut(BaseModel):
    id: int
    nickname: Optional[str] = None
    created_at: datetime
    user: UserPublicOut

    class Config:
        from_attributes = True

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    phone_number: str
    username: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    avatar_color: str
    about: Optional[str] = None
    is_online: bool
    last_seen_at: datetime

    class Config:
        from_attributes = True


class UserPublicOut(BaseModel):
    """Slimmer projection used inside contact lists / participant lists."""
    id: int
    display_name: str
    username: Optional[str] = None
    phone_number: str
    avatar_url: Optional[str] = None
    avatar_color: str
    about: Optional[str] = None
    is_online: bool
    last_seen_at: datetime

    class Config:
        from_attributes = True


class UpdateProfileIn(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=50)
    username: Optional[str] = Field(None, min_length=3, max_length=30)
    about: Optional[str] = Field(None, max_length=140)
    avatar_color: Optional[str] = None
    avatar_url: Optional[str] = None

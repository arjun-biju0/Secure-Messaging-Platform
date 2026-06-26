from typing import Optional
from pydantic import BaseModel, Field


class RequestOtpIn(BaseModel):
    phone_number: str = Field(..., min_length=4, max_length=20)


class RequestOtpOut(BaseModel):
    message: str
    demo_otp: str  # mocked - real Signal would never return this


class VerifyOtpIn(BaseModel):
    phone_number: str
    code: str


class VerifyOtpOut(BaseModel):
    """Returned after OTP verification - tells the client whether this
    phone number already has an account (-> login) or needs registration."""
    verified: bool
    account_exists: bool
    registration_token: str  # short-lived proof-of-verification token


class RegisterIn(BaseModel):
    registration_token: str
    phone_number: str
    display_name: str = Field(..., min_length=1, max_length=50)
    username: Optional[str] = Field(None, min_length=3, max_length=30)
    password: Optional[str] = Field(None, min_length=4)
    avatar_color: Optional[str] = None
    about: Optional[str] = None


class LoginIn(BaseModel):
    """Login for an existing account after OTP re-verification."""
    registration_token: str
    phone_number: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


from app.schemas.user import UserOut  # noqa: E402  (avoid circular import at module top)
TokenOut.model_rebuild()

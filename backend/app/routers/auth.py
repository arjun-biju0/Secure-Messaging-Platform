"""
Auth router - mocked phone verification flow:

1. POST /api/auth/request-otp     {phone_number}
   -> creates an OtpRequest row with the fixed MOCK_OTP_CODE and
      returns it in `demo_otp` (clearly a dev-mode convenience, since
      real Signal would never echo back the code).

2. POST /api/auth/verify-otp       {phone_number, code}
   -> validates the code, marks it verified, returns whether an
      account already exists for that phone number plus a short-lived
      `registration_token` (itself just a signed JWT) proving
      verification succeeded, to be used by /register or /login.

3. POST /api/auth/register         {registration_token, phone_number, display_name, ...}
   -> creates the user, returns a normal access token.

4. POST /api/auth/login            {registration_token, phone_number}
   -> for an already-registered phone number, returns a normal access
      token once OTP has been verified again.

5. GET  /api/auth/me                -> current user profile.
"""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.database import get_db
from app.core.config import MOCK_OTP_CODE, JWT_SECRET, JWT_ALGORITHM
from app.core.security import create_access_token, hash_password
from app.models import User, OtpRequest
from app.schemas.auth import (
    RequestOtpIn, RequestOtpOut, VerifyOtpIn, VerifyOtpOut,
    RegisterIn, LoginIn, TokenOut,
)
from app.schemas.user import UserOut
from app.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

AVATAR_PALETTE = [
    "#2C6BED", "#3A76F0", "#7B68EE", "#1FAEAE", "#2DB67C",
    "#E08A2E", "#D6516A", "#9C6ADE", "#4F8EF7", "#19998A",
]


def _registration_token(phone_number: str) -> str:
    payload = {
        "purpose": "registration",
        "phone_number": phone_number,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_registration_token(token: str, phone_number: str) -> bool:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return (
            payload.get("purpose") == "registration"
            and payload.get("phone_number") == phone_number
        )
    except JWTError:
        return False


@router.post("/request-otp", response_model=RequestOtpOut)
def request_otp(body: RequestOtpIn, db: Session = Depends(get_db)):
    otp = OtpRequest(phone_number=body.phone_number, code=MOCK_OTP_CODE, verified=False)
    db.add(otp)
    db.commit()
    return RequestOtpOut(
        message=f"A verification code has been sent to {body.phone_number} (mocked).",
        demo_otp=MOCK_OTP_CODE,
    )


@router.post("/verify-otp", response_model=VerifyOtpOut)
def verify_otp(body: VerifyOtpIn, db: Session = Depends(get_db)):
    otp = (
        db.query(OtpRequest)
        .filter(OtpRequest.phone_number == body.phone_number)
        .order_by(OtpRequest.created_at.desc())
        .first()
    )
    if not otp or otp.code != body.code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    otp.verified = True
    db.commit()

    existing_user = db.query(User).filter(User.phone_number == body.phone_number).first()
    token = _registration_token(body.phone_number)

    return VerifyOtpOut(
        verified=True,
        account_exists=existing_user is not None,
        registration_token=token,
    )


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not _verify_registration_token(body.registration_token, body.phone_number):
        raise HTTPException(status_code=400, detail="Phone number not verified. Please verify OTP first.")

    if db.query(User).filter(User.phone_number == body.phone_number).first():
        raise HTTPException(status_code=409, detail="An account with this phone number already exists.")

    if body.username:
        if db.query(User).filter(User.username == body.username).first():
            raise HTTPException(status_code=409, detail="That username is already taken.")

    color = body.avatar_color or secrets.choice(AVATAR_PALETTE)

    user = User(
        phone_number=body.phone_number,
        username=body.username,
        display_name=body.display_name,
        avatar_color=color,
        about=body.about or "Available",
        password_hash=hash_password(body.password) if body.password else None,
        is_online=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    if not _verify_registration_token(body.registration_token, body.phone_number):
        raise HTTPException(status_code=400, detail="Phone number not verified. Please verify OTP first.")

    user = db.query(User).filter(User.phone_number == body.phone_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this phone number. Please register.")

    user.is_online = True
    db.commit()

    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/logout")
def logout(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.is_online = False
    current_user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Logged out."}

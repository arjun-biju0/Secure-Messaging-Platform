"""
Users router: profile updates, avatar upload, and user search (used by
the "Add contact" / "New conversation" flows to find people by phone
number or username).
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.core.config import AVATAR_DIR
from app.models import User
from app.schemas.user import UserOut, UpdateProfileIn, UserPublicOut
from app.deps import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

ALLOWED_AVATAR_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}


@router.patch("/me", response_model=UserOut)
def update_profile(
    body: UpdateProfileIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.username is not None and body.username != current_user.username:
        clash = db.query(User).filter(
            User.username == body.username, User.id != current_user.id
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="That username is already taken.")
        current_user.username = body.username

    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.about is not None:
        current_user.about = body.about
    if body.avatar_color is not None:
        current_user.avatar_color = body.avatar_color
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url

    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type.")

    ext = Path(file.filename or "avatar.png").suffix or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = AVATAR_DIR / filename

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB).")
    dest.write_bytes(contents)

    current_user.avatar_url = f"/static/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.get("/search", response_model=list[UserPublicOut])
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find users by phone number or username, to add as contacts."""
    results = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            or_(
                User.phone_number.ilike(f"%{q}%"),
                User.username.ilike(f"%{q}%"),
                User.display_name.ilike(f"%{q}%"),
            ),
        )
        .limit(20)
        .all()
    )
    return [UserPublicOut.model_validate(u) for u in results]

"""
Contacts router: add/list/update/delete contacts.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, Contact
from app.schemas.contact import AddContactIn, UpdateContactIn, ContactOut
from app.deps import get_current_user

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
def list_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contacts = (
        db.query(Contact)
        .options(joinedload(Contact.contact_user))
        .filter(Contact.owner_id == current_user.id)
        .all()
    )
    out = []
    for c in contacts:
        out.append(
            ContactOut(
                id=c.id,
                nickname=c.nickname,
                created_at=c.created_at,
                user=c.contact_user,
            )
        )
    return out


@router.post("", response_model=ContactOut, status_code=201)
def add_contact(body: AddContactIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not body.phone_number and not body.username:
        raise HTTPException(status_code=400, detail="Provide a phone number or username.")

    query = db.query(User)
    if body.phone_number:
        target = query.filter(User.phone_number == body.phone_number).first()
    else:
        target = query.filter(User.username == body.username).first()

    if not target:
        raise HTTPException(status_code=404, detail="No Signal Clone user found with that phone number or username.")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't add yourself as a contact.")

    existing = (
        db.query(Contact)
        .filter(Contact.owner_id == current_user.id, Contact.contact_user_id == target.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This person is already in your contacts.")

    contact = Contact(owner_id=current_user.id, contact_user_id=target.id, nickname=body.nickname)
    db.add(contact)
    db.commit()
    db.refresh(contact)

    return ContactOut(id=contact.id, nickname=contact.nickname, created_at=contact.created_at, user=target)


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int,
    body: UpdateContactIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")
    if body.nickname is not None:
        contact.nickname = body.nickname
    db.commit()
    db.refresh(contact)
    return ContactOut(id=contact.id, nickname=contact.nickname, created_at=contact.created_at, user=contact.contact_user)


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")
    db.delete(contact)
    db.commit()
    return None

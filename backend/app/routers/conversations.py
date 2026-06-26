"""
Conversations router:
- list conversations (sorted by last_activity_at desc)
- create a direct conversation (or return existing one)
- create a group conversation
- get conversation detail / members
- update group info, add/remove members (admin only)
- per-user settings (mute / archive / pin)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    User, Conversation, ConversationParticipant, ConversationType,
    ParticipantRole, Message, MessageType,
)
from app.schemas.conversation import (
    CreateDirectConversationIn, CreateGroupIn, UpdateGroupIn, AddMembersIn,
    ConversationOut, ConversationSettingsIn,
)
from app.deps import get_current_user
from app.services import serialize_conversation
from app.ws.manager import manager

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _load_conversation(db: Session, conversation_id: int) -> Conversation:
    convo = (
        db.query(Conversation)
        .options(
            joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
            joinedload(Conversation.last_message).joinedload(Message.sender),
            joinedload(Conversation.last_message).joinedload(Message.statuses),
        )
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return convo


def _require_participant(convo: Conversation, user_id: int) -> ConversationParticipant:
    p = next((p for p in convo.participants if p.user_id == user_id and p.left_at is None), None)
    if not p:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")
    return p


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(Conversation)
        .join(ConversationParticipant)
        .options(
            joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
            joinedload(Conversation.last_message).joinedload(Message.sender),
            joinedload(Conversation.last_message).joinedload(Message.statuses),
        )
        .filter(
            ConversationParticipant.user_id == current_user.id,
            ConversationParticipant.left_at.is_(None),
        )
        .order_by(Conversation.last_activity_at.desc())
        .all()
    )
    return [
        serialize_conversation(db, c, current_user.id, online_checker=manager.is_online)
        for c in rows
    ]


@router.post("/direct", response_model=ConversationOut, status_code=201)
async def create_direct_conversation(
    body: CreateDirectConversationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't start a conversation with yourself.")

    other = db.query(User).filter(User.id == body.user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found.")

    # Check for an existing direct conversation between these two users
    existing = (
        db.query(Conversation)
        .join(ConversationParticipant)
        .filter(
            Conversation.type == ConversationType.direct,
            ConversationParticipant.user_id == current_user.id,
        )
        .all()
    )
    for convo in existing:
        participant_ids = {p.user_id for p in convo.participants if p.left_at is None}
        if participant_ids == {current_user.id, other.id}:
            full = _load_conversation(db, convo.id)
            return serialize_conversation(db, full, current_user.id, online_checker=manager.is_online)

    convo = Conversation(type=ConversationType.direct, created_by=current_user.id)
    db.add(convo)
    db.flush()

    db.add(ConversationParticipant(conversation_id=convo.id, user_id=current_user.id, role=ParticipantRole.member))
    db.add(ConversationParticipant(conversation_id=convo.id, user_id=other.id, role=ParticipantRole.member))
    db.commit()

    full = _load_conversation(db, convo.id)
    result = serialize_conversation(db, full, current_user.id, online_checker=manager.is_online)

    # Notify the other user in real time so the new chat appears for them
    other_view = serialize_conversation(db, full, other.id, online_checker=manager.is_online)
    await manager.send_to_user(other.id, {"type": "conversation:new", "payload": other_view.model_dump(mode="json")})

    return result


@router.post("/group", response_model=ConversationOut, status_code=201)
async def create_group(
    body: CreateGroupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_ids = set(body.member_ids) - {current_user.id}
    if len(member_ids) < 1:
        raise HTTPException(status_code=400, detail="A group needs at least one other member.")

    members = db.query(User).filter(User.id.in_(member_ids)).all()
    if len(members) != len(member_ids):
        raise HTTPException(status_code=404, detail="One or more selected users could not be found.")

    convo = Conversation(
        type=ConversationType.group,
        name=body.name,
        description=body.description,
        avatar_color=body.avatar_color or "#2C6BED",
        created_by=current_user.id,
    )
    db.add(convo)
    db.flush()

    db.add(ConversationParticipant(conversation_id=convo.id, user_id=current_user.id, role=ParticipantRole.admin))
    for m in members:
        db.add(ConversationParticipant(conversation_id=convo.id, user_id=m.id, role=ParticipantRole.member))

    system_msg = Message(
        conversation_id=convo.id,
        sender_id=None,
        type=MessageType.system,
        content=f"{current_user.display_name} created the group \u201c{body.name}\u201d",
    )
    db.add(system_msg)
    db.flush()
    convo.last_message_id = system_msg.id
    convo.last_activity_at = system_msg.created_at
    db.commit()

    full = _load_conversation(db, convo.id)

    for m in members:
        view = serialize_conversation(db, full, m.id, online_checker=manager.is_online)
        await manager.send_to_user(m.id, {"type": "conversation:new", "payload": view.model_dump(mode="json")})

    return serialize_conversation(db, full, current_user.id, online_checker=manager.is_online)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    convo = _load_conversation(db, conversation_id)
    _require_participant(convo, current_user.id)
    return serialize_conversation(db, convo, current_user.id, online_checker=manager.is_online)


@router.patch("/{conversation_id}/settings", response_model=ConversationOut)
def update_settings(
    conversation_id: int,
    body: ConversationSettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo = _load_conversation(db, conversation_id)
    p = _require_participant(convo, current_user.id)
    if body.is_muted is not None:
        p.is_muted = body.is_muted
    if body.is_archived is not None:
        p.is_archived = body.is_archived
    if body.is_pinned is not None:
        p.is_pinned = body.is_pinned
    db.commit()
    convo = _load_conversation(db, conversation_id)
    return serialize_conversation(db, convo, current_user.id, online_checker=manager.is_online)


@router.patch("/{conversation_id}/group", response_model=ConversationOut)
async def update_group(
    conversation_id: int,
    body: UpdateGroupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo = _load_conversation(db, conversation_id)
    p = _require_participant(convo, current_user.id)
    if convo.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Not a group conversation.")
    if p.role != ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Only group admins can edit group info.")

    changed = []
    if body.name is not None and body.name != convo.name:
        changed.append(f"changed the group name to \u201c{body.name}\u201d")
        convo.name = body.name
    if body.description is not None:
        convo.description = body.description
    if body.avatar_color is not None:
        convo.avatar_color = body.avatar_color

    if changed:
        sys_msg = Message(
            conversation_id=convo.id,
            sender_id=None,
            type=MessageType.system,
            content=f"{current_user.display_name} {changed[0]}",
        )
        db.add(sys_msg)
        db.flush()
        convo.last_message_id = sys_msg.id
        convo.last_activity_at = sys_msg.created_at

    db.commit()
    convo = _load_conversation(db, conversation_id)
    result = serialize_conversation(db, convo, current_user.id, online_checker=manager.is_online)

    member_ids = [pp.user_id for pp in convo.participants if pp.left_at is None]
    for uid in member_ids:
        view = serialize_conversation(db, convo, uid, online_checker=manager.is_online)
        await manager.send_to_user(uid, {"type": "conversation:updated", "payload": view.model_dump(mode="json")})
        if changed:
            from app.services import serialize_message
            msg_out = serialize_message(db, convo.last_message, max(len(member_ids) - 1, 0))
            await manager.send_to_user(uid, {"type": "message:new", "payload": msg_out.model_dump(mode="json")})

    return result


@router.post("/{conversation_id}/members", response_model=ConversationOut)
async def add_members(
    conversation_id: int,
    body: AddMembersIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo = _load_conversation(db, conversation_id)
    p = _require_participant(convo, current_user.id)
    if convo.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Not a group conversation.")
    if p.role != ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Only group admins can add members.")

    existing_ids = {pp.user_id for pp in convo.participants if pp.left_at is None}
    new_ids = set(body.member_ids) - existing_ids
    if not new_ids:
        raise HTTPException(status_code=400, detail="Those users are already members.")

    new_users = db.query(User).filter(User.id.in_(new_ids)).all()
    names = []
    for u in new_users:
        db.add(ConversationParticipant(conversation_id=convo.id, user_id=u.id, role=ParticipantRole.member))
        names.append(u.display_name)

    sys_msg = Message(
        conversation_id=convo.id,
        sender_id=None,
        type=MessageType.system,
        content=f"{current_user.display_name} added {', '.join(names)}",
    )
    db.add(sys_msg)
    db.flush()
    convo.last_message_id = sys_msg.id
    convo.last_activity_at = sys_msg.created_at
    db.commit()

    convo = _load_conversation(db, conversation_id)
    result = serialize_conversation(db, convo, current_user.id, online_checker=manager.is_online)

    member_ids = [pp.user_id for pp in convo.participants if pp.left_at is None]
    from app.services import serialize_message
    msg_out = serialize_message(db, convo.last_message, max(len(member_ids) - 1, 0))
    for uid in member_ids:
        view = serialize_conversation(db, convo, uid, online_checker=manager.is_online)
        event_type = "conversation:new" if uid in new_ids else "conversation:updated"
        await manager.send_to_user(uid, {"type": event_type, "payload": view.model_dump(mode="json")})
        await manager.send_to_user(uid, {"type": "message:new", "payload": msg_out.model_dump(mode="json")})

    return result


@router.delete("/{conversation_id}/members/{user_id}", response_model=ConversationOut)
async def remove_member(
    conversation_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo = _load_conversation(db, conversation_id)
    p = _require_participant(convo, current_user.id)
    if convo.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Not a group conversation.")

    target = next((pp for pp in convo.participants if pp.user_id == user_id and pp.left_at is None), None)
    if not target:
        raise HTTPException(status_code=404, detail="That person is not a member of this group.")

    is_self_leave = user_id == current_user.id
    if not is_self_leave and p.role != ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Only group admins can remove members.")

    target.left_at = datetime.now(timezone.utc)
    removed_user = target.user

    verb = "left the group" if is_self_leave else f"removed {removed_user.display_name}"
    sys_msg = Message(
        conversation_id=convo.id,
        sender_id=None,
        type=MessageType.system,
        content=f"{current_user.display_name} {verb}",
    )
    db.add(sys_msg)
    db.flush()
    convo.last_message_id = sys_msg.id
    convo.last_activity_at = sys_msg.created_at
    db.commit()

    convo = _load_conversation(db, conversation_id)
    remaining_ids = [pp.user_id for pp in convo.participants if pp.left_at is None]

    from app.services import serialize_message
    msg_out = serialize_message(db, convo.last_message, max(len(remaining_ids) - 1, 0))
    for uid in remaining_ids:
        view = serialize_conversation(db, convo, uid, online_checker=manager.is_online)
        await manager.send_to_user(uid, {"type": "conversation:updated", "payload": view.model_dump(mode="json")})
        await manager.send_to_user(uid, {"type": "message:new", "payload": msg_out.model_dump(mode="json")})

    await manager.send_to_user(user_id, {"type": "conversation:removed", "payload": {"conversation_id": conversation_id}})

    return serialize_conversation(db, convo, current_user.id, online_checker=manager.is_online)

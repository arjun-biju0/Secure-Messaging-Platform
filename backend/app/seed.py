"""
Seed the database with sample data so the app is immediately usable.

Run with:
    python -m app.seed

This wipes the existing tables and recreates everything.

Seeded users (all use the mocked OTP code 123456 to log in, password
is also "password123" for those who want password-based dev login):
    +15550001  Ava Thompson      @ava
    +15550002  Noah Williams     @noah
    +15550003  Maya Chen         @maya
    +15550004  Liam Rodriguez    @liam
    +15550005  Sofia Patel       @sofia
    +15550006  Ethan Kim         @ethan
"""
import random
from datetime import datetime, timedelta, timezone

from app.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models import (
    User, Contact, Conversation, ConversationParticipant, ConversationType,
    ParticipantRole, Message, MessageStatus, MessageType, DeliveryState,
)

random.seed(42)


def utcnow():
    return datetime.now(timezone.utc)


USERS = [
    dict(phone_number="+15550001", username="ava", display_name="Ava Thompson",
         avatar_color="#2C6BED", about="Living my best life ✨"),
    dict(phone_number="+15550002", username="noah", display_name="Noah Williams",
         avatar_color="#2DB67C", about="Busy"),
    dict(phone_number="+15550003", username="maya", display_name="Maya Chen",
         avatar_color="#D6516A", about="Available"),
    dict(phone_number="+15550004", username="liam", display_name="Liam Rodriguez",
         avatar_color="#E08A2E", about="At the gym 💪"),
    dict(phone_number="+15550005", username="sofia", display_name="Sofia Patel",
         avatar_color="#7B68EE", about="Available"),
    dict(phone_number="+15550006", username="ethan", display_name="Ethan Kim",
         avatar_color="#1FAEAE", about="Signal me anytime"),
]


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed():
    reset_db()
    db = SessionLocal()
    try:
        users = []
        for i, u in enumerate(USERS):
            user = User(
                phone_number=u["phone_number"],
                username=u["username"],
                display_name=u["display_name"],
                avatar_color=u["avatar_color"],
                about=u["about"],
                password_hash=hash_password("password123"),
                is_online=(i % 3 == 0),  # a few start "online" for demo flavor
                last_seen_at=utcnow() - timedelta(minutes=random.randint(1, 600)),
            )
            db.add(user)
            users.append(user)
        db.flush()

        ava, noah, maya, liam, sofia, ethan = users

        # ---- Contacts: everyone has everyone else, except a couple of
        # asymmetric gaps so the "add contact" flow has something to do.
        for owner in users:
            for other in users:
                if owner.id == other.id:
                    continue
                # Skip a couple of links to leave room for "add contact" demo
                if owner is ava and other is ethan:
                    continue
                if owner is ethan and other is ava:
                    continue
                db.add(Contact(owner_id=owner.id, contact_user_id=other.id))
        db.flush()

        def make_direct(u1: User, u2: User) -> Conversation:
            convo = Conversation(type=ConversationType.direct, created_by=u1.id)
            db.add(convo)
            db.flush()
            db.add(ConversationParticipant(conversation_id=convo.id, user_id=u1.id, role=ParticipantRole.member))
            db.add(ConversationParticipant(conversation_id=convo.id, user_id=u2.id, role=ParticipantRole.member))
            db.flush()
            return convo

        def add_message(convo: Conversation, sender: User, content: str, minutes_ago: int,
                         status_map=None) -> Message:
            created = utcnow() - timedelta(minutes=minutes_ago)
            msg = Message(
                conversation_id=convo.id, sender_id=sender.id, type=MessageType.text,
                content=content, created_at=created,
            )
            db.add(msg)
            db.flush()
            participants = [p for p in convo.participants if p.user_id != sender.id]
            for p in participants:
                state = DeliveryState.sent
                if status_map and p.user_id in status_map:
                    state = status_map[p.user_id]
                else:
                    state = DeliveryState.read
                db.add(MessageStatus(message_id=msg.id, user_id=p.user_id, status=state, updated_at=created + timedelta(seconds=30)))
            convo.last_message_id = msg.id
            convo.last_activity_at = created
            db.flush()
            return msg

        def add_system_message(convo: Conversation, content: str, minutes_ago: int) -> Message:
            created = utcnow() - timedelta(minutes=minutes_ago)
            msg = Message(conversation_id=convo.id, sender_id=None, type=MessageType.system, content=content, created_at=created)
            db.add(msg)
            db.flush()
            convo.last_message_id = msg.id
            convo.last_activity_at = created
            db.flush()
            return msg

        # ---- Direct conversation 1: Ava <-> Noah (lots of history, unread for Ava)
        c1 = make_direct(ava, noah)
        add_message(c1, noah, "Hey! Are we still on for coffee tomorrow?", 600)
        add_message(c1, ava, "Yes! 10am at the usual place works for me", 595)
        add_message(c1, noah, "Perfect, see you then 😊", 590)
        add_message(c1, ava, "Also did you finish the report?", 120)
        add_message(c1, noah, "Almost done, sending it tonight", 90)
        add_message(c1, noah, "Just sent it, check your email", 5, status_map={ava.id: DeliveryState.delivered})
        add_message(c1, noah, "Let me know what you think!", 2, status_map={ava.id: DeliveryState.delivered})

        # ---- Direct conversation 2: Ava <-> Maya (read, recent)
        c2 = make_direct(ava, maya)
        add_message(c2, maya, "Loved the photos from your trip!", 4000)
        add_message(c2, ava, "Thank you!! It was such a great trip", 3990)
        add_message(c2, maya, "We should plan our own trip soon", 200)
        add_message(c2, ava, "Definitely, let's talk this weekend", 195)

        # ---- Direct conversation 3: Ava <-> Liam (one unread message for Ava)
        c3 = make_direct(ava, liam)
        add_message(c3, liam, "Bro the game last night was insane", 1500)
        add_message(c3, ava, "I KNOW, that last minute goal 🔥", 1490)
        add_message(c3, liam, "Gym at 7am tomorrow?", 30, status_map={ava.id: DeliveryState.delivered})

        # ---- Direct conversation 4: Ava <-> Sofia
        c4 = make_direct(ava, sofia)
        add_message(c4, sofia, "Hey Ava, long time! How have you been?", 10000)
        add_message(c4, ava, "Sofia!! So good to hear from you. Doing well, you?", 9990)
        add_message(c4, sofia, "Same, just got back from Lisbon", 9000)

        # ---- Direct conversation 5: Noah <-> Maya
        c5 = make_direct(noah, maya)
        add_message(c5, noah, "Did you submit the design files?", 800)
        add_message(c5, maya, "Yep, uploaded to the shared drive", 790)

        # ---- Direct conversation 6: Maya <-> Liam
        c6 = make_direct(maya, liam)
        add_message(c6, liam, "Can you review my PR when you get a chance?", 300)
        add_message(c6, maya, "On it now", 250)

        # ---- Direct conversation 7: Noah <-> Ethan
        c7 = make_direct(noah, ethan)
        add_message(c7, ethan, "Welcome to Signal Clone! 👋", 50000)
        add_message(c7, noah, "Thanks! Loving the clean interface so far", 49990)

        # ---- Group 1: "Weekend Trip 🏔️" - Ava, Noah, Maya, Liam
        g1 = Conversation(type=ConversationType.group, name="Weekend Trip 🏔️",
                           description="Planning our mountain getaway",
                           avatar_color="#2DB67C", created_by=ava.id)
        db.add(g1)
        db.flush()
        db.add(ConversationParticipant(conversation_id=g1.id, user_id=ava.id, role=ParticipantRole.admin))
        for m in (noah, maya, liam):
            db.add(ConversationParticipant(conversation_id=g1.id, user_id=m.id, role=ParticipantRole.member))
        db.flush()
        add_system_message(g1, "Ava Thompson created the group \u201cWeekend Trip \U0001F3D4\uFE0F\u201d", 5000)
        add_system_message(g1, "Ava Thompson added Noah Williams, Maya Chen, Liam Rodriguez", 4999)
        add_message(g1, ava, "Hey everyone! Who's in for the cabin trip next month?", 4990)
        add_message(g1, noah, "Count me in!", 4980)
        add_message(g1, maya, "Me too, can't wait", 4970)
        add_message(g1, liam, "Same here, should we book it this weekend?", 240)
        add_message(g1, ava, "Yes let's do it, I'll send the link", 235, status_map={noah.id: DeliveryState.delivered, maya.id: DeliveryState.delivered, liam.id: DeliveryState.delivered})

        # ---- Group 2: "Project Phoenix" - Noah, Maya, Sofia, Ethan
        g2 = Conversation(type=ConversationType.group, name="Project Phoenix",
                           description="Q3 product launch coordination",
                           avatar_color="#9C6ADE", created_by=noah.id)
        db.add(g2)
        db.flush()
        db.add(ConversationParticipant(conversation_id=g2.id, user_id=noah.id, role=ParticipantRole.admin))
        for m in (maya, sofia, ethan):
            db.add(ConversationParticipant(conversation_id=g2.id, user_id=m.id, role=ParticipantRole.member))
        db.flush()
        add_system_message(g2, "Noah Williams created the group \u201cProject Phoenix\u201d", 20000)
        add_system_message(g2, "Noah Williams added Maya Chen, Sofia Patel, Ethan Kim", 19999)
        add_message(g2, noah, "Kickoff meeting notes are in the shared doc", 19000)
        add_message(g2, sofia, "Thanks, I'll review tonight", 18990)
        add_message(g2, ethan, "Looks good so far, left a few comments", 600)
        add_message(g2, maya, "Will address those tomorrow morning", 60, status_map={noah.id: DeliveryState.delivered, sofia.id: DeliveryState.sent, ethan.id: DeliveryState.delivered})

        # ---- Group 3: "Family 💛" - Ava, Liam, Sofia
        g3 = Conversation(type=ConversationType.group, name="Family \U0001F49B",
                           avatar_color="#E08A2E", created_by=sofia.id)
        db.add(g3)
        db.flush()
        db.add(ConversationParticipant(conversation_id=g3.id, user_id=sofia.id, role=ParticipantRole.admin))
        for m in (ava, liam):
            db.add(ConversationParticipant(conversation_id=g3.id, user_id=m.id, role=ParticipantRole.member))
        db.flush()
        add_system_message(g3, "Sofia Patel created the group \u201cFamily \U0001F49B\u201d", 90000)
        add_system_message(g3, "Sofia Patel added Ava Thompson, Liam Rodriguez", 89999)
        add_message(g3, sofia, "Mom's birthday dinner is Saturday at 7", 1000)
        add_message(g3, liam, "I'll bring the cake 🎂", 950)
        add_message(g3, ava, "I've got flowers covered", 20, status_map={sofia.id: DeliveryState.delivered, liam.id: DeliveryState.read})

        # Set Ava's read watermark for some conversations so unread badges
        # are believable (she has read c2 fully, hasn't read latest in c1/c3)
        def set_watermark(convo, user, message=None):
            p = next(p for p in convo.participants if p.user_id == user.id)
            if message:
                p.last_read_message_id = message.id
            else:
                last = db.query(Message).filter(Message.conversation_id == convo.id).order_by(Message.id.desc()).first()
                p.last_read_message_id = last.id if last else None

        set_watermark(c2, ava)  # fully read
        set_watermark(c4, ava)  # fully read
        # c1 and c3 intentionally left with stale watermark -> unread badges for Ava
        m_before_unread_c1 = db.query(Message).filter(Message.conversation_id == c1.id).order_by(Message.id).all()[4]
        set_watermark(c1, ava, m_before_unread_c1)
        m_before_unread_c3 = db.query(Message).filter(Message.conversation_id == c3.id).order_by(Message.id).all()[1]
        set_watermark(c3, ava, m_before_unread_c3)

        for convo in (g1, g2, c5, c6, c7, g3):
            for p in convo.participants:
                last = db.query(Message).filter(Message.conversation_id == convo.id).order_by(Message.id.desc()).first()
                p.last_read_message_id = last.id if last else None
        # leave g1 unread for liam/noah's perspective to show group unread badge demo for ava only fully read
        set_watermark(g1, ava)

        db.commit()
        print("✅ Database seeded successfully.")
        print(f"   {len(users)} users, contacts wired, 7 direct + 3 group conversations created.")
        print("   Login with phone +15550001..+15550006, OTP code 123456 (or password 'password123').")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

# Signal Clone — Backend

FastAPI + SQLAlchemy + SQLite backend for the Signal Clone messaging app.
Provides REST endpoints for auth/contacts/conversations/messages, plus a
WebSocket endpoint for real-time messaging, typing indicators, and presence.

## Tech stack

- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.x
- **Database:** SQLite (file-based, zero setup)
- **Auth:** JWT (python-jose) + mocked OTP phone verification
- **Real-time:** Native WebSockets (FastAPI's built-in support)
- **Password hashing:** passlib + bcrypt (only used if a user sets a password; OTP login doesn't require one)

## 1. Install Python

Requires **Python 3.10+** (developed and tested on 3.12).

## 2. Create a virtual environment

```bash
cd backend
python3 -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

This installs:

| Package | Why |
|---|---|
| `fastapi` | Web framework / routing |
| `uvicorn[standard]` | ASGI server to run the app (the `[standard]` extra pulls in `websockets`, `httptools`, etc.) |
| `sqlalchemy` | ORM + database access |
| `python-jose[cryptography]` | JWT encode/decode for session tokens |
| `passlib[bcrypt]` | Password hashing utility |
| `bcrypt==4.0.1` | Pinned explicitly — newer bcrypt (5.x) breaks passlib's version probing |
| `python-multipart` | Required by FastAPI to parse `multipart/form-data` (avatar uploads) |
| `websockets` | WebSocket protocol implementation used by uvicorn |
| `pydantic` / `pydantic-settings` | Request/response validation and schemas |
| `aiofiles` | Async file I/O (used incidentally by FastAPI's static file serving) |

> **Note on bcrypt:** if you ever see an error like `AttributeError: module 'bcrypt' has no attribute '__about__'`, it means bcrypt got upgraded past 4.x. Re-run `pip install "bcrypt==4.0.1"` to fix it.

## 4. Seed the database

This creates `data/signal_clone.db` from scratch and populates it with 6
demo users, contacts, 7 direct conversations, and 3 group conversations
with realistic message history.

```bash
python -m app.seed
```

Re-running this command **wipes and recreates** the database — useful any
time you want a clean slate.

Seeded demo accounts (use any of these to log in):

| Phone | Username | Name |
|---|---|---|
| +15550001 | @ava | Ava Thompson |
| +15550002 | @noah | Noah Williams |
| +15550003 | @maya | Maya Chen |
| +15550004 | @liam | Liam Rodriguez |
| +15550005 | @sofia | Sofia Patel |
| +15550006 | @ethan | Ethan Kim |

**Mocked OTP code for all logins: `123456`**
(Password-based dev login also works with password `password123`, though the primary flow is phone + OTP.)

## 5. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API base URL: `http://localhost:8000`
- Interactive API docs (Swagger UI): `http://localhost:8000/docs`
- WebSocket endpoint: `ws://localhost:8000/ws?token=<jwt>`
- Health check: `GET http://localhost:8000/api/health`

## Project structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py       # paths, JWT secret, mocked OTP code, CORS origins
│   │   └── security.py     # password hashing + JWT helpers
│   ├── models/              # SQLAlchemy ORM models (one file per table group)
│   ├── schemas/              # Pydantic request/response schemas
│   ├── routers/              # REST endpoints (auth, users, contacts, conversations, messages)
│   ├── ws/
│   │   ├── manager.py       # in-memory connection registry, broadcast helpers
│   │   └── router.py        # the /ws endpoint: connect lifecycle, typing, presence
│   ├── database.py          # SQLAlchemy engine/session setup
│   ├── deps.py               # FastAPI dependency: get_current_user from JWT
│   ├── services.py           # shared serialization helpers (used by REST + WS)
│   ├── seed.py                # database seeding script
│   └── main.py                # FastAPI app instance, router registration
├── data/                      # SQLite database file lives here (gitignored in practice)
├── avatars/                   # uploaded avatar images, served at /static/avatars
└── requirements.txt
```

## Auth flow (mocked)

1. `POST /api/auth/request-otp` `{phone_number}` → always succeeds, returns the code in `demo_otp` (since there's no real SMS).
2. `POST /api/auth/verify-otp` `{phone_number, code}` → code is always `123456`. Returns whether the account already exists, plus a short-lived `registration_token`.
3. Existing account → `POST /api/auth/login` `{registration_token, phone_number}` → returns a JWT access token.
4. New account → `POST /api/auth/register` `{registration_token, phone_number, display_name, ...}` → creates the user, returns a JWT access token.
5. All subsequent requests send `Authorization: Bearer <token>`.

## Notes / assumptions

- Encryption is fully mocked — messages are stored as plain text in SQLite. No real end-to-end cryptography is implemented, per the assignment's scope.
- SQLite uses `check_same_thread=False` since it's accessed from both FastAPI's threadpool and the WebSocket event loop — fine for a single-process demo, not intended for concurrent multi-process production use.
- Typing-indicator state lives in memory (a plain dict in `app/ws/router.py`), not the database, since it's inherently ephemeral.
- CORS is currently locked to `http://localhost:3000` (the Next.js dev server) — update `ALLOWED_ORIGINS` in `app/core/config.py` if your frontend runs elsewhere.

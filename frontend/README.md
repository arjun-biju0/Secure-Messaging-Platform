# Signal Clone — Frontend

Next.js (App Router, TypeScript) client for the Signal Clone messaging app.
Recreates Signal Desktop's layout, message bubbles, receipts, typing
indicators, and settings — talking to the FastAPI backend over REST + a
single persistent WebSocket connection.

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (custom Signal-palette design tokens in `globals.css`)
- **State:** Zustand (single store for conversations / messages / typing / presence)
- **Icons:** lucide-react
- **Dates:** date-fns
- **Real-time:** native browser `WebSocket` (no socket.io — matches the backend's plain FastAPI WebSocket endpoint)

## 1. Install Node.js

Requires **Node 18.18+** (developed and tested on Node 22).

## 2. Install dependencies

```bash
cd frontend
npm install
```

## 3. Configure the API URL

A `.env.local` is already included pointing at a locally-running backend:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

Change these if your backend runs elsewhere (different port, deployed URL, etc).

## 4. Make sure the backend is running first

This app has no functionality without the API — see the backend's own
README. In short:

```bash
# in the backend/ folder, in a separate terminal
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

## 5. Run the frontend

```bash
npm run dev
```

Visit **http://localhost:3000** — you'll land on `/login`.

Use any seeded demo phone number (`+15550001` through `+15550006`) and
OTP code **`123456`** to sign in. Tapping one of the "Quick demo logins"
chips on the login screen fills the number for you.

## 6. Production build (optional)

```bash
npm run build
npm start
```

## Project structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── login/page.tsx          # phone -> OTP flow
│   │   ├── onboarding/page.tsx     # new-account profile setup
│   │   ├── settings/page.tsx       # profile editing + placeholder sections
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # auth guard, WebSocket connection, sidebar shell
│   │   │   ├── page.tsx            # "select a conversation" empty state
│   │   │   └── c/[id]/page.tsx     # active conversation: message list + composer
│   │   ├── layout.tsx              # root layout (providers)
│   │   └── globals.css             # Signal color tokens, animations
│   ├── components/                  # Sidebar, MessageBubble, modals, Avatar, etc.
│   ├── hooks/useSignalSocket.ts     # resilient WebSocket client (auto-reconnect)
│   └── lib/
│       ├── api.ts                   # REST client (attaches JWT, parses errors)
│       ├── auth-context.tsx         # current-user session provider
│       ├── store.ts                 # Zustand store + WebSocket event reducer
│       ├── types.ts                 # types mirroring the backend's Pydantic schemas
│       └── utils.ts                 # date formatting, initials, etc.
├── .env.local
└── package.json
```

## How real-time updates work

`(app)/layout.tsx` opens one WebSocket connection per session (via
`useSignalSocket`) as soon as the user is authenticated. Every inbound
event — `message:new`, `message:status`, `conversation:new`,
`conversation:updated`, `conversation:removed`, `presence:update`,
`typing:update` — is dispatched into the Zustand store
(`applyWsEvent` in `lib/store.ts`), which is the single source of
truth that every component reads from. There is no polling anywhere
in the app.

Sending a message is optimistic: a temporary message with a
client-generated `client_id` is added to the store immediately, then
reconciled with the server's response (or the server's WebSocket echo,
whichever arrives — they're matched by `client_id` so duplicates don't
appear).

## Known limitations / assumptions

- No real push notifications — in-app toasts only, and only for
  conversations you don't currently have open.
- Typing-indicator and online/offline state reset on a hard refresh
  until the WebSocket reconnects (by design — it's ephemeral, mirrors
  the backend keeping it in memory rather than the database).
- Voice/video calls, Stories, and linked devices are intentionally
  "Coming soon" placeholders (`ComingSoonModal`), per the assignment scope.
- Avatar uploads go straight to the backend's local `avatars/` folder;
  there's no cloud storage integration.

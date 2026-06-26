"""
FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import ALLOWED_ORIGINS, AVATAR_DIR
from app.database import Base, engine
from app import models  # noqa: F401  (ensures all models are registered on Base)
from app.routers import auth, users, contacts, conversations, messages
from app.ws import router as ws_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Signal Clone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/avatars", StaticFiles(directory=str(AVATAR_DIR)), name="avatars")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(ws_router.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}

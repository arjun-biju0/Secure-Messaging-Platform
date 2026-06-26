"""
Application configuration.

All settings are centralized here so the rest of the codebase never
hardcodes paths, secrets or magic numbers.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SQLite database file lives in backend/data/signal_clone.db
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DATABASE_URL = f"sqlite:///{DATA_DIR / 'signal_clone.db'}"

# Avatars are stored on disk and served as static files
AVATAR_DIR = BASE_DIR / "avatars"
AVATAR_DIR.mkdir(exist_ok=True)

# JWT settings - in a real product this secret would come from the
# environment / a secrets manager. For this assignment a fixed dev
# secret is fine since auth is mocked (fixed OTP) by design.
JWT_SECRET = os.environ.get("SIGNAL_CLONE_JWT_SECRET", "dev-only-secret-do-not-use-in-prod-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 14  # 14 days, like a "remember me" session

# Mocked OTP - any registration / login flow accepts this fixed code.
MOCK_OTP_CODE = "123456"

# CORS - the Next.js dev server
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

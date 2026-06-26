"""
SQLAlchemy engine / session management.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from app.core.config import DATABASE_URL

# SQLite + StaticPool: SQLite has no real server-side connection limit
# the way Postgres/MySQL do, so there's no benefit to QueuePool's
# fixed-size-plus-overflow model here - it only adds a way for the app
# to start throwing PoolTimeout errors if sessions are ever held open
# longer than expected (e.g. a long-lived WebSocket handler). StaticPool
# keeps a single underlying connection alive and serializes access to
# it, which combined with check_same_thread=False is the standard
# SQLAlchemy recipe for using SQLite from multiple threads/coroutines
# (FastAPI's threadpool + the WebSocket event loop) without surprise
# connection-pool exhaustion.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

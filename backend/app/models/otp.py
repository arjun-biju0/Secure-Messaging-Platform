"""
OtpRequest model.

Mocked phone verification: when a user requests an OTP, we create a
row with a fixed code (see core.config.MOCK_OTP_CODE). No real SMS is
ever sent - the code is also echoed back in the API response in dev
mode so the frontend can display it as a "demo hint".
"""
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Boolean

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class OtpRequest(Base):
    __tablename__ = "otp_requests"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

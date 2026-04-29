from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String

from db.base import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    study_hours_per_day = Column(Float, nullable=False)
    preferred_study_time = Column(String, nullable=False)
    intensity = Column(String, nullable=False)
    weekends_available = Column(Boolean, default=True, nullable=False)
    minimum_reminder_days = Column(Integer, default=3, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

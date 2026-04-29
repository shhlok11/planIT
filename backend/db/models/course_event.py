from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class CourseEvent(Base):
    __tablename__ = "course_events"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)

    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    date = Column(Date, nullable=True, index=True)
    weight = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    source_text = Column(Text, nullable=True)
    is_user_edited = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    course = relationship("Course", back_populates="events")

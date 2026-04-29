from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class StudyBlock(Base):
    __tablename__ = "study_blocks"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("course_events.id"), nullable=False, index=True)

    title = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False)
    reason = Column(Text, nullable=True)
    priority_score = Column(Float, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    upload = relationship("Upload", back_populates="study_blocks")
    course = relationship("Course", back_populates="study_blocks")
    event = relationship("CourseEvent", back_populates="study_blocks")

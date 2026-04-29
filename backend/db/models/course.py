from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.base import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False, index=True)

    course_code = Column(String, nullable=False, index=True)
    course_name = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    priority_rank = Column(Integer, nullable=True)
    difficulty = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    upload = relationship("Upload", back_populates="courses")
    events = relationship(
        "CourseEvent",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    study_blocks = relationship(
        "StudyBlock",
        back_populates="course",
        cascade="all, delete-orphan",
    )

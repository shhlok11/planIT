from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True, index=True)

    original_filename = Column(String, nullable=False)
    saved_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)

    status = Column(String, default="UPLOADED", nullable=False)
    extracted_text = Column(Text, nullable=True)
    clean_text = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="uploads")
    plan = relationship("Plan", back_populates="uploads")
    courses = relationship(
        "Course",
        back_populates="upload",
        cascade="all, delete-orphan",
    )
    study_blocks = relationship(
        "StudyBlock",
        back_populates="upload",
        cascade="all, delete-orphan",
    )

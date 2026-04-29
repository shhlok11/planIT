from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from db.base import Base


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)

    original_filename = Column(String, nullable=False)
    saved_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)

    status = Column(String, default="UPLOADED", nullable=False)
    extracted_text = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

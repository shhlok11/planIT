from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from db.base import Base


class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, index=True)
    email       = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    name        = Column(String, nullable=True)
    avatar_url  = Column(String, nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    oauth_accounts = relationship("OAuthAccount", back_populates="user")
    uploads        = relationship("Upload", back_populates="user")
    preferences    = relationship("UserPreference", back_populates="user")

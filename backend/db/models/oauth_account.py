from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider          = Column(String, nullable=False)        # "google" | "github"
    provider_user_id  = Column(String, nullable=False)
    provider_email    = Column(String, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="oauth_accounts")
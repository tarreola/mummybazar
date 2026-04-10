from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Buyer(Base):
    """Moms who browse and buy items."""
    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)  # WhatsApp number
    email = Column(String, nullable=True)
    neighborhood = Column(String, nullable=True)
    city = Column(String, default="Ciudad de México")
    notes = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)  # Internal admin rating 1-5
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False)   # Admin approval flag
    password_hash = Column(String, nullable=True)  # Storefront login
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="buyer")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="buyer")

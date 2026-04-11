from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Buyer(Base):
    """Contact directory — buyers who have purchased or been added for WA campaigns.
    No account/password required. Identified by phone number."""
    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)  # WhatsApp number (primary identifier)
    whatsapp = Column(String, nullable=True)             # Alt WA if different from phone
    email = Column(String, nullable=True)
    neighborhood = Column(String, nullable=True)
    city = Column(String, default="Ciudad de México")
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="buyer")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="buyer")

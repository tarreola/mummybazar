from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Seller(Base):
    """Moms who upload and sell items."""
    __tablename__ = "sellers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)  # WhatsApp number e.g. +525512345678
    email = Column(String, nullable=True)
    neighborhood = Column(String, nullable=True)
    city = Column(String, default="Ciudad de México")

    # Payout info
    bank_name = Column(String, nullable=True)
    clabe = Column(String, nullable=True)  # Mexican bank transfer ID
    paypal_email = Column(String, nullable=True)

    notes = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)  # Internal admin rating 1-5
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("Item", back_populates="seller")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="seller")

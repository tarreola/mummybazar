import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class MessageDirection(str, enum.Enum):
    OUTBOUND = "outbound"   # We sent it
    INBOUND = "inbound"     # They replied


class MessageType(str, enum.Enum):
    MANUAL = "manual"
    TEMPLATE = "template"
    MARKETING = "marketing"


class WhatsAppMessage(Base):
    """Log of all WhatsApp messages sent/received."""
    __tablename__ = "whatsapp_messages"

    id = Column(Integer, primary_key=True, index=True)
    to_number = Column(String, nullable=False)
    from_number = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    direction = Column(Enum(MessageDirection), nullable=False)
    message_type = Column(Enum(MessageType), default=MessageType.MANUAL)
    twilio_sid = Column(String, nullable=True)   # Twilio message SID
    status = Column(String, nullable=True)        # queued, sent, delivered, failed

    # Optional links
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    seller = relationship("Seller", back_populates="whatsapp_messages")
    buyer = relationship("Buyer", back_populates="whatsapp_messages")

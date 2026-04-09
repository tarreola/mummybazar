from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.models.whatsapp import MessageDirection, MessageType


class SendMessageRequest(BaseModel):
    to_number: str          # e.g. "+525512345678"
    body: str
    message_type: MessageType = MessageType.MANUAL
    seller_id: Optional[int] = None
    buyer_id: Optional[int] = None
    order_id: Optional[int] = None


class WhatsAppMessageOut(BaseModel):
    id: int
    to_number: str
    body: str
    direction: MessageDirection
    message_type: MessageType
    twilio_sid: Optional[str]
    status: Optional[str]
    seller_id: Optional[int]
    buyer_id: Optional[int]
    order_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}

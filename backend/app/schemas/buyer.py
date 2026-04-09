from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class BuyerCreate(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    neighborhood: Optional[str] = None
    city: str = "Ciudad de México"


class BuyerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = None
    is_active: Optional[bool] = None


class BuyerOut(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str]
    neighborhood: Optional[str]
    city: str
    notes: Optional[str]
    rating: Optional[int]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

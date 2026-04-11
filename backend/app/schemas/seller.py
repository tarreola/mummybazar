from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SellerCreate(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    neighborhood: Optional[str] = None
    city: str = "Ciudad de México"
    bank_name: Optional[str] = None
    clabe: Optional[str] = None
    paypal_email: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = None


class SellerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    bank_name: Optional[str] = None
    clabe: Optional[str] = None
    paypal_email: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = None
    is_active: Optional[bool] = None


class SellerOut(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str]
    neighborhood: Optional[str]
    city: str
    bank_name: Optional[str]
    clabe: Optional[str]
    paypal_email: Optional[str]
    notes: Optional[str]
    rating: Optional[int]
    is_active: bool
    is_approved: bool = False
    total_listed: Optional[int] = None
    has_pending_payout: Optional[bool] = None
    created_at: datetime

    model_config = {"from_attributes": True}

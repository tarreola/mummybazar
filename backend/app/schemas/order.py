from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

from app.models.order import OrderStatus, ShippingMethod


class OrderCreate(BaseModel):
    buyer_id: int
    item_id: int
    shipping_method: Optional[ShippingMethod] = None
    shipping_address: Optional[str] = None
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    shipping_method: Optional[ShippingMethod] = None
    shipping_address: Optional[str] = None
    tracking_number: Optional[str] = None
    shipping_carrier: Optional[str] = None
    seller_paid: Optional[int] = None
    notes: Optional[str] = None


class OrderOut(BaseModel):
    id: int
    order_number: str
    buyer_id: int
    item_id: int
    amount: Decimal
    commission_amount: Decimal
    seller_payout_amount: Decimal
    status: OrderStatus
    mp_payment_id: Optional[str]
    shipping_method: Optional[ShippingMethod]
    shipping_address: Optional[str]
    tracking_number: Optional[str]
    shipping_carrier: Optional[str]
    seller_paid: int
    seller_paid_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    # Enriched fields (joined at query time)
    buyer_name: Optional[str] = None
    buyer_phone: Optional[str] = None
    item_title: Optional[str] = None
    item_sku: Optional[str] = None
    seller_id: Optional[int] = None
    seller_name: Optional[str] = None
    seller_phone: Optional[str] = None

    model_config = {"from_attributes": True}

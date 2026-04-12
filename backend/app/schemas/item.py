from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

from app.models.item import ItemStatus, ItemCategory, ItemCondition, ItemGender


class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: ItemCategory
    condition: ItemCondition
    brand: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    gender: Optional[ItemGender] = None
    original_price: Optional[Decimal] = None
    selling_price: Decimal
    seller_id: Optional[int] = None
    no_seller: bool = False
    measurements: Optional[str] = None
    usage_time: Optional[str] = None
    includes_manual: Optional[bool] = None
    seller_review: Optional[str] = None
    notes: Optional[str] = None
    is_featured: bool = False


class ItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ItemCategory] = None
    condition: Optional[ItemCondition] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    gender: Optional[ItemGender] = None
    original_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    status: Optional[ItemStatus] = None
    measurements: Optional[str] = None
    usage_time: Optional[str] = None
    includes_manual: Optional[bool] = None
    seller_review: Optional[str] = None
    notes: Optional[str] = None
    is_featured: Optional[bool] = None
    no_seller: Optional[bool] = None
    seller_id: Optional[int] = None


class ItemOut(BaseModel):
    id: int
    sku: str
    title: str
    description: Optional[str]
    category: ItemCategory
    condition: ItemCondition
    brand: Optional[str]
    size: Optional[str]
    color: Optional[str]
    gender: Optional[ItemGender] = None
    original_price: Optional[Decimal]
    selling_price: Decimal
    seller_payout: Optional[Decimal]
    commission: Optional[Decimal]
    images: Optional[str]
    measurements: Optional[str] = None
    usage_time: Optional[str] = None
    includes_manual: Optional[bool] = None
    seller_review: Optional[str] = None
    status: ItemStatus
    is_featured: bool
    no_seller: bool = False
    seller_id: Optional[int]
    received_at: Optional[datetime]
    listed_at: Optional[datetime]
    sold_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}

    @property
    def image_list(self) -> List[str]:
        if not self.images:
            return []
        return [img.strip() for img in self.images.split(",")]

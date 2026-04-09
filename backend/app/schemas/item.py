from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

from app.models.item import ItemStatus, ItemCategory, ItemCondition


class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: ItemCategory
    condition: ItemCondition
    brand: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    original_price: Optional[Decimal] = None
    selling_price: Decimal
    seller_id: int
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
    original_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    status: Optional[ItemStatus] = None
    notes: Optional[str] = None
    is_featured: Optional[bool] = None


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
    original_price: Optional[Decimal]
    selling_price: Decimal
    seller_payout: Optional[Decimal]
    commission: Optional[Decimal]
    images: Optional[str]
    status: ItemStatus
    is_featured: bool
    seller_id: int
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

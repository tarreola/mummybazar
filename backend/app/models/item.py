import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ItemStatus(str, enum.Enum):
    RECEIVED = "received"        # Seller dropped off / shipped to us
    INSPECTED = "inspected"      # We checked quality
    LISTED = "listed"            # Live on the storefront
    SOLD = "sold"                # Buyer paid
    SHIPPED = "shipped"          # Sent to buyer
    DELIVERED = "delivered"      # Confirmed delivery
    RETURNED = "returned"        # Sent back to seller
    ARCHIVED = "archived"        # Removed from catalog


class ItemCategory(str, enum.Enum):
    CLOTHING = "clothing"
    FURNITURE = "furniture"
    LACTANCY = "lactancy"
    STROLLERS = "strollers"
    TOYS = "toys"
    ACCESSORIES = "accessories"
    OTHER = "other"


class ItemCondition(str, enum.Enum):
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"


class Item(Base):
    """A unique second-hand item in the inventory."""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)  # e.g. MB-2024-00042

    # Description
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(Enum(ItemCategory), nullable=False)
    condition = Column(Enum(ItemCondition), nullable=False)
    brand = Column(String, nullable=True)
    size = Column(String, nullable=True)  # e.g. "3-6m", "Talla 2", "Universal"
    color = Column(String, nullable=True)

    # Pricing
    original_price = Column(Numeric(10, 2), nullable=True)   # What seller paid originally
    selling_price = Column(Numeric(10, 2), nullable=False)   # Our listing price
    seller_payout = Column(Numeric(10, 2), nullable=True)    # What seller gets (70%)
    commission = Column(Numeric(10, 2), nullable=True)       # Our cut (30%)

    # Images (Cloudinary public IDs, comma-separated)
    images = Column(Text, nullable=True)

    # Lifecycle
    status = Column(Enum(ItemStatus), default=ItemStatus.RECEIVED, nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=True)
    listed_at = Column(DateTime(timezone=True), nullable=True)
    sold_at = Column(DateTime(timezone=True), nullable=True)

    notes = Column(Text, nullable=True)
    is_featured = Column(Boolean, default=False)

    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    seller = relationship("Seller", back_populates="items")
    order = relationship("Order", back_populates="item", uselist=False)

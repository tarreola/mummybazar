import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class OrderStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    PREPARING = "preparing"       # Item pulled from inventory
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class ShippingMethod(str, enum.Enum):
    PICKUP = "pickup"             # Buyer picks up
    DELIVERY_CDMX = "delivery_cdmx"   # We deliver within CDMX
    PARCEL = "parcel"             # Ship via Estafeta / FedEx / etc.


class Order(Base):
    """A purchase transaction — one item per order (unique items)."""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)  # e.g. ORD-2024-00001

    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)

    # Pricing snapshot at time of purchase
    amount = Column(Numeric(10, 2), nullable=False)
    commission_amount = Column(Numeric(10, 2), nullable=False)
    seller_payout_amount = Column(Numeric(10, 2), nullable=False)

    # Payment
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING_PAYMENT, nullable=False)
    mp_payment_id = Column(String, nullable=True)        # MercadoPago payment ID
    mp_preference_id = Column(String, nullable=True)     # MercadoPago checkout preference

    # Shipping
    shipping_method = Column(Enum(ShippingMethod), nullable=True)
    shipping_address = Column(Text, nullable=True)
    tracking_number = Column(String, nullable=True)
    shipping_carrier = Column(String, nullable=True)

    # Seller payout
    seller_paid = Column(Integer, default=0)  # 0 = pending, 1 = paid
    seller_paid_at = Column(DateTime(timezone=True), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    buyer = relationship("Buyer", back_populates="orders")
    item = relationship("Item", back_populates="order")

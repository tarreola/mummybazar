from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.item import Item, ItemStatus
from app.models.order import Order, OrderStatus
from app.models.buyer import Buyer
from app.schemas.order import OrderCreate, OrderUpdate, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


def _generate_order_number(db: Session) -> str:
    from sqlalchemy import func
    year = datetime.now().year
    count = db.query(func.count(Order.id)).scalar() + 1
    return f"ORD-{year}-{count:05d}"


@router.get("/", response_model=List[OrderOut])
def list_orders(
    status: Optional[OrderStatus] = None,
    buyer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if buyer_id:
        q = q.filter(Order.buyer_id == buyer_id)
    return q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.status != ItemStatus.LISTED:
        raise HTTPException(status_code=400, detail=f"Item is not available (status: {item.status})")

    buyer = db.query(Buyer).filter(Buyer.id == payload.buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    order = Order(
        order_number=_generate_order_number(db),
        buyer_id=payload.buyer_id,
        item_id=payload.item_id,
        amount=item.selling_price,
        commission_amount=item.commission,
        seller_payout_amount=item.seller_payout,
        shipping_method=payload.shipping_method,
        shipping_address=payload.shipping_address,
        notes=payload.notes,
        status=OrderStatus.PENDING_PAYMENT,
    )
    db.add(order)

    # Mark item as sold
    item.status = ItemStatus.SOLD
    item.sold_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    data = payload.model_dump(exclude_unset=True)

    if data.get("seller_paid") == 1 and not order.seller_paid_at:
        data["seller_paid_at"] = datetime.now(timezone.utc)

    for field, value in data.items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order

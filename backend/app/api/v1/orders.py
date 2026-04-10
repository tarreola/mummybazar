from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.item import Item, ItemStatus
from app.models.order import Order, OrderStatus
from app.models.buyer import Buyer
from app.models.seller import Seller
from app.schemas.order import OrderCreate, OrderUpdate, OrderOut
from app.services.whatsapp import whatsapp_service

router = APIRouter(prefix="/orders", tags=["orders"])


def _generate_order_number(db: Session) -> str:
    from sqlalchemy import func
    year = datetime.now().year
    count = db.query(func.count(Order.id)).scalar() + 1
    return f"ORD-{year}-{count:05d}"


def _enrich(order: Order, db: Session) -> dict:
    """Return order dict with joined buyer/item/seller names."""
    d = {c.name: getattr(order, c.name) for c in order.__table__.columns}
    buyer = db.query(Buyer).filter(Buyer.id == order.buyer_id).first()
    item = db.query(Item).filter(Item.id == order.item_id).first()
    seller = db.query(Seller).filter(Seller.id == item.seller_id).first() if item else None
    d["buyer_name"] = buyer.full_name if buyer else None
    d["buyer_phone"] = buyer.phone if buyer else None
    d["item_title"] = item.title if item else None
    d["item_sku"] = item.sku if item else None
    d["seller_id"] = seller.id if seller else None
    d["seller_name"] = seller.full_name if seller else None
    d["seller_phone"] = seller.phone if seller else None
    return d


def _try_whatsapp(fn, *args, **kwargs):
    """Send WhatsApp silently — never break the order flow on WA errors."""
    try:
        fn(*args, **kwargs)
    except Exception as e:
        print(f"[WhatsApp] non-fatal error: {e}")


@router.get("/", response_model=List[OrderOut])
def list_orders(
    status: Optional[OrderStatus] = None,
    buyer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if buyer_id:
        q = q.filter(Order.buyer_id == buyer_id)
    orders = q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich(o, db) for o in orders]


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

    seller = db.query(Seller).filter(Seller.id == item.seller_id).first()

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

    # Mark item as sold immediately
    item.status = ItemStatus.SOLD
    item.sold_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    # Auto WhatsApp — buyer: order confirmed
    _try_whatsapp(
        whatsapp_service.notify_buyer_order_confirmed,
        buyer.phone, buyer.full_name, item.title, order.order_number, float(order.amount),
    )
    # Auto WhatsApp — seller: item sold
    if seller:
        _try_whatsapp(
            whatsapp_service.notify_seller_item_sold,
            seller.phone, seller.full_name, item.title, float(order.seller_payout_amount),
        )

    return _enrich(order, db)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _enrich(order, db)


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    data = payload.model_dump(exclude_unset=True)
    prev_status = order.status
    paying_seller = data.get("seller_paid") == 1 and not order.seller_paid

    if paying_seller:
        data["seller_paid_at"] = datetime.now(timezone.utc)

    for field, value in data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)

    # ── Auto WhatsApp triggers ────────────────────────────────────────────────
    new_status = order.status
    if new_status != prev_status:
        buyer = db.query(Buyer).filter(Buyer.id == order.buyer_id).first()
        item = db.query(Item).filter(Item.id == order.item_id).first()
        title = item.title if item else "tu artículo"

        if new_status == OrderStatus.PAID and buyer:
            _try_whatsapp(
                whatsapp_service.notify_buyer_order_confirmed,
                buyer.phone, buyer.full_name, title, order.order_number, float(order.amount),
            )

        elif new_status == OrderStatus.SHIPPED and buyer:
            _try_whatsapp(
                whatsapp_service.notify_buyer_order_shipped,
                buyer.phone, buyer.full_name, title, order.order_number,
                order.tracking_number or "—", order.shipping_carrier or "paquetería",
            )

        elif new_status == OrderStatus.DELIVERED and buyer:
            _try_whatsapp(
                whatsapp_service.notify_buyer_order_delivered,
                buyer.phone, buyer.full_name, title,
            )

        elif new_status == OrderStatus.CANCELLED:
            # Restore item to listed so it can be sold again
            if item:
                item.status = ItemStatus.LISTED
                item.sold_at = None
                db.commit()
            if buyer:
                _try_whatsapp(
                    whatsapp_service.send,
                    buyer.phone,
                    f"Tu pedido *{order.order_number}* ({title}) ha sido cancelado. "
                    f"Si tienes dudas escríbenos, con gusto te ayudamos 🌸",
                )

    # ── Seller payout notification ─────────────────────────────────────────────
    if paying_seller:
        item = db.query(Item).filter(Item.id == order.item_id).first()
        seller = db.query(Seller).filter(Seller.id == item.seller_id).first() if item else None
        if seller and item:
            _try_whatsapp(
                whatsapp_service.notify_seller_payout_sent,
                seller.phone, seller.full_name, item.title, float(order.seller_payout_amount),
            )

    return _enrich(order, db)

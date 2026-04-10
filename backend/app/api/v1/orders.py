from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.item import Item, ItemStatus
from app.models.order import Order, OrderStatus
from app.models.seller import Seller as SellerModel
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
    """Return order dict with joined item/seller fields."""
    d = {c.name: getattr(order, c.name) for c in order.__table__.columns}
    item = db.query(Item).filter(Item.id == order.item_id).first()
    seller = db.query(Seller).filter(Seller.id == item.seller_id).first() if item else None
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


def _upsert_buyer(db: Session, name: str, phone: str, whatsapp: str, email: Optional[str]) -> Buyer:
    """Find or create a buyer contact by phone number."""
    buyer = db.query(Buyer).filter(Buyer.phone == phone).first()
    if buyer:
        # Update info if changed
        buyer.full_name = name
        buyer.whatsapp = whatsapp
        if email:
            buyer.email = email
    else:
        buyer = Buyer(full_name=name, phone=phone, whatsapp=whatsapp, email=email)
        db.add(buyer)
    db.flush()
    return buyer


@router.get("/", response_model=List[OrderOut])
def list_orders(
    status: Optional[OrderStatus] = None,
    buyer_phone: Optional[str] = None,
    seller_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if buyer_phone:
        q = q.filter(Order.buyer_phone.ilike(f"%{buyer_phone}%"))
    if seller_id:
        # Join through items to filter by seller
        from sqlalchemy import exists
        q = q.filter(
            exists().where(
                (Item.id == Order.item_id) & (Item.seller_id == seller_id)
            )
        )
    orders = q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich(o, db) for o in orders]


@router.post("/", response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.status != ItemStatus.LISTED:
        raise HTTPException(status_code=400, detail=f"Item is not available (status: {item.status})")

    seller = db.query(Seller).filter(Seller.id == item.seller_id).first()
    wa = payload.buyer_whatsapp or payload.buyer_phone

    # Auto-create or update buyer contact in directory
    buyer = _upsert_buyer(db, payload.buyer_name, payload.buyer_phone, wa, payload.buyer_email)

    order = Order(
        order_number=_generate_order_number(db),
        buyer_id=buyer.id,
        buyer_name=payload.buyer_name,
        buyer_phone=payload.buyer_phone,
        buyer_whatsapp=wa,
        buyer_email=payload.buyer_email,
        item_id=payload.item_id,
        amount=item.selling_price,
        commission_amount=item.commission,
        seller_payout_amount=item.seller_payout,
        shipping_method=payload.shipping_method,
        shipping_address=payload.shipping_address,
        notes=payload.notes,
        status=OrderStatus.PENDING_PAYMENT,
        status_changed_at=datetime.now(timezone.utc),
    )
    db.add(order)

    # Mark item as sold immediately
    item.status = ItemStatus.SOLD
    item.sold_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    # Auto WhatsApp — buyer
    _try_whatsapp(
        whatsapp_service.notify_buyer_order_confirmed,
        wa, payload.buyer_name, item.title, order.order_number, float(order.amount),
    )
    # Auto WhatsApp — seller
    if seller:
        _try_whatsapp(
            whatsapp_service.notify_seller_item_sold,
            seller.phone, seller.full_name, item.title, float(order.seller_payout_amount),
        )

    return _enrich(order, db)


@router.post("/{order_id}/request-delivery-confirm")
def request_delivery_confirm(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Manually send the day-6 delivery confirmation request to the buyer via WhatsApp."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.SHIPPED:
        raise HTTPException(status_code=400, detail="Only shipped orders can request confirmation")
    buyer_phone = order.buyer_whatsapp or order.buyer_phone
    if not buyer_phone:
        raise HTTPException(status_code=400, detail="No phone number on this order")
    item = db.query(Item).filter(Item.id == order.item_id).first()
    title = item.title if item else "tu artículo"
    _try_whatsapp(
        whatsapp_service.notify_buyer_delivery_confirm,
        buyer_phone, order.buyer_name or "Clienta", order.order_number, title,
    )
    return {"ok": True, "message": "Delivery confirmation request sent"}


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
        # Auto-close: once seller is paid on a shipped order, close automatically
        if order.status in (OrderStatus.SHIPPED, OrderStatus.DELIVERED):
            data["status"] = OrderStatus.CLOSED

    # Track when status changes
    if "status" in data and data["status"] != prev_status:
        data["status_changed_at"] = datetime.now(timezone.utc)

    for field, value in data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)

    # ── Auto WhatsApp triggers ────────────────────────────────────────────────
    new_status = order.status
    buyer_phone = order.buyer_whatsapp or order.buyer_phone
    buyer_name = order.buyer_name or "Clienta"

    if new_status != prev_status:
        item = db.query(Item).filter(Item.id == order.item_id).first()
        title = item.title if item else "tu artículo"

        if new_status == OrderStatus.PAID and buyer_phone:
            _try_whatsapp(
                whatsapp_service.notify_buyer_order_confirmed,
                buyer_phone, buyer_name, title, order.order_number, float(order.amount),
            )

        elif new_status == OrderStatus.SHIPPED and buyer_phone:
            _try_whatsapp(
                whatsapp_service.notify_buyer_order_shipped,
                buyer_phone, buyer_name, title, order.order_number,
                order.tracking_number or "—", order.shipping_carrier or "paquetería",
            )

        elif new_status == OrderStatus.DELIVERED and buyer_phone:
            # Send delivery confirmation request to buyer
            _try_whatsapp(
                whatsapp_service.notify_buyer_order_delivered,
                buyer_phone, buyer_name, title, order.order_number,
            )

        elif new_status == OrderStatus.CLOSED:
            pass  # No WhatsApp — closing is an internal admin action

        elif new_status == OrderStatus.CANCELLED:
            if item:
                item.status = ItemStatus.LISTED
                item.sold_at = None
                db.commit()
            if buyer_phone:
                _try_whatsapp(
                    whatsapp_service.send,
                    buyer_phone,
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

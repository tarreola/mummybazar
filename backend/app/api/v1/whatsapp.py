from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.whatsapp import WhatsAppMessage, MessageDirection, MessageType
from app.models.seller import Seller
from app.models.buyer import Buyer
from app.models.item import Item, ItemStatus
from app.models.order import Order, OrderStatus
from app.schemas.whatsapp import SendMessageRequest, WhatsAppMessageOut
from app.services.whatsapp import whatsapp_service

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class CampaignRequest(BaseModel):
    audience: str          # "sellers", "buyers", "all_sellers", "all_buyers"
    body: str
    audience_ids: Optional[List[int]] = None  # specific IDs, or None = all


def _log_message(db: Session, to_number: str, body: str, result: dict,
                 seller_id=None, buyer_id=None, order_id=None, msg_type=MessageType.MANUAL):
    msg = WhatsAppMessage(
        to_number=to_number,
        body=body,
        direction=MessageDirection.OUTBOUND,
        message_type=msg_type,
        twilio_sid=result.get("sid"),
        status=result.get("status", "sent"),
        seller_id=seller_id,
        buyer_id=buyer_id,
        order_id=order_id,
    )
    db.add(msg)
    return msg


@router.post("/send", response_model=WhatsAppMessageOut)
def send_message(payload: SendMessageRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    result = whatsapp_service.send(payload.to_number, payload.body)
    msg = _log_message(db, payload.to_number, payload.body, result,
                       seller_id=payload.seller_id, buyer_id=payload.buyer_id,
                       order_id=payload.order_id, msg_type=payload.message_type)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/campaign")
def send_campaign(payload: CampaignRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Send a message to a group: all sellers, all buyers, or specific IDs."""
    sent, failed = 0, 0
    recipients: list = []

    if payload.audience in ("sellers", "all_sellers"):
        q = db.query(Seller).filter(Seller.is_active == True)
        if payload.audience_ids:
            q = q.filter(Seller.id.in_(payload.audience_ids))
        for s in q.all():
            recipients.append(("seller", s.id, None, s.phone))
    elif payload.audience in ("buyers", "all_buyers"):
        q = db.query(Buyer).filter(Buyer.is_active == True)
        if payload.audience_ids:
            q = q.filter(Buyer.id.in_(payload.audience_ids))
        for b in q.all():
            recipients.append(("buyer", None, b.id, b.phone))

    for kind, seller_id, buyer_id, phone in recipients:
        try:
            result = whatsapp_service.send(phone, payload.body)
            _log_message(db, phone, payload.body, result,
                         seller_id=seller_id, buyer_id=buyer_id,
                         msg_type=MessageType.MARKETING)
            sent += 1
        except Exception:
            failed += 1

    db.commit()
    return {"sent": sent, "failed": failed, "total": len(recipients)}


@router.post("/remind-stagnant")
def remind_stagnant_inventory(days: int = 30, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Send WhatsApp reminder to sellers whose items have been listed > X days without selling."""
    threshold = datetime.now(timezone.utc) - timedelta(days=days)
    stagnant = (
        db.query(Item)
        .filter(Item.status == ItemStatus.LISTED, Item.listed_at <= threshold)
        .all()
    )

    # Group by seller
    by_seller: dict[int, list] = {}
    for item in stagnant:
        by_seller.setdefault(item.seller_id, []).append(item)

    sent, failed = 0, 0
    for seller_id, items in by_seller.items():
        seller = db.query(Seller).filter(Seller.id == seller_id).first()
        if not seller:
            continue
        titles = ", ".join(f"*{i.title}*" for i in items[:3])
        extra = f" y {len(items) - 3} más" if len(items) > 3 else ""
        body = (
            f"Hola {seller.full_name} 🌸 Queremos recordarte que tienes "
            f"{len(items)} artículo(s) sin vender hace más de {days} días: "
            f"{titles}{extra}. ¿Quieres ajustar el precio o retirarlos? "
            f"Escríbenos y con gusto te ayudamos. 💕"
        )
        try:
            result = whatsapp_service.send(seller.phone, body)
            _log_message(db, seller.phone, body, result, seller_id=seller_id,
                         msg_type=MessageType.MARKETING)
            sent += 1
        except Exception:
            failed += 1

    db.commit()
    return {"sent": sent, "failed": failed, "sellers_notified": len(by_seller)}


@router.post("/remind-payment/{order_id}")
def remind_payment(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Send payment reminder to a buyer for a pending order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail="Order is not pending payment")

    buyer = db.query(Buyer).filter(Buyer.id == order.buyer_id).first()
    item = db.query(Item).filter(Item.id == order.item_id).first()

    body = (
        f"Hola {buyer.full_name} 💌 Tu pedido *{order.order_number}* "
        f"({item.title if item else 'artículo'}) por *${float(order.amount):,.0f} MXN* "
        f"está pendiente de pago. ¿Necesitas ayuda para completarlo? "
        f"Estamos aquí para apoyarte. 🌸"
    )
    result = whatsapp_service.send(buyer.phone, body)
    msg = _log_message(db, buyer.phone, body, result, buyer_id=buyer.id,
                       order_id=order_id, msg_type=MessageType.TEMPLATE)
    db.commit()
    db.refresh(msg)
    return {"sent": True, "to": buyer.phone, "order": order.order_number}


@router.post("/notify-order-status/{order_id}")
def notify_order_status(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Send automatic WhatsApp update to buyer when order status changes."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    buyer = db.query(Buyer).filter(Buyer.id == order.buyer_id).first()
    item = db.query(Item).filter(Item.id == order.item_id).first()
    title = item.title if item else "tu artículo"

    messages = {
        OrderStatus.PAID: f"✅ Confirmamos tu pago del pedido *{order.order_number}* ({title}). ¡Gracias!",
        OrderStatus.PREPARING: f"📦 Estamos preparando tu pedido *{order.order_number}* ({title}). Pronto lo enviamos.",
        OrderStatus.SHIPPED: (
            f"🚚 Tu pedido *{order.order_number}* ({title}) está en camino."
            + (f" Rastreo: *{order.tracking_number}* ({order.shipping_carrier})." if order.tracking_number else "")
        ),
        OrderStatus.DELIVERED: f"🎉 ¡Tu pedido llegó! Esperamos que te encante *{title}*. Gracias por confiar en MommyBazar 💕",
        OrderStatus.CANCELLED: f"Tu pedido *{order.order_number}* ha sido cancelado. Contáctanos si tienes dudas.",
    }

    body = messages.get(order.status)
    if not body:
        raise HTTPException(status_code=400, detail=f"No notification defined for status: {order.status}")

    result = whatsapp_service.send(buyer.phone, body)
    msg = _log_message(db, buyer.phone, body, result, buyer_id=buyer.id,
                       order_id=order_id, msg_type=MessageType.TEMPLATE)
    db.commit()
    return {"sent": True, "status": order.status, "to": buyer.phone}


@router.get("/messages", response_model=List[WhatsAppMessageOut])
def list_messages(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(WhatsAppMessage).order_by(WhatsAppMessage.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/webhook")
async def twilio_webhook(request: Request, db: Session = Depends(get_db)):
    """Receives inbound WhatsApp replies from Twilio."""
    form = await request.form()
    from_number = str(form.get("From", "")).replace("whatsapp:", "")
    body = str(form.get("Body", ""))
    sid = str(form.get("MessageSid", ""))

    if from_number and body:
        msg = WhatsAppMessage(
            to_number="platform",
            from_number=from_number,
            body=body,
            direction=MessageDirection.INBOUND,
            message_type=MessageType.MANUAL,
            twilio_sid=sid,
            status="received",
        )
        db.add(msg)
        db.commit()
    return {"status": "ok"}

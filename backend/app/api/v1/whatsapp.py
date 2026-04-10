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
from app.services.whatsapp import whatsapp_service, TEMPLATES, ORDER_STATUS_LABELS

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


# ── Request models ─────────────────────────────────────────────────────────────
class CampaignRequest(BaseModel):
    audience: str                         # "all_sellers" | "all_buyers"
    body: str                             # Free-form or template body
    template_key: Optional[str] = None   # If set, use template (body ignored)
    promo_item_ids: Optional[List[int]] = None  # Items to include in promo campaign
    audience_ids: Optional[List[int]] = None    # Specific IDs, None = all


class TemplatePreviewRequest(BaseModel):
    template_key: str
    variables: dict = {}


# ── Helpers ────────────────────────────────────────────────────────────────────
def _log_message(db, to_number, body, result, seller_id=None, buyer_id=None,
                 order_id=None, msg_type=MessageType.MANUAL):
    msg = WhatsAppMessage(
        to_number=to_number, body=body,
        direction=MessageDirection.OUTBOUND,
        message_type=msg_type,
        twilio_sid=result.get("sid"),
        status=result.get("status", "sent"),
        seller_id=seller_id, buyer_id=buyer_id, order_id=order_id,
    )
    db.add(msg)
    return msg


def _try_send(db, phone, body, seller_id=None, buyer_id=None,
              order_id=None, msg_type=MessageType.TEMPLATE):
    """Send and log — returns (success: bool)."""
    try:
        result = whatsapp_service.send(phone, body)
        _log_message(db, phone, body, result,
                     seller_id=seller_id, buyer_id=buyer_id,
                     order_id=order_id, msg_type=msg_type)
        return True
    except Exception as e:
        print(f"[WhatsApp] send failed to {phone}: {e}")
        return False


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(_=Depends(get_current_user)):
    """Return all available templates with their keys and preview text."""
    groups = {
        "seller": ["seller_welcome", "seller_item_received", "seller_item_listed",
                   "seller_item_sold", "seller_payout_sent"],
        "buyer": ["buyer_welcome", "buyer_order_confirmed", "buyer_order_shipped",
                  "buyer_order_delivered", "buyer_delivery_confirm"],
        "campaign": ["campaign_promo", "campaign_general", "reminder_stagnant"],
    }
    result = {}
    for group, keys in groups.items():
        result[group] = [{"key": k, "body": TEMPLATES[k]} for k in keys if k in TEMPLATES]
    return result


@router.post("/template-preview")
def preview_template(payload: TemplatePreviewRequest, _=Depends(get_current_user)):
    """Render a template with given variables (for live preview in UI)."""
    if payload.template_key not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    try:
        rendered = whatsapp_service.render_template(payload.template_key, **payload.variables)
        return {"rendered": rendered}
    except KeyError as e:
        return {"rendered": TEMPLATES[payload.template_key], "missing_var": str(e)}


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
    """Bulk send to sellers or buyers. Supports promo items list."""
    sent, failed = 0, 0
    recipients: list = []

    if payload.audience == "all_sellers":
        q = db.query(Seller).filter(Seller.is_active == True)
        if payload.audience_ids:
            q = q.filter(Seller.id.in_(payload.audience_ids))
        for s in q.all():
            recipients.append(("seller", s.id, None, s.phone, s.full_name))
    elif payload.audience == "all_buyers":
        q = db.query(Buyer).filter(Buyer.is_active == True)
        if payload.audience_ids:
            q = q.filter(Buyer.id.in_(payload.audience_ids))
        for b in q.all():
            recipients.append(("buyer", None, b.id, b.phone, b.full_name))

    # Build promo items block if provided
    promo_block = ""
    if payload.promo_item_ids:
        items = db.query(Item).filter(Item.id.in_(payload.promo_item_ids)).all()
        lines = [f"• *{i.title}* — ${float(i.selling_price):,.0f} MXN" for i in items]
        if lines:
            promo_block = "\n".join(lines) + "\n"

    for kind, seller_id, buyer_id, phone, name in recipients:
        # Build personalized body
        if payload.template_key == "campaign_promo" and promo_block:
            body = whatsapp_service.render_template(
                "campaign_promo", name=name, promo_items=promo_block
            )
        elif payload.template_key == "campaign_general":
            body = whatsapp_service.render_template(
                "campaign_general", name=name, body=payload.body
            )
        else:
            # Free-form with optional {nombre} substitution
            body = payload.body.replace("{nombre}", name).replace("{name}", name)

        ok = _try_send(db, phone, body,
                       seller_id=seller_id, buyer_id=buyer_id,
                       msg_type=MessageType.MARKETING)
        if ok:
            sent += 1
        else:
            failed += 1

    db.commit()
    return {"sent": sent, "failed": failed, "total": len(recipients)}


@router.post("/remind-stagnant")
def remind_stagnant_inventory(days: int = 30, db: Session = Depends(get_db), _=Depends(get_current_user)):
    threshold = datetime.now(timezone.utc) - timedelta(days=days)
    stagnant = (
        db.query(Item)
        .filter(Item.status == ItemStatus.LISTED, Item.listed_at <= threshold)
        .all()
    )
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
        body = whatsapp_service.render_template(
            "reminder_stagnant",
            name=seller.full_name,
            count=len(items),
            days=days,
            titles=titles + extra,
        )
        ok = _try_send(db, seller.phone, body, seller_id=seller_id,
                       msg_type=MessageType.MARKETING)
        if ok:
            sent += 1
        else:
            failed += 1

    db.commit()
    return {"sent": sent, "failed": failed, "sellers_notified": len(by_seller)}


@router.post("/remind-payment/{order_id}")
def remind_payment(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
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
        f"Estamos aquí para ti. 🌸"
    )
    result = whatsapp_service.send(buyer.phone, body)
    msg = _log_message(db, buyer.phone, body, result, buyer_id=buyer.id,
                       order_id=order_id, msg_type=MessageType.TEMPLATE)
    db.commit()
    db.refresh(msg)
    return {"sent": True, "to": buyer.phone, "order": order.order_number}


@router.post("/notify-order-status/{order_id}")
def notify_order_status(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Manual trigger for order status notification (auto-triggers happen in orders router)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    buyer = db.query(Buyer).filter(Buyer.id == order.buyer_id).first()
    item = db.query(Item).filter(Item.id == order.item_id).first()
    title = item.title if item else "tu artículo"

    messages_map = {
        OrderStatus.PAID: f"✅ Confirmamos tu pago del pedido *{order.order_number}* ({title}). ¡Gracias, {buyer.full_name}!",
        OrderStatus.PREPARING: f"📦 Estamos preparando tu pedido *{order.order_number}* ({title}). Pronto lo enviamos. 🌸",
        OrderStatus.SHIPPED: (
            f"🚚 Tu pedido *{order.order_number}* ({title}) está en camino, {buyer.full_name}!"
            + (f" Rastreo: *{order.tracking_number}* ({order.shipping_carrier})." if order.tracking_number else "")
        ),
        OrderStatus.DELIVERED: f"🎀 ¡Tu pedido llegó! Esperamos que te encante *{title}*, {buyer.full_name}. ¡Gracias por ser parte de MommyBazar! 💕",
        OrderStatus.CANCELLED: f"Tu pedido *{order.order_number}* ha sido cancelado. Contáctanos si tienes dudas. 🌸",
    }

    body = messages_map.get(order.status)
    if not body:
        raise HTTPException(status_code=400, detail=f"No notification defined for status: {order.status}")

    result = whatsapp_service.send(buyer.phone, body)
    msg = _log_message(db, buyer.phone, body, result, buyer_id=buyer.id,
                       order_id=order_id, msg_type=MessageType.TEMPLATE)
    db.commit()
    return {"sent": True, "status": order.status, "to": buyer.phone}


@router.get("/order-labels")
def get_order_labels(_=Depends(get_current_user)):
    """Return the WhatsApp label map for order statuses (for UI display)."""
    return ORDER_STATUS_LABELS


@router.get("/messages", response_model=List[WhatsAppMessageOut])
def list_messages(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), _=Depends(get_current_user)):
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

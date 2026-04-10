"""
Public storefront API — no admin auth required.
Buyers and sellers authenticate with their own JWT (role: buyer | seller).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import json

from app.core.database import get_db
from app.core.security import create_access_token, verify_token
from app.core.config import settings
from app.models.buyer import Buyer
from app.models.seller import Seller
from app.models.item import Item, ItemStatus, ItemCategory
from app.models.order import Order, OrderStatus
from app.services.mercadopago import mp_service
from app.services.whatsapp import whatsapp_service

router = APIRouter(prefix="/storefront", tags=["storefront"])
bearer = HTTPBearer(auto_error=False)


# ── Storefront JWT helpers ─────────────────────────────────────────────────────
def _make_token(role: str, user_id: int) -> str:
    return create_access_token({"sub": f"{role}:{user_id}", "role": role})


def _get_storefront_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")
    sub = payload.get("sub", "")
    role, _, uid = sub.partition(":")
    if not uid:
        raise HTTPException(status_code=401, detail="Token inválido")
    if role == "buyer":
        user = db.query(Buyer).filter(Buyer.id == int(uid)).first()
    elif role == "seller":
        user = db.query(Seller).filter(Seller.id == int(uid)).first()
    else:
        raise HTTPException(status_code=401, detail="Rol desconocido")
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return {"role": role, "user": user}


def _require_buyer(ctx=Depends(_get_storefront_user)):
    if ctx["role"] != "buyer":
        raise HTTPException(status_code=403, detail="Solo compradoras")
    return ctx["user"]


def _require_seller(ctx=Depends(_get_storefront_user)):
    if ctx["role"] != "seller":
        raise HTTPException(status_code=403, detail="Solo vendedoras")
    return ctx["user"]


# ── Request / Response schemas ────────────────────────────────────────────────
class RegisterBuyerRequest(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    password: str
    neighborhood: Optional[str] = None
    city: Optional[str] = "Ciudad de México"


class RegisterSellerRequest(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    password: str
    neighborhood: Optional[str] = None
    city: Optional[str] = "Ciudad de México"
    bank_name: Optional[str] = None
    clabe: Optional[str] = None


class LoginRequest(BaseModel):
    phone: str
    password: str
    role: str   # "buyer" | "seller"


class CheckoutRequest(BaseModel):
    item_id: int
    shipping_method: Optional[str] = None
    shipping_address: Optional[str] = None


# ── Catalog (public, no auth) ─────────────────────────────────────────────────
@router.get("/items")
def catalog(
    category: Optional[str] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    skip: int = 0,
    limit: int = 40,
    db: Session = Depends(get_db),
):
    q = db.query(Item).filter(Item.status == ItemStatus.LISTED)
    if category:
        q = q.filter(Item.category == category)
    if condition:
        q = q.filter(Item.condition == condition)
    if min_price is not None:
        q = q.filter(Item.selling_price >= min_price)
    if max_price is not None:
        q = q.filter(Item.selling_price <= max_price)
    if search:
        q = q.filter(
            Item.title.ilike(f"%{search}%") |
            Item.brand.ilike(f"%{search}%") |
            Item.description.ilike(f"%{search}%")
        )
    if featured:
        q = q.filter(Item.is_featured == True)

    # Featured first, then newest
    items = q.order_by(Item.is_featured.desc(), Item.listed_at.desc()).offset(skip).limit(limit).all()
    total = q.count()

    return {
        "items": [_item_out(i) for i in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/items/{item_id}")
def item_detail(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id, Item.status == ItemStatus.LISTED).first()
    if not item:
        raise HTTPException(status_code=404, detail="Artículo no disponible")
    return _item_out(item, full=True)


def _item_out(item: Item, full=False) -> dict:
    images = [u for u in (item.images or "").split(",") if u]
    d = {
        "id": item.id,
        "sku": item.sku,
        "title": item.title,
        "category": item.category.value,
        "condition": item.condition.value,
        "brand": item.brand,
        "size": item.size,
        "color": item.color,
        "selling_price": float(item.selling_price),
        "images": images,
        "is_featured": item.is_featured,
        "listed_at": item.listed_at.isoformat() if item.listed_at else None,
    }
    if full:
        d["description"] = item.description
        d["original_price"] = float(item.original_price) if item.original_price else None
    return d


# ── Registration ──────────────────────────────────────────────────────────────
@router.post("/register/buyer")
def register_buyer(payload: RegisterBuyerRequest, db: Session = Depends(get_db)):
    from app.core.security import hash_password
    if db.query(Buyer).filter(Buyer.phone == payload.phone).first():
        raise HTTPException(status_code=400, detail="Este número ya está registrado")
    buyer = Buyer(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        neighborhood=payload.neighborhood,
        city=payload.city or "Ciudad de México",
        password_hash=hash_password(payload.password),
        is_active=True,
        is_approved=False,
    )
    db.add(buyer)
    db.commit()
    db.refresh(buyer)

    # Welcome WhatsApp
    try:
        whatsapp_service.notify_buyer_welcome(buyer.phone, buyer.full_name)
    except Exception:
        pass

    token = _make_token("buyer", buyer.id)
    return {"access_token": token, "role": "buyer", "name": buyer.full_name, "is_approved": buyer.is_approved}


@router.post("/register/seller")
def register_seller(payload: RegisterSellerRequest, db: Session = Depends(get_db)):
    from app.core.security import hash_password
    if db.query(Seller).filter(Seller.phone == payload.phone).first():
        raise HTTPException(status_code=400, detail="Este número ya está registrado")
    seller = Seller(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        neighborhood=payload.neighborhood,
        city=payload.city or "Ciudad de México",
        bank_name=payload.bank_name,
        clabe=payload.clabe,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_approved=False,
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)

    # Welcome WhatsApp
    try:
        whatsapp_service.notify_seller_welcome(seller.phone, seller.full_name)
    except Exception:
        pass

    token = _make_token("seller", seller.id)
    return {"access_token": token, "role": "seller", "name": seller.full_name, "is_approved": seller.is_approved}


@router.post("/login")
def storefront_login(payload: LoginRequest, db: Session = Depends(get_db)):
    from app.core.security import verify_password
    if payload.role == "buyer":
        user = db.query(Buyer).filter(Buyer.phone == payload.phone).first()
    elif payload.role == "seller":
        user = db.query(Seller).filter(Seller.phone == payload.phone).first()
    else:
        raise HTTPException(status_code=400, detail="Rol inválido")

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Número o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    token = _make_token(payload.role, user.id)
    return {
        "access_token": token,
        "role": payload.role,
        "name": user.full_name,
        "is_approved": user.is_approved,
    }


# ── Checkout (buyer auth required) ────────────────────────────────────────────
@router.post("/checkout")
def create_checkout(
    payload: CheckoutRequest,
    request: Request,
    buyer: Buyer = Depends(_require_buyer),
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == payload.item_id, Item.status == ItemStatus.LISTED).first()
    if not item:
        raise HTTPException(status_code=404, detail="Artículo no disponible")

    # Generate order number
    year = datetime.now().year
    count = db.query(func.count(Order.id)).scalar() + 1
    order_number = f"ORD-{year}-{count:05d}"

    # Build MercadoPago back URLs
    base = str(request.base_url).rstrip("/")
    # Storefront URLs — the frontend handles these routes
    back_urls = {
        "success": f"http://localhost:5174/pago/exitoso?order={order_number}",
        "failure": f"http://localhost:5174/pago/fallido?order={order_number}",
        "pending": f"http://localhost:5174/pago/pendiente?order={order_number}",
    }

    try:
        pref = mp_service.create_preference(
            order_number=order_number,
            item_title=item.title,
            amount=float(item.selling_price),
            buyer_email=buyer.email or f"{buyer.phone.replace('+', '')}@mommybazar.mx",
            back_urls=back_urls,
        )
        mp_preference_id = pref["id"]
        checkout_url = pref["init_point"]  # Live URL
        # sandbox_url = pref["sandbox_init_point"]  # Test URL
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error MercadoPago: {str(e)}")

    # Create order immediately (pending_payment state)
    order = Order(
        order_number=order_number,
        buyer_id=buyer.id,
        item_id=item.id,
        amount=item.selling_price,
        commission_amount=item.commission,
        seller_payout_amount=item.seller_payout,
        shipping_method=payload.shipping_method,
        shipping_address=payload.shipping_address,
        status=OrderStatus.PENDING_PAYMENT,
        mp_preference_id=mp_preference_id,
    )
    db.add(order)

    # Reserve item immediately so no double-sell
    item.status = ItemStatus.SOLD
    item.sold_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    return {
        "order_number": order_number,
        "checkout_url": checkout_url,
        "mp_preference_id": mp_preference_id,
        "amount": float(item.selling_price),
    }


# ── MercadoPago webhook ───────────────────────────────────────────────────────
@router.post("/mp-webhook")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    MercadoPago sends payment notifications here.
    On approval: mark order PAID, notify buyer+seller via WhatsApp.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    payment_id = None
    # MP sends type=payment with data.id
    if body.get("type") == "payment":
        payment_id = str(body.get("data", {}).get("id", ""))
    # Also handle query param (older MP format)
    if not payment_id:
        payment_id = request.query_params.get("id") or request.query_params.get("data.id")

    if not payment_id:
        return {"status": "ignored"}

    try:
        payment = mp_service.get_payment(payment_id)
    except Exception:
        return {"status": "payment_fetch_error"}

    if payment.get("status") != "approved":
        return {"status": "not_approved", "mp_status": payment.get("status")}

    external_ref = payment.get("external_reference")  # order_number
    if not external_ref:
        return {"status": "no_external_reference"}

    order = db.query(Order).filter(Order.order_number == external_ref).first()
    if not order:
        return {"status": "order_not_found"}

    if order.status != OrderStatus.PENDING_PAYMENT:
        return {"status": "already_processed"}

    # Mark order paid
    order.status = OrderStatus.PAID
    order.mp_payment_id = payment_id
    db.commit()

    # WhatsApp notifications
    buyer = db.query(Buyer).filter(Buyer.id == order.buyer_id).first()
    item = db.query(Item).filter(Item.id == order.item_id).first()
    seller = db.query(Seller).filter(Seller.id == item.seller_id).first() if item else None

    if buyer and item:
        try:
            whatsapp_service.notify_buyer_order_confirmed(
                buyer.phone, buyer.full_name, item.title,
                order.order_number, float(order.amount),
            )
        except Exception:
            pass

    if seller and item:
        try:
            whatsapp_service.notify_seller_item_sold(
                seller.phone, seller.full_name, item.title,
                float(order.seller_payout_amount),
            )
        except Exception:
            pass

    return {"status": "ok", "order": external_ref}


# ── Buyer: my orders ──────────────────────────────────────────────────────────
@router.get("/my-orders")
def my_orders(buyer: Buyer = Depends(_require_buyer), db: Session = Depends(get_db)):
    orders = (
        db.query(Order)
        .filter(Order.buyer_id == buyer.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for o in orders:
        item = db.query(Item).filter(Item.id == o.item_id).first()
        images = [u for u in (item.images or "").split(",") if u] if item else []
        result.append({
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status.value,
            "amount": float(o.amount),
            "shipping_method": o.shipping_method.value if o.shipping_method else None,
            "tracking_number": o.tracking_number,
            "shipping_carrier": o.shipping_carrier,
            "created_at": o.created_at.isoformat(),
            "item": {
                "id": item.id if item else None,
                "title": item.title if item else "—",
                "sku": item.sku if item else "—",
                "image": images[0] if images else None,
            } if item else None,
        })
    return result


# ── Seller: my items ──────────────────────────────────────────────────────────
@router.get("/my-items")
def my_items(seller: Seller = Depends(_require_seller), db: Session = Depends(get_db)):
    items = (
        db.query(Item)
        .filter(Item.seller_id == seller.id)
        .order_by(Item.created_at.desc())
        .all()
    )
    return [_item_out(i, full=True) | {"status": i.status.value} for i in items]


# ── Profile ───────────────────────────────────────────────────────────────────
@router.get("/me")
def get_me(ctx=Depends(_get_storefront_user)):
    user = ctx["user"]
    return {
        "role": ctx["role"],
        "id": user.id,
        "full_name": user.full_name,
        "phone": user.phone,
        "email": getattr(user, "email", None),
        "is_approved": user.is_approved,
        "created_at": user.created_at.isoformat(),
    }

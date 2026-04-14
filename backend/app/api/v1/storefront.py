"""
Public storefront API — no admin auth required.
Buyers and sellers authenticate with their own JWT (role: buyer | seller).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File
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
from app.models.item import Item, ItemStatus, ItemCategory, ItemCondition
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


class SubmitItemRequest(BaseModel):
    title: str
    category: str
    condition: str
    brand: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    selling_price: Optional[float] = None


class CheckoutRequest(BaseModel):
    item_id: int
    shipping_method: Optional[str] = None
    shipping_address: Optional[str] = None


class CartCheckoutRequest(BaseModel):
    item_ids: List[int]
    shipping_method: Optional[str] = None
    shipping_address: Optional[str] = None


class GuestCheckoutRequest(BaseModel):
    item_ids: List[int]
    full_name: str
    phone: str
    email: Optional[str] = None


# ── Order tracking (public, no auth) ─────────────────────────────────────────
@router.get("/order-tracking/{order_number}")
def order_tracking(order_number: str, db: Session = Depends(get_db)):
    """Public endpoint — buyer looks up their order by number, no login required."""
    order = db.query(Order).filter(Order.order_number == order_number.upper()).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    item = db.query(Item).filter(Item.id == order.item_id).first()
    images = [u for u in (item.images or "").split(",") if u] if item else []
    return {
        "order_number": order.order_number,
        "status": order.status.value,
        "buyer_name": order.buyer_name,
        "amount": float(order.amount),
        "shipping_method": order.shipping_method.value if order.shipping_method else None,
        "tracking_number": order.tracking_number,
        "shipping_carrier": order.shipping_carrier,
        "created_at": order.created_at.isoformat(),
        "item": {
            "title": item.title if item else "—",
            "sku": item.sku if item else "—",
            "image": images[0] if images else None,
        },
    }


# ── Catalog (public, no auth) ─────────────────────────────────────────────────
@router.get("/items")
def catalog(
    category: Optional[str] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    gender: Optional[str] = None,
    size: Optional[str] = None,
    has_discount: bool = False,
    sort: Optional[str] = None,
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
    if gender:
        q = q.filter(Item.gender == gender)
    if size:
        q = q.filter(Item.size == size)
    if has_discount:
        q = q.filter(Item.original_price.isnot(None), Item.original_price > Item.selling_price)

    if sort == 'price_asc':
        q = q.order_by(Item.selling_price.asc())
    elif sort == 'price_desc':
        q = q.order_by(Item.selling_price.desc())
    else:
        q = q.order_by(Item.is_featured.desc(), Item.listed_at.desc())

    total = q.count()
    items = q.offset(skip).limit(limit).all()

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
        "original_price": float(item.original_price) if item.original_price else None,
        "gender": item.gender.value if item.gender else None,
        "images": images,
        "is_featured": item.is_featured,
        "listed_at": item.listed_at.isoformat() if item.listed_at else None,
    }
    if full:
        d["description"] = item.description
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


# ── Cart checkout (buyer auth, multiple items) ────────────────────────────────
@router.post("/checkout-cart")
def create_cart_checkout(
    payload: CartCheckoutRequest,
    request: Request,
    buyer: Buyer = Depends(_require_buyer),
    db: Session = Depends(get_db),
):
    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    # Load all available items
    items = db.query(Item).filter(
        Item.id.in_(payload.item_ids),
        Item.status == ItemStatus.LISTED,
    ).all()

    if not items:
        raise HTTPException(status_code=404, detail="Ningún artículo disponible")

    unavailable = set(payload.item_ids) - {i.id for i in items}
    if unavailable:
        raise HTTPException(
            status_code=409,
            detail=f"Artículos ya no disponibles: {list(unavailable)}",
        )

    year = datetime.now().year
    base_count = db.query(func.count(Order.id)).scalar()

    # Batch reference used as MP external_reference
    batch_ref = f"CART-{year}-{base_count + 1:05d}"

    back_urls = {
        "success": f"https://www.elroperodemar.com/pago/exitoso?order={batch_ref}",
        "failure": f"https://www.elroperodemar.com/pago/fallido?order={batch_ref}",
        "pending": f"https://www.elroperodemar.com/pago/pendiente?order={batch_ref}",
    }

    total = sum(float(i.selling_price) for i in items)
    buyer_email = buyer.email or f"{buyer.phone.replace('+', '')}@elroperodemar.mx"

    # Single MP preference with all items
    mp_items = [
        {
            "id": str(i.id),
            "title": i.title[:256],
            "quantity": 1,
            "unit_price": float(i.selling_price),
            "currency_id": "MXN",
        }
        for i in items
    ]
    try:
        pref_data = {
            "items": mp_items,
            "payer": {"email": buyer_email},
            "back_urls": back_urls,
            "auto_return": "approved",
            "external_reference": batch_ref,
            "statement_descriptor": "El Ropero de Mar",
        }
        result = mp_service.sdk.preference().create(pref_data)
        if result["status"] != 201:
            raise RuntimeError(result["response"])
        mp_preference_id = result["response"]["id"]
        checkout_url = result["response"]["init_point"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error MercadoPago: {str(e)}")

    now = datetime.now(timezone.utc)
    orders_created = []
    for idx, item in enumerate(items):
        order_number = f"ORD-{year}-{base_count + idx + 1:05d}"
        order = Order(
            order_number=order_number,
            buyer_id=buyer.id,
            item_id=item.id,
            amount=item.selling_price,
            commission_amount=item.commission or 0,
            seller_payout_amount=item.seller_payout or 0,
            shipping_method=payload.shipping_method,
            shipping_address=payload.shipping_address,
            status=OrderStatus.PENDING_PAYMENT,
            mp_preference_id=mp_preference_id,
            notes=f"batch:{batch_ref}",
        )
        db.add(order)
        item.status = ItemStatus.SOLD
        item.sold_at = now
        orders_created.append(order_number)

    db.commit()

    return {
        "batch_ref": batch_ref,
        "order_numbers": orders_created,
        "checkout_url": checkout_url,
        "mp_preference_id": mp_preference_id,
        "total": total,
        "items_count": len(items),
    }


# ── Guest checkout (no auth required) ────────────────────────────────────────
@router.post("/checkout-guest")
def guest_checkout(
    payload: GuestCheckoutRequest,
    db: Session = Depends(get_db),
):
    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    # Load available items
    items = db.query(Item).filter(
        Item.id.in_(payload.item_ids),
        Item.status == ItemStatus.LISTED,
    ).all()

    if not items:
        raise HTTPException(status_code=404, detail="Ningún artículo disponible")

    unavailable = set(payload.item_ids) - {i.id for i in items}
    if unavailable:
        raise HTTPException(
            status_code=409,
            detail=f"Artículos ya no disponibles: {list(unavailable)}",
        )

    # Get or create buyer by phone (upsert)
    buyer = db.query(Buyer).filter(Buyer.phone == payload.phone).first()
    if buyer:
        # Update name/email if provided
        if payload.full_name:
            buyer.full_name = payload.full_name
        if payload.email and not buyer.email:
            buyer.email = payload.email
        db.commit()
    else:
        buyer = Buyer(
            full_name=payload.full_name,
            phone=payload.phone,
            email=payload.email,
            is_active=True,
        )
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        # Welcome WhatsApp
        try:
            whatsapp_service.notify_buyer_welcome(buyer.phone, buyer.full_name)
        except Exception:
            pass

    year = datetime.now().year
    base_count = db.query(func.count(Order.id)).scalar()
    batch_ref = f"CART-{year}-{base_count + 1:05d}"

    back_urls = {
        "success": f"https://www.elroperodemar.com/pago/exitoso?order={batch_ref}",
        "failure": f"https://www.elroperodemar.com/pago/fallido?order={batch_ref}",
        "pending": f"https://www.elroperodemar.com/pago/pendiente?order={batch_ref}",
    }

    total = sum(float(i.selling_price) for i in items)
    buyer_email = buyer.email or f"{buyer.phone.replace('+', '')}@elroperodemar.mx"

    mp_items = [
        {
            "id": str(i.id),
            "title": i.title[:256],
            "quantity": 1,
            "unit_price": float(i.selling_price),
            "currency_id": "MXN",
        }
        for i in items
    ]
    try:
        pref_data = {
            "items": mp_items,
            "payer": {
                "name": buyer.full_name,
                "email": buyer_email,
                "phone": {"number": buyer.phone},
            },
            "back_urls": back_urls,
            "auto_return": "approved",
            "external_reference": batch_ref,
            "statement_descriptor": "El Ropero de Mar",
        }
        result = mp_service.sdk.preference().create(pref_data)
        if result["status"] != 201:
            raise RuntimeError(result["response"])
        mp_preference_id = result["response"]["id"]
        checkout_url = result["response"]["init_point"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error MercadoPago: {str(e)}")

    now = datetime.now(timezone.utc)
    orders_created = []
    for idx, item in enumerate(items):
        order_number = f"ORD-{year}-{base_count + idx + 1:05d}"
        order = Order(
            order_number=order_number,
            buyer_id=buyer.id,
            buyer_name=buyer.full_name,
            buyer_phone=buyer.phone,
            buyer_email=buyer.email,
            item_id=item.id,
            amount=item.selling_price,
            commission_amount=item.commission or 0,
            seller_payout_amount=item.seller_payout or 0,
            status=OrderStatus.PENDING_PAYMENT,
            mp_preference_id=mp_preference_id,
            notes=f"batch:{batch_ref}",
        )
        db.add(order)
        item.status = ItemStatus.SOLD
        item.sold_at = now
        orders_created.append(order_number)

    db.commit()

    return {
        "batch_ref": batch_ref,
        "order_numbers": orders_created,
        "checkout_url": checkout_url,
        "mp_preference_id": mp_preference_id,
        "total": total,
        "items_count": len(items),
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

    external_ref = payment.get("external_reference")
    if not external_ref:
        return {"status": "no_external_reference"}

    mp_preference_id = payment.get("preference_id")

    # ── Batch cart checkout (CART-YYYY-XXXXX) ────────────────────────────────
    if external_ref.startswith("CART-") and mp_preference_id:
        orders = db.query(Order).filter(
            Order.mp_preference_id == mp_preference_id,
            Order.status == OrderStatus.PENDING_PAYMENT,
        ).all()
        if not orders:
            return {"status": "already_processed_or_not_found"}

        buyer = db.query(Buyer).filter(Buyer.id == orders[0].buyer_id).first()
        total = sum(float(o.amount) for o in orders)

        for order in orders:
            order.status = OrderStatus.PAID
            order.mp_payment_id = payment_id
        db.commit()

        # Notify buyer once for the whole batch
        if buyer:
            try:
                item_titles = []
                for o in orders:
                    it = db.query(Item).filter(Item.id == o.item_id).first()
                    if it:
                        item_titles.append(it.title)
                whatsapp_service.notify_buyer_order_confirmed(
                    buyer.phone, buyer.full_name,
                    ", ".join(item_titles[:3]) + ("…" if len(item_titles) > 3 else ""),
                    external_ref, total,
                )
            except Exception:
                pass

        # Notify each seller
        for order in orders:
            item = db.query(Item).filter(Item.id == order.item_id).first()
            seller = db.query(Seller).filter(Seller.id == item.seller_id).first() if item and item.seller_id else None
            if seller and item:
                try:
                    whatsapp_service.notify_seller_item_sold(
                        seller.phone, seller.full_name, item.title,
                        float(order.seller_payout_amount),
                    )
                except Exception:
                    pass

        return {"status": "ok", "batch": external_ref, "orders": len(orders)}

    # ── Single item checkout (ORD-YYYY-XXXXX) ────────────────────────────────
    order = db.query(Order).filter(Order.order_number == external_ref).first()
    if not order:
        return {"status": "order_not_found"}

    if order.status != OrderStatus.PENDING_PAYMENT:
        return {"status": "already_processed"}

    order.status = OrderStatus.PAID
    order.mp_payment_id = payment_id
    db.commit()

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
    result = []
    for i in items:
        order = db.query(Order).filter(Order.item_id == i.id).first()
        seller_paid = bool(order and order.seller_paid == 1) if order else False
        result.append(
            _item_out(i, full=True) | {
                "status": i.status.value,
                "seller_payout": float(i.seller_payout) if i.seller_payout else None,
                "seller_paid": seller_paid,
            }
        )
    return result


@router.post("/my-items", status_code=201)
def submit_item(
    payload: SubmitItemRequest,
    seller: Seller = Depends(_require_seller),
    db: Session = Depends(get_db),
):
    import traceback
    if not seller.is_approved:
        raise HTTPException(status_code=403, detail="Tu cuenta aún no ha sido aprobada")
    # Validate enums
    try:
        category = ItemCategory(payload.category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Categoría inválida: {payload.category}")
    try:
        condition = ItemCondition(payload.condition)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {payload.condition}")

    # Auto-generate SKU
    count = db.query(func.count(Item.id)).scalar() + 1
    year = datetime.now().year
    sku = f"VND-{year}-{count:05d}"
    # Ensure SKU uniqueness
    while db.query(Item).filter(Item.sku == sku).first():
        count += 1
        sku = f"VND-{year}-{count:05d}"

    price = payload.selling_price or 0
    commission_pct = 0.30
    item = Item(
        sku=sku,
        title=payload.title,
        category=category,
        condition=condition,
        brand=payload.brand,
        size=payload.size,
        color=payload.color,
        description=payload.description,
        selling_price=price,
        seller_payout=round(price * (1 - commission_pct), 2) if price else None,
        commission=round(price * commission_pct, 2) if price else None,
        seller_id=seller.id,
        status=ItemStatus.RECEIVED,
    )
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except Exception as e:
        db.rollback()
        print(f"[submit_item] DB error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")
    return {"id": item.id, "sku": item.sku, "status": item.status.value}


@router.post("/my-items/{item_id}/images", status_code=200)
async def upload_my_item_image(
    item_id: int,
    file: UploadFile = File(...),
    seller: Seller = Depends(_require_seller),
    db: Session = Depends(get_db),
):
    import cloudinary
    import cloudinary.uploader
    from app.core.config import settings as cfg
    cloudinary.config(
        cloud_name=cfg.CLOUDINARY_CLOUD_NAME,
        api_key=cfg.CLOUDINARY_API_KEY,
        api_secret=cfg.CLOUDINARY_API_SECRET,
    )
    item = db.query(Item).filter(Item.id == item_id, Item.seller_id == seller.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    existing = [u for u in (item.images or "").split(",") if u.strip()]
    if len(existing) >= 6:
        raise HTTPException(status_code=400, detail="Máximo 6 fotos por artículo")
    contents = await file.read()
    idx = len(existing) + 1
    result = cloudinary.uploader.upload(
        contents,
        folder=f"mommybazar/items/{item.sku}",
        public_id=f"{item.sku}_{idx:02d}",
        overwrite=True,
        quality="auto:good",
        fetch_format="auto",
    )
    url = result["secure_url"]
    existing.append(url)
    item.images = ",".join(existing)
    db.commit()
    return {"url": url, "images": existing}


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

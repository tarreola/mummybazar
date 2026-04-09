from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.item import Item, ItemStatus, ItemCategory
from app.models.order import Order, OrderStatus
from app.models.seller import Seller
from app.models.buyer import Buyer

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

PAID_STATUSES = [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Inventory counts by status
    inventory = {}
    for status in ItemStatus:
        inventory[status.value] = db.query(func.count(Item.id)).filter(Item.status == status).scalar()

    # Revenue
    def revenue_query(extra_filters=None):
        q = db.query(func.sum(Order.amount), func.sum(Order.commission_amount), func.count(Order.id))
        q = q.filter(Order.status.in_(PAID_STATUSES))
        if extra_filters:
            for f in extra_filters:
                q = q.filter(f)
        return q.one()

    total_gross, total_commission, total_orders = revenue_query()
    month_gross, month_commission, month_orders = revenue_query([Order.created_at >= month_start])

    # Units sold this month
    units_sold_month = db.query(func.count(Order.id)).filter(
        Order.status.in_(PAID_STATUSES),
        Order.created_at >= month_start
    ).scalar()

    # Pending seller payouts
    pending_payouts = db.query(func.sum(Order.seller_payout_amount)).filter(
        Order.seller_paid == 0,
        Order.status == OrderStatus.DELIVERED,
    ).scalar() or Decimal("0")

    # Stagnant items (listed > 30 days)
    stagnant_threshold = now - timedelta(days=30)
    stagnant_count = db.query(func.count(Item.id)).filter(
        Item.status == ItemStatus.LISTED,
        Item.listed_at <= stagnant_threshold,
    ).scalar()

    return {
        "inventory": inventory,
        "revenue": {
            "total_gross": float(total_gross or 0),
            "total_commission": float(total_commission or 0),
            "total_orders": total_orders or 0,
            "month_gross": float(month_gross or 0),
            "month_commission": float(month_commission or 0),
            "month_orders": month_orders or 0,
            "units_sold_month": units_sold_month or 0,
        },
        "pending_seller_payouts": float(pending_payouts),
        "stagnant_items_count": stagnant_count or 0,
        "totals": {
            "sellers": db.query(func.count(Seller.id)).scalar(),
            "buyers": db.query(func.count(Buyer.id)).scalar(),
            "orders": db.query(func.count(Order.id)).scalar(),
        },
    }


@router.get("/revenue-by-month")
def revenue_by_month(months: int = 6, db: Session = Depends(get_db), _=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    results = []
    for i in range(months - 1, -1, -1):
        start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=32)).replace(day=1)
        row = db.query(
            func.sum(Order.amount),
            func.sum(Order.commission_amount),
            func.count(Order.id),
        ).filter(
            Order.status.in_(PAID_STATUSES),
            Order.created_at >= start,
            Order.created_at < end,
        ).one()
        results.append({
            "month": start.strftime("%Y-%m"),
            "gross": float(row[0] or 0),
            "commission": float(row[1] or 0),
            "units": row[2] or 0,
        })
    return results


@router.get("/top-sellers")
def top_sellers(limit: int = 5, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = (
        db.query(Seller, func.count(Order.id).label("sales"), func.sum(Order.amount).label("revenue"))
        .join(Item, Item.seller_id == Seller.id)
        .join(Order, Order.item_id == Item.id)
        .filter(Order.status.in_(PAID_STATUSES))
        .group_by(Seller.id)
        .order_by(desc("sales"))
        .limit(limit)
        .all()
    )
    return [
        {"id": s.id, "full_name": s.full_name, "phone": s.phone, "sales": sales, "revenue": float(revenue or 0)}
        for s, sales, revenue in rows
    ]


@router.get("/top-buyers")
def top_buyers(limit: int = 5, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = (
        db.query(Buyer, func.count(Order.id).label("purchases"), func.sum(Order.amount).label("spent"))
        .join(Order, Order.buyer_id == Buyer.id)
        .filter(Order.status.in_(PAID_STATUSES))
        .group_by(Buyer.id)
        .order_by(desc("purchases"))
        .limit(limit)
        .all()
    )
    return [
        {"id": b.id, "full_name": b.full_name, "phone": b.phone, "purchases": purchases, "spent": float(spent or 0)}
        for b, purchases, spent in rows
    ]


@router.get("/sales-by-category")
def sales_by_category(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = (
        db.query(Item.category, func.count(Order.id).label("units"), func.sum(Order.amount).label("revenue"))
        .join(Order, Order.item_id == Item.id)
        .filter(Order.status.in_(PAID_STATUSES))
        .group_by(Item.category)
        .order_by(desc("units"))
        .all()
    )
    return [{"category": r[0].value, "units": r[1], "revenue": float(r[2] or 0)} for r in rows]


@router.get("/stagnant-items")
def stagnant_items(days: int = 30, limit: int = 20, db: Session = Depends(get_db), _=Depends(get_current_user)):
    threshold = datetime.now(timezone.utc) - timedelta(days=days)
    items = (
        db.query(Item)
        .filter(Item.status == ItemStatus.LISTED, Item.listed_at <= threshold)
        .order_by(Item.listed_at.asc())
        .limit(limit)
        .all()
    )
    now = datetime.now(timezone.utc)
    return [
        {
            "id": i.id, "sku": i.sku, "title": i.title, "category": i.category.value,
            "selling_price": float(i.selling_price),
            "days_listed": (now - i.listed_at.replace(tzinfo=timezone.utc)).days if i.listed_at else None,
            "seller_id": i.seller_id,
        }
        for i in items
    ]


@router.get("/seller-stats/{seller_id}")
def seller_stats(seller_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    total_items = db.query(func.count(Item.id)).filter(Item.seller_id == seller_id).scalar()
    listed = db.query(func.count(Item.id)).filter(Item.seller_id == seller_id, Item.status == ItemStatus.LISTED).scalar()
    sold = db.query(func.count(Item.id)).filter(Item.seller_id == seller_id, Item.status == ItemStatus.SOLD).scalar()
    revenue = db.query(func.sum(Order.seller_payout_amount)).join(Item, Order.item_id == Item.id).filter(
        Item.seller_id == seller_id, Order.status.in_(PAID_STATUSES)
    ).scalar()
    pending_payout = db.query(func.sum(Order.seller_payout_amount)).join(Item, Order.item_id == Item.id).filter(
        Item.seller_id == seller_id, Order.status == OrderStatus.DELIVERED, Order.seller_paid == 0
    ).scalar()
    return {
        "total_items": total_items, "listed": listed, "sold": sold,
        "total_earned": float(revenue or 0), "pending_payout": float(pending_payout or 0),
    }


@router.get("/buyer-stats/{buyer_id}")
def buyer_stats(buyer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    orders = db.query(Order).filter(Order.buyer_id == buyer_id).all()
    paid = [o for o in orders if o.status in PAID_STATUSES]
    pending = [o for o in orders if o.status == OrderStatus.PENDING_PAYMENT]
    return {
        "total_orders": len(orders),
        "paid_orders": len(paid),
        "pending_orders": len(pending),
        "total_spent": float(sum(o.amount for o in paid)),
        "pending_amount": float(sum(o.amount for o in pending)),
    }

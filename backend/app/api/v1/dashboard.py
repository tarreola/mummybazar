from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.item import Item, ItemStatus, ItemCategory
from app.models.order import Order, OrderStatus
from app.models.seller import Seller
from app.models.buyer import Buyer

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

PAID_STATUSES = [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CLOSED]


def _period_bounds(period: str, now: datetime):
    """Return (current_start, current_end, prev_start, prev_end) for TODAY/WTD/MTD/QTD/YTD."""
    if period == "TODAY":
        cur_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = cur_start - timedelta(days=1)
        prev_end = cur_start
        return cur_start, now, prev_start, prev_end

    if period == "WTD":
        # Week starts Monday
        days_since_monday = now.weekday()
        cur_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = cur_start - timedelta(weeks=1)
        prev_end = cur_start
        return cur_start, now, prev_start, prev_end

    elif period == "MTD":
        cur_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Same day range last month
        if cur_start.month == 1:
            prev_start = cur_start.replace(year=cur_start.year - 1, month=12)
        else:
            prev_start = cur_start.replace(month=cur_start.month - 1)
        prev_end = cur_start
        return cur_start, now, prev_start, prev_end

    elif period == "QTD":
        q_month = ((now.month - 1) // 3) * 3 + 1
        cur_start = now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = cur_start - timedelta(days=91)
        prev_start = prev_start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = cur_start
        return cur_start, now, prev_start, prev_end

    elif period == "YTD":
        cur_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = cur_start.replace(year=cur_start.year - 1)
        prev_end = cur_start
        return cur_start, now, prev_start, prev_end

    else:
        # Default: MTD
        cur_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if cur_start.month == 1:
            prev_start = cur_start.replace(year=cur_start.year - 1, month=12)
        else:
            prev_start = cur_start.replace(month=cur_start.month - 1)
        return cur_start, now, prev_start, cur_start


def _revenue_query(db: Session, date_from: datetime, date_to: datetime):
    row = db.query(
        func.sum(Order.amount),
        func.sum(Order.commission_amount),
        func.count(Order.id),
    ).filter(
        Order.status.in_(PAID_STATUSES),
        Order.created_at >= date_from,
        Order.created_at <= date_to,
    ).one()
    return float(row[0] or 0), float(row[1] or 0), row[2] or 0


@router.get("/summary")
def get_summary(
    period: str = Query("MTD", description="WTD | MTD | QTD | YTD | CUSTOM"),
    date_from: Optional[str] = Query(None, description="ISO date, only for CUSTOM"),
    date_to: Optional[str] = Query(None, description="ISO date, only for CUSTOM"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)

    if period == "CUSTOM" and date_from and date_to:
        cur_start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        cur_end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        delta = cur_end - cur_start
        prev_start = cur_start - delta
        prev_end = cur_start
    else:
        cur_start, cur_end, prev_start, prev_end = _period_bounds(period, now)

    # Inventory counts by status (always current, not filtered by date)
    inventory = {}
    for status in ItemStatus:
        inventory[status.value] = db.query(func.count(Item.id)).filter(Item.status == status).scalar()

    # Revenue — current period
    cur_gross, cur_commission, cur_orders = _revenue_query(db, cur_start, cur_end)

    # Revenue — previous period (for comparison)
    prev_gross, prev_commission, prev_orders = _revenue_query(db, prev_start, prev_end)

    # Units sold — current period
    units_sold = db.query(func.count(Order.id)).filter(
        Order.status.in_(PAID_STATUSES),
        Order.created_at >= cur_start,
        Order.created_at <= cur_end,
    ).scalar() or 0

    # Units sold — previous period
    units_sold_prev = db.query(func.count(Order.id)).filter(
        Order.status.in_(PAID_STATUSES),
        Order.created_at >= prev_start,
        Order.created_at <= prev_end,
    ).scalar() or 0

    # All-time totals
    all_gross, all_commission, all_orders_total = _revenue_query(db, datetime(2000, 1, 1, tzinfo=timezone.utc), now)

    # Pending seller payouts (shipped orders not yet paid)
    pending_payouts = db.query(func.sum(Order.seller_payout_amount)).filter(
        Order.seller_paid == 0,
        Order.status == OrderStatus.SHIPPED,
    ).scalar() or Decimal("0")

    # Finalized orders count (matches the "Cerrados" tab: closed + cancelled + refunded)
    finalized_statuses = [OrderStatus.CLOSED, OrderStatus.CANCELLED, OrderStatus.REFUNDED]
    closed_orders_count = db.query(func.count(Order.id)).filter(
        Order.status.in_(finalized_statuses)
    ).scalar() or 0

    # Stagnant items (listed > 30 days)
    stagnant_threshold = now - timedelta(days=30)
    stagnant_count = db.query(func.count(Item.id)).filter(
        Item.status == ItemStatus.LISTED,
        Item.listed_at <= stagnant_threshold,
    ).scalar()

    def pct_delta(cur, prev):
        if prev == 0:
            return None
        return round((cur - prev) / prev * 100, 1)

    return {
        "period": period,
        "period_label": {
            "cur_start": cur_start.isoformat(),
            "cur_end": cur_end.isoformat(),
            "prev_start": prev_start.isoformat(),
            "prev_end": prev_end.isoformat(),
        },
        "inventory": inventory,
        "revenue": {
            # Current period
            "gross": cur_gross,
            "commission": cur_commission,
            "orders": cur_orders,
            "units_sold": units_sold,
            # Previous period
            "prev_gross": prev_gross,
            "prev_commission": prev_commission,
            "prev_orders": prev_orders,
            "prev_units_sold": units_sold_prev,
            # Deltas %
            "delta_gross": pct_delta(cur_gross, prev_gross),
            "delta_commission": pct_delta(cur_commission, prev_commission),
            "delta_orders": pct_delta(cur_orders, prev_orders),
            "delta_units": pct_delta(units_sold, units_sold_prev),
            # All-time (for totals row)
            "total_gross": all_gross,
            "total_commission": all_commission,
            "total_orders": all_orders_total,
            # Legacy aliases (keep UI compatible)
            "month_gross": cur_gross,
            "month_commission": cur_commission,
            "units_sold_month": units_sold,
        },
        "pending_seller_payouts": float(pending_payouts),
        "closed_orders_count": closed_orders_count,
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
def top_sellers(
    limit: int = 5,
    period: str = Query("MTD"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    if period == "CUSTOM" and date_from and date_to:
        cur_start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        cur_end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
    else:
        cur_start, cur_end, _, _ = _period_bounds(period, now)

    rows = (
        db.query(Seller, func.count(Order.id).label("sales"), func.sum(Order.amount).label("revenue"))
        .join(Item, Item.seller_id == Seller.id)
        .join(Order, Order.item_id == Item.id)
        .filter(Order.status.in_(PAID_STATUSES), Order.created_at >= cur_start, Order.created_at <= cur_end)
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
def top_buyers(
    limit: int = 5,
    period: str = Query("MTD"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    if period == "CUSTOM" and date_from and date_to:
        cur_start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        cur_end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
    else:
        cur_start, cur_end, _, _ = _period_bounds(period, now)

    rows = (
        db.query(Buyer, func.count(Order.id).label("purchases"), func.sum(Order.amount).label("spent"))
        .join(Order, Order.buyer_id == Buyer.id)
        .filter(Order.status.in_(PAID_STATUSES), Order.created_at >= cur_start, Order.created_at <= cur_end)
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
def sales_by_category(
    period: str = Query("MTD"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    if period == "CUSTOM" and date_from and date_to:
        cur_start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        cur_end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
    else:
        cur_start, cur_end, _, _ = _period_bounds(period, now)

    rows = (
        db.query(Item.category, func.count(Order.id).label("units"), func.sum(Order.amount).label("revenue"))
        .join(Order, Order.item_id == Item.id)
        .filter(Order.status.in_(PAID_STATUSES), Order.created_at >= cur_start, Order.created_at <= cur_end)
        .group_by(Item.category)
        .order_by(desc("units"))
        .all()
    )
    return [{"category": r[0].value, "units": r[1], "revenue": float(r[2] or 0)} for r in rows]


@router.get("/community-stats")
def community_stats(db: Session = Depends(get_db)):
    """Public endpoint — returns totals for the landing page."""
    total_items = db.query(func.count(Item.id)).filter(Item.status == ItemStatus.LISTED).scalar() or 0
    total_sellers = db.query(func.count(Seller.id)).scalar() or 0
    total_buyers = db.query(func.count(Buyer.id)).scalar() or 0
    total_orders = db.query(func.count(Order.id)).filter(
        Order.status.in_(PAID_STATUSES)
    ).scalar() or 0
    return {
        "total_items": total_items,
        "total_sellers": total_sellers,
        "total_buyers": total_buyers,
        "total_mamis": total_sellers + total_buyers,
        "total_orders": total_orders,
    }


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
        Item.seller_id == seller_id, Order.status == OrderStatus.SHIPPED, Order.seller_paid == 0
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

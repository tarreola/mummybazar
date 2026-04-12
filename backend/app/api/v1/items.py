from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, asc, desc
from datetime import datetime, timezone
from typing import List, Optional
from decimal import Decimal
import cloudinary
import cloudinary.uploader

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.item import Item, ItemStatus, ItemCategory, ItemCondition
from app.schemas.item import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/items", tags=["items"])

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def _generate_sku(db: Session) -> str:
    year = datetime.now().year
    max_id = db.query(func.max(Item.id)).scalar() or 0
    return f"MB-{year}-{max_id + 1:05d}"


def _calculate_pricing(selling_price: Decimal):
    commission = selling_price * Decimal(str(settings.COMMISSION_RATE))
    seller_payout = selling_price - commission
    return round(commission, 2), round(seller_payout, 2)


@router.get("/", response_model=List[ItemOut])
def list_items(
    status: Optional[ItemStatus] = None,
    category: Optional[ItemCategory] = None,
    condition: Optional[ItemCondition] = None,
    seller_id: Optional[int] = None,
    sort: Optional[str] = Query(None, description="price_asc | price_desc | listed_asc | listed_desc"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Item)
    if status:
        q = q.filter(Item.status == status)
    if category:
        q = q.filter(Item.category == category)
    if condition:
        q = q.filter(Item.condition == condition)
    if seller_id:
        q = q.filter(Item.seller_id == seller_id)

    if sort == "price_asc":
        q = q.order_by(asc(Item.selling_price))
    elif sort == "price_desc":
        q = q.order_by(desc(Item.selling_price))
    elif sort == "listed_asc":
        q = q.order_by(asc(Item.listed_at))
    elif sort == "listed_desc":
        q = q.order_by(desc(Item.listed_at))
    else:
        q = q.order_by(Item.created_at.desc())

    return q.offset(skip).limit(limit).all()


@router.post("/", response_model=ItemOut)
def create_item(payload: ItemCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if payload.no_seller:
        # No seller: 100% commission, zero payout
        commission = payload.selling_price
        seller_payout = Decimal("0")
    else:
        commission, seller_payout = _calculate_pricing(payload.selling_price)
    item = Item(
        **payload.model_dump(),
        sku=_generate_sku(db),
        commission=commission,
        seller_payout=seller_payout,
        status=ItemStatus.RECEIVED,
        received_at=datetime.now(timezone.utc),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    data = payload.model_dump(exclude_unset=True)

    if "status" in data:
        if data["status"] == ItemStatus.LISTED and not item.listed_at:
            data["listed_at"] = datetime.now(timezone.utc)
        elif data["status"] == ItemStatus.SOLD and not item.sold_at:
            data["sold_at"] = datetime.now(timezone.utc)

    if "selling_price" in data:
        commission, seller_payout = _calculate_pricing(data["selling_price"])
        data["commission"] = commission
        data["seller_payout"] = seller_payout

    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


@router.post("/{item_id}/images", response_model=ItemOut)
async def upload_image(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = [u for u in (item.images or "").split(",") if u.strip()]
    if len(existing) >= 6:
        raise HTTPException(status_code=400, detail="Máximo 6 fotos por artículo")

    contents = await file.read()
    idx = len(existing) + 1

    # Upload with eager transformation:
    # 1. Auto-rotate based on EXIF (fixes phone camera orientation)
    # 2. Pad to 800×1000 (4:5 portrait) with white background — consistent product photo
    # 3. Auto quality + WebP delivery
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
    db.refresh(item)
    return item


@router.delete("/{item_id}/images", response_model=ItemOut)
def delete_image(
    item_id: int,
    url: str = Query(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    urls = [u for u in (item.images or "").split(",") if u.strip() and u != url]
    item.images = ",".join(urls)
    db.commit()
    db.refresh(item)
    return item

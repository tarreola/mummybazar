from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.buyer import Buyer
from app.models.order import Order
from app.schemas.buyer import BuyerCreate, BuyerUpdate, BuyerOut

router = APIRouter(prefix="/buyers", tags=["buyers"])


@router.get("/", response_model=List[BuyerOut])
def list_buyers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    buyers = db.query(Buyer).offset(skip).limit(limit).all()
    for b in buyers:
        b.total_orders = db.query(func.count(Order.id)).filter(Order.buyer_id == b.id).scalar() or 0
    return buyers


@router.post("/", response_model=BuyerOut)
def create_buyer(payload: BuyerCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Buyer).filter(Buyer.phone == payload.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")
    buyer = Buyer(**payload.model_dump())
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    return buyer


@router.get("/{buyer_id}", response_model=BuyerOut)
def get_buyer(buyer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return buyer


@router.patch("/{buyer_id}", response_model=BuyerOut)
def update_buyer(buyer_id: int, payload: BuyerUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(buyer, field, value)
    db.commit()
    db.refresh(buyer)
    return buyer


@router.post("/{buyer_id}/approve", response_model=BuyerOut)
def approve_buyer(buyer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    buyer = db.query(Buyer).filter(Buyer.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    buyer.is_approved = True
    db.commit()
    db.refresh(buyer)
    return buyer

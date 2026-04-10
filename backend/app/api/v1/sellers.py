from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.seller import Seller
from app.schemas.seller import SellerCreate, SellerUpdate, SellerOut

router = APIRouter(prefix="/sellers", tags=["sellers"])


@router.get("/", response_model=List[SellerOut])
def list_sellers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Seller).offset(skip).limit(limit).all()


@router.post("/", response_model=SellerOut)
def create_seller(payload: SellerCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Seller).filter(Seller.phone == payload.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")
    seller = Seller(**payload.model_dump())
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller


@router.get("/{seller_id}", response_model=SellerOut)
def get_seller(seller_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    return seller


@router.patch("/{seller_id}", response_model=SellerOut)
def update_seller(seller_id: int, payload: SellerUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(seller, field, value)
    db.commit()
    db.refresh(seller)
    return seller


@router.post("/{seller_id}/approve", response_model=SellerOut)
def approve_seller(seller_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    seller.is_approved = True
    db.commit()
    db.refresh(seller)
    return seller

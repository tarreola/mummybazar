from fastapi import APIRouter

from app.api.v1 import auth, sellers, buyers, items, orders, dashboard, whatsapp

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(sellers.router)
api_router.include_router(buyers.router)
api_router.include_router(items.router)
api_router.include_router(orders.router)
api_router.include_router(dashboard.router)
api_router.include_router(whatsapp.router)

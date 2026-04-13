from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-run Alembic migrations on every startup so Railway deploys always apply pending migrations
    import subprocess
    import os
    # backend/ directory (one level above app/)
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"[Alembic] Migrations OK:\n{result.stdout}")
    else:
        print(f"[Alembic] Migration FAILED (stdout):\n{result.stdout}")
        print(f"[Alembic] Migration FAILED (stderr):\n{result.stderr}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    # Dev
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    # Production — custom domain
    "https://elroperodemar.com",
    "https://www.elroperodemar.com",
    "https://admin.elroperodemar.com",
    # Production — Vercel default URLs
    "https://mummybazar.vercel.app",
    "https://mummybazar-12dx.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/health/db")
def health_db():
    """Returns item/order counts by status — useful to verify DB state after deploy."""
    from app.core.database import SessionLocal
    from app.models.item import Item
    from app.models.order import Order
    from sqlalchemy import func, text
    db = SessionLocal()
    try:
        # Check which Alembic revision is current
        try:
            rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        except Exception:
            rev = "unknown"
        item_counts = dict(
            db.query(Item.status, func.count(Item.id)).group_by(Item.status).all()
        )
        order_counts = dict(
            db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
        )
        return {
            "alembic_version": rev,
            "items_by_status": {str(k): v for k, v in item_counts.items()},
            "orders_by_status": {str(k): v for k, v in order_counts.items()},
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

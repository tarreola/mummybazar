from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-run Alembic migrations on every startup so Railway deploys always apply pending migrations
    try:
        from alembic.config import Config
        from alembic import command
        import os
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        print("[Alembic] Migrations applied successfully")
    except Exception as e:
        print(f"[Alembic] Migration error (non-fatal): {e}")
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

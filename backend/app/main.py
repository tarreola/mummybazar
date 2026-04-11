from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
    "https://mummybazar-storefront.vercel.app",
    "https://mummybazar-admin.vercel.app",
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

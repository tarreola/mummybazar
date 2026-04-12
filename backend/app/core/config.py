from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "El Ropero de Mar"
    DEBUG: bool = False
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str

    # Twilio / WhatsApp
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_WHATSAPP_FROM: str  # e.g. "whatsapp:+14155238886"

    # MercadoPago
    MP_ACCESS_TOKEN: str
    MP_PUBLIC_KEY: str
    MP_WEBHOOK_SECRET: Optional[str] = None

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # Business rules
    COMMISSION_RATE: float = 0.30  # 30%

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

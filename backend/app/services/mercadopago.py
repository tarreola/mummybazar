import mercadopago
from app.core.config import settings


class MercadoPagoService:
    def __init__(self):
        self._sdk = None

    @property
    def sdk(self):
        if self._sdk is None:
            self._sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)
        return self._sdk

    def create_preference(self, order_number: str, item_title: str, amount: float, buyer_email: str, back_urls: dict) -> dict:
        """
        Create a MercadoPago checkout preference for an order.
        Returns the preference with checkout URL.
        """
        preference_data = {
            "items": [
                {
                    "id": order_number,
                    "title": item_title,
                    "quantity": 1,
                    "unit_price": float(amount),
                    "currency_id": "MXN",
                }
            ],
            "payer": {
                "email": buyer_email,
            },
            "back_urls": back_urls,  # {"success": "...", "failure": "...", "pending": "..."}
            "auto_return": "approved",
            "external_reference": order_number,
            "statement_descriptor": "MommyBazar",
        }
        result = self.sdk.preference().create(preference_data)
        if result["status"] != 201:
            raise RuntimeError(f"MercadoPago preference error: {result['response']}")
        return result["response"]

    def get_payment(self, payment_id: str) -> dict:
        """Fetch a payment by ID to verify status."""
        result = self.sdk.payment().get(payment_id)
        if result["status"] != 200:
            raise RuntimeError(f"MercadoPago payment fetch error: {result['response']}")
        return result["response"]

    def is_payment_approved(self, payment_id: str) -> bool:
        payment = self.get_payment(payment_id)
        return payment.get("status") == "approved"


mp_service = MercadoPagoService()

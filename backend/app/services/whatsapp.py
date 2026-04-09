from twilio.rest import Client
from app.core.config import settings


# Pre-built message templates for common events
TEMPLATES = {
    "seller_item_received": (
        "Hola {name}! 🌸 Recibimos tu artículo *{item_title}* (SKU: {sku}). "
        "Lo revisaremos en las próximas 24-48 horas y te avisamos cuando esté publicado. "
        "¡Gracias por confiar en MommyBazar!"
    ),
    "seller_item_listed": (
        "¡Buenas noticias {name}! 🎉 Tu artículo *{item_title}* ya está publicado en MommyBazar "
        "con un precio de ${selling_price} MXN. Te notificaremos cuando se venda. 💕"
    ),
    "seller_item_sold": (
        "¡Se vendió! 🥳 Tu artículo *{item_title}* fue comprado. "
        "Recibirás tu pago de *${seller_payout} MXN* una vez que confirmemos la entrega. "
        "¡Gracias por circular el amor, {name}!"
    ),
    "seller_payout_sent": (
        "Hola {name} 💸 Tu pago de *${amount} MXN* por la venta de *{item_title}* "
        "ha sido transferido. Revisa tu cuenta en 1-2 días hábiles. ¡Hasta pronto!"
    ),
    "buyer_order_confirmed": (
        "¡Hola {name}! ✅ Confirmamos tu compra de *{item_title}* (Orden: {order_number}). "
        "Monto: *${amount} MXN*. Te avisamos cuando enviemos tu artículo. 📦"
    ),
    "buyer_order_shipped": (
        "¡Tu pedido va en camino! 🚚 *{item_title}* fue enviado. "
        "Número de rastreo: *{tracking_number}* ({carrier}). "
        "Orden: {order_number}. ¡Que lo disfrutes mucho!"
    ),
    "buyer_order_delivered": (
        "¡Esperamos que tu artículo haya llegado perfecto! 💌 "
        "Cuéntanos cómo te fue con *{item_title}*. ¡Gracias por ser parte de MommyBazar!"
    ),
}


class WhatsAppService:
    def __init__(self):
        self._client = None

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        return self._client

    def send(self, to_number: str, body: str) -> dict:
        """Send a free-form WhatsApp message."""
        if not to_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{to_number}"
        message = self.client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to_number,
            body=body,
        )
        return {"sid": message.sid, "status": message.status}

    def send_template(self, to_number: str, template_key: str, **kwargs) -> dict:
        """Send a pre-built template message with variable substitution."""
        if template_key not in TEMPLATES:
            raise ValueError(f"Unknown template: {template_key}")
        body = TEMPLATES[template_key].format(**kwargs)
        return self.send(to_number, body)

    # --- Convenience methods for common events ---

    def notify_seller_item_received(self, phone: str, name: str, item_title: str, sku: str) -> dict:
        return self.send_template(phone, "seller_item_received", name=name, item_title=item_title, sku=sku)

    def notify_seller_item_listed(self, phone: str, name: str, item_title: str, selling_price) -> dict:
        return self.send_template(phone, "seller_item_listed", name=name, item_title=item_title, selling_price=selling_price)

    def notify_seller_item_sold(self, phone: str, name: str, item_title: str, seller_payout) -> dict:
        return self.send_template(phone, "seller_item_sold", name=name, item_title=item_title, seller_payout=seller_payout)

    def notify_seller_payout_sent(self, phone: str, name: str, item_title: str, amount) -> dict:
        return self.send_template(phone, "seller_payout_sent", name=name, item_title=item_title, amount=amount)

    def notify_buyer_order_confirmed(self, phone: str, name: str, item_title: str, order_number: str, amount) -> dict:
        return self.send_template(phone, "buyer_order_confirmed", name=name, item_title=item_title, order_number=order_number, amount=amount)

    def notify_buyer_order_shipped(self, phone: str, name: str, item_title: str, order_number: str, tracking_number: str, carrier: str) -> dict:
        return self.send_template(phone, "buyer_order_shipped", name=name, item_title=item_title, order_number=order_number, tracking_number=tracking_number, carrier=carrier)

    def notify_buyer_order_delivered(self, phone: str, name: str, item_title: str) -> dict:
        return self.send_template(phone, "buyer_order_delivered", name=name, item_title=item_title)


whatsapp_service = WhatsAppService()

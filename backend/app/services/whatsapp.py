from twilio.rest import Client
from app.core.config import settings


# ── Message templates ──────────────────────────────────────────────────────────
# Variables entre {llaves} se sustituyen al enviar.
# Vocabulario cercano y cálido para mamás 🌸
TEMPLATES = {
    # ── Seller events ──────────────────────────────────────────────────────────
    "seller_welcome": (
        "¡Hola {name}! 🌸 Bienvenida a *MommyBazar*, el espacio donde las mamás "
        "circulan el amor. Ya tienes tu cuenta activa. Cuando estés lista para "
        "entregar tus artículos, escríbenos y coordinamos la recepción. "
        "¡Gracias por unirte! 💕"
    ),
    "seller_item_received": (
        "Hola {name}! 🌸 Recibimos tu artículo *{item_title}* (SKU: {sku}). "
        "Lo revisaremos en las próximas 24-48 hrs y te avisamos cuando esté publicado. "
        "¡Gracias por confiar en MommyBazar!"
    ),
    "seller_item_listed": (
        "¡Buenas noticias {name}! 🎉 Tu artículo *{item_title}* ya está publicado "
        "en MommyBazar con un precio de *${selling_price} MXN*. "
        "Te notificamos en cuanto se venda. 💕"
    ),
    "seller_item_sold": (
        "¡Se vendió! 🥳 Tu artículo *{item_title}* encontró un nuevo hogar. "
        "Recibirás tu pago de *${seller_payout} MXN* una vez que confirmemos "
        "la entrega con la compradora. ¡Gracias por circular el amor, {name}!"
    ),
    "seller_payout_sent": (
        "Hola {name} 💸 Tu pago de *${amount} MXN* por la venta de "
        "*{item_title}* ya fue transferido. Revisa tu cuenta en 1-2 días hábiles. "
        "¡Hasta la próxima! 🌸"
    ),

    # ── Buyer events ───────────────────────────────────────────────────────────
    "buyer_welcome": (
        "¡Hola {name}! 💖 Bienvenida a *MommyBazar*, donde encontrarás artículos "
        "de bebé y niños con mucho amor. Ya puedes explorar nuestro catálogo y "
        "hacer tu primer pedido. ¡Estamos aquí para ayudarte! 🌸"
    ),
    "buyer_order_confirmed": (
        "¡Hola {name}! ✅ Confirmamos tu compra de *{item_title}* "
        "(Orden: *{order_number}*). "
        "Monto: *${amount} MXN*. "
        "Te avisamos en cuanto preparemos y enviemos tu artículo. 📦 "
        "¡Gracias por tu confianza!"
    ),
    "buyer_order_shipped": (
        "¡Tu pedido va en camino! 🚚 *{item_title}* fue enviado por *{carrier}*. "
        "Número de rastreo: *{tracking_number}*. "
        "Orden: {order_number}. "
        "¡Que lo disfrutes mucho, {name}! 💕"
    ),
    "buyer_order_delivered": (
        "¡Esperamos que tu artículo haya llegado perfecto, {name}! 🎀 "
        "¿Cómo te fue con *{item_title}*? Tu opinión nos ayuda mucho. "
        "¡Gracias por ser parte de MommyBazar! 💖"
    ),
    "buyer_delivery_confirm": (
        "Hola {name} 🌸 Solo queremos confirmar que recibiste tu pedido "
        "*{order_number}* ({item_title}). "
        "¿Todo llegó bien? Responde *SÍ* si lo recibiste o escríbenos si "
        "tienes algún comentario. ¡Gracias! 💕"
    ),

    # ── Marketing / Campaigns ──────────────────────────────────────────────────
    "campaign_promo": (
        "¡Hola {name}! 🌸 Tenemos artículos increíbles esperándote en MommyBazar. "
        "{promo_items}"
        "Escríbenos para apartar cualquier pieza. ¡Todo con mucho amor! 💕"
    ),
    "campaign_general": (
        "¡Hola {name}! 💖 {body} "
        "— MommyBazar 🌸"
    ),
    "reminder_stagnant": (
        "Hola {name} 🌸 Te recordamos que tienes {count} artículo(s) publicado(s) "
        "sin vender hace más de {days} días: {titles}. "
        "¿Quieres ajustar el precio o retirarlos? Escríbenos y con gusto te ayudamos. 💕"
    ),
}

# WhatsApp Business label names per order status (requires WA Business API)
ORDER_STATUS_LABELS = {
    "pending_payment": "💳 Pago pendiente",
    "paid":            "✅ Pagado",
    "preparing":       "📦 En preparación",
    "shipped":         "🚚 Enviado",
    "delivered":       "🎀 Entregado",
    "cancelled":       "❌ Cancelado",
    "refunded":        "🔄 Reembolsado",
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
        if not to_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{to_number}"
        msg = self.client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to_number,
            body=body,
        )
        return {"sid": msg.sid, "status": msg.status}

    def send_template(self, to_number: str, template_key: str, **kwargs) -> dict:
        if template_key not in TEMPLATES:
            raise ValueError(f"Unknown template: {template_key}")
        body = TEMPLATES[template_key].format(**kwargs)
        return self.send(to_number, body)

    def render_template(self, template_key: str, **kwargs) -> str:
        """Return rendered template text without sending."""
        if template_key not in TEMPLATES:
            raise ValueError(f"Unknown template: {template_key}")
        return TEMPLATES[template_key].format(**kwargs)

    # ── Seller convenience methods ─────────────────────────────────────────────
    def notify_seller_welcome(self, phone, name):
        return self.send_template(phone, "seller_welcome", name=name)

    def notify_seller_item_received(self, phone, name, item_title, sku):
        return self.send_template(phone, "seller_item_received", name=name, item_title=item_title, sku=sku)

    def notify_seller_item_listed(self, phone, name, item_title, selling_price):
        return self.send_template(phone, "seller_item_listed", name=name, item_title=item_title, selling_price=selling_price)

    def notify_seller_item_sold(self, phone, name, item_title, seller_payout):
        return self.send_template(phone, "seller_item_sold", name=name, item_title=item_title, seller_payout=seller_payout)

    def notify_seller_payout_sent(self, phone, name, item_title, amount):
        return self.send_template(phone, "seller_payout_sent", name=name, item_title=item_title, amount=amount)

    # ── Buyer convenience methods ──────────────────────────────────────────────
    def notify_buyer_welcome(self, phone, name):
        return self.send_template(phone, "buyer_welcome", name=name)

    def notify_buyer_order_confirmed(self, phone, name, item_title, order_number, amount):
        return self.send_template(phone, "buyer_order_confirmed", name=name, item_title=item_title,
                                  order_number=order_number, amount=f"{float(amount):,.0f}")

    def notify_buyer_order_shipped(self, phone, name, item_title, order_number, tracking_number, carrier):
        return self.send_template(phone, "buyer_order_shipped", name=name, item_title=item_title,
                                  order_number=order_number, tracking_number=tracking_number, carrier=carrier)

    def notify_buyer_order_delivered(self, phone, name, item_title):
        return self.send_template(phone, "buyer_order_delivered", name=name, item_title=item_title)

    def notify_buyer_delivery_confirm(self, phone, name, order_number, item_title):
        return self.send_template(phone, "buyer_delivery_confirm", name=name,
                                  order_number=order_number, item_title=item_title)


whatsapp_service = WhatsAppService()

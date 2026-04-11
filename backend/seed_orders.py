"""
seed_orders.py — MommyBazar
Crea: 50 ítems históricos + 50 pedidos en todas las fases del proceso
Los 25 ítems del catálogo principal quedan intactos (LISTED).
Uso: python seed_orders.py
"""
import sys, os, random
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from app.core.database import SessionLocal
from app.models.item import Item, ItemStatus, ItemCategory, ItemCondition
from app.models.order import Order, OrderStatus, ShippingMethod

db = SessionLocal()

def now(): return datetime.now(timezone.utc)
def days_ago(n): return now() - timedelta(days=n)
def hours_ago(n): return now() - timedelta(hours=n)

def price(selling, pct=0.70):
    sp = Decimal(str(selling))
    payout = (sp * Decimal(str(pct))).quantize(Decimal("0.01"))
    commission = (sp - payout).quantize(Decimal("0.01"))
    return sp, payout, commission

def ord_num(n): return f"ORD-2024-{n:05d}"
def sku(n):     return f"MB-2023-{n:05d}"   # prefijo 2023 = ítems históricos

# ── Fetch existing sellers & buyers ───────────────────────────────────────────
from app.models.seller import Seller
from app.models.buyer import Buyer

sellers = db.query(Seller).order_by(Seller.id).all()   # ids 1-5
buyers  = db.query(Buyer).order_by(Buyer.id).all()     # ids 1-5

# ── 1. Crear 50 ítems históricos (no aparecen en catálogo) ────────────────────
# (seller_idx, title, category, condition, brand, size, color, original, selling)
hist_items_data = [
    # Ropa — 15 ítems
    (0, "Pijama franela ositos 2pz",         "clothing",    "good",     "Carter's",     "9-12m",  "Azul",        420,  180),
    (1, "Vestido bautizo encaje blanco",      "clothing",    "like_new", "Mayoral",      "6m",     "Blanco",      1500, 700),
    (2, "Set invierno plumas bebé",           "clothing",    "good",     "Zara Baby",    "6-9m",   "Rojo",        980,  420),
    (3, "Mameluco punto fino rayas",          "clothing",    "like_new", "Petit Bateau", "3m",     "Azul/Blanco", 860,  400),
    (4, "Chaqueta denim niña",                "clothing",    "good",     "H&M",          "18m",    "Azul",        650,  280),
    (0, "Conjunto verano flores 2pz",         "clothing",    "good",     "Zara Baby",    "12m",    "Rosa",        580,  250),
    (1, "Abrigo lana camel bebé",             "clothing",    "like_new", "Mayoral",      "6m",     "Camel",       1800, 820),
    (2, "Bodies algodón pack 5",              "clothing",    "good",     "Carter's",     "0-3m",   "Surtido",     450,  190),
    (3, "Overol terciopelo navideño",         "clothing",    "like_new", "H&M",          "6-9m",   "Rojo",        520,  240),
    (4, "Sudadera canguro conejito",          "clothing",    "good",     "Zara Baby",    "24m",    "Gris",        480,  210),
    (0, "Pantalón jogger modal",              "clothing",    "like_new", "Carter's",     "12m",    "Marino",      350,  160),
    (1, "Vestido punto jacquard niña",        "clothing",    "good",     "Mayoral",      "18m",    "Verde",       780,  340),
    (2, "Set pañoleta + gorro recién nacido", "clothing",    "like_new", "Artesanal",    "RN",     "Blanco",      280,  130),
    (3, "Pelele algodón liso 4pz",            "clothing",    "good",     "H&M",          "3-6m",   "Pastel",      380,  170),
    (4, "Traje de baño SPF protección",       "clothing",    "like_new", "Speedo Baby",  "12m",    "Azul",        490,  220),

    # Carriolas y autos — 6 ítems
    (0, "Carriola paraguas ultraligera",      "strollers",   "good",     "Chicco",       None,     "Rojo",        4200, 1800),
    (1, "Silla auto grupo 1 isofix",          "strollers",   "like_new", "Britax",       None,     "Gris",        8900, 4100),
    (2, "Capazo bebé universal",              "strollers",   "good",     "Bugaboo",      None,     "Negro",        3600, 1600),
    (3, "Carriola doble gemelar",             "strollers",   "good",     "Graco",        None,     "Azul",        9500, 4200),
    (4, "Silla de auto reclinable grupo 2",   "strollers",   "like_new", "Cybex",        None,     "Negro",        7200, 3200),
    (0, "Bolsa capazo invierno",              "strollers",   "good",     "Jané",         None,     "Beige",        1200, 530),

    # Juguetes — 8 ítems
    (1, "Gimnasio de actividades arco",       "toys",        "good",     "Fisher-Price", None,     "Multicolor",  1400, 580),
    (2, "Sonajero de madera set 3pz",         "toys",        "like_new", "Plan Toys",    None,     "Natural",      320,  150),
    (3, "Cubo actividades 6 caras",           "toys",        "good",     "Bright Starts",None,     "Multicolor",   750,  320),
    (4, "Set figuras animales granja",        "toys",        "like_new", "Safari Ltd",   None,     "Surtido",      480,  210),
    (0, "Tren madera con circuito",           "toys",        "good",     "Brio",         None,     "Natural",     1900,  820),
    (1, "Libro sensorial tela bebé",          "toys",        "like_new", "Infantino",    None,     "Surtido",      280,  130),
    (2, "Teléfono arrastrar madera",          "toys",        "good",     "Plan Toys",    None,     "Natural",      360,  160),
    (3, "Pelota textura sensorial 4pz",       "toys",        "like_new", "Sassy",        None,     "Surtido",      420,  190),

    # Lactancia — 5 ítems
    (4, "Sacaleches manual Philips Avent",    "lactancy",    "good",     "Philips Avent",None,     "Blanco",      1600,  700),
    (0, "Cojín lactancia XL funda lavable",   "lactancy",    "like_new", "Boppy",        None,     "Gris marengo",  950,  420),
    (1, "Bolsas almacenamiento leche 100pz",  "lactancy",    "like_new", "Medela",       None,     "Transparente",  380,  170),
    (2, "Copas recoge leche materna",         "lactancy",    "like_new", "Haakaa",       None,     "Transparente",  520,  230),
    (3, "Funda discreta lactancia coche",     "lactancy",    "good",     "Bebe au Lait", None,     "Rosa",          680,  300),

    # Muebles — 5 ítems
    (4, "Cambiador madera con cajones",       "furniture",   "good",     "IKEA",         None,     "Blanco",      3200, 1400),
    (0, "Cuna convertible 3 en 1",           "furniture",   "like_new", "Micuna",       None,     "Blanco",      8500, 3800),
    (1, "Mecedora nursing sillón",            "furniture",   "good",     "Dutailier",    None,     "Gris",        6200, 2700),
    (2, "Hamaca bebé colgante",               "furniture",   "like_new", "Childhome",    None,     "Natural",     2800, 1200),
    (3, "Escalera aprendizaje madera",        "furniture",   "good",     "Pikler",       None,     "Natural",     4500, 1900),

    # Accesorios — 11 ítems
    (4, "Mochila portabebés SSC",             "accessories", "good",     "Tula",         None,     "Floral",      3800, 1650),
    (0, "Esterilizador eléctrico biberones",  "accessories", "like_new", "Philips Avent",None,     "Blanco",      1800,  800),
    (1, "Termómetro digital frente oído",     "accessories", "like_new", "Braun",        None,     "Blanco",       980,  440),
    (2, "Vigilabebés audio bidireccional",    "accessories", "good",     "Philips Avent",None,     "Blanco",      1400,  620),
    (3, "Set vajilla silicona bebé",          "accessories", "like_new", "Mushie",       None,     "Nude",         650,  290),
    (4, "Trona portátil plegable",            "accessories", "good",     "Inglesina",    None,     "Rojo",        2200,  960),
    (0, "Manta swaddle muselina 4pz",         "accessories", "like_new", "Aden+Anais",   None,     "Estampada",    780,  340),
    (1, "Chupetes 0-6m pack 4",               "accessories", "like_new", "MAM",          None,     "Surtido",      280,  130),
    (2, "Limpiapisos para biberones eléctrico","accessories","good",     "Tommee Tippee",None,     "Blanco",      1200,  530),
    (3, "Neceser viaje bebé organizer",       "accessories", "like_new", "Skip Hop",     None,     "Negro",        920,  410),
    (4, "Humidificador ultrasonido bebé",     "accessories", "good",     "Crane",        None,     "Blanco",      1600,  700),
]

hist_items = []
for n, (si, title, cat, cond, brand, size, color, orig, sell) in enumerate(hist_items_data, start=26):
    existing = db.query(Item).filter(Item.sku == sku(n)).first()
    if existing:
        hist_items.append(existing)
        continue
    sp, payout, commission = price(sell)
    received = days_ago(random.randint(90, 180))
    item = Item(
        sku=sku(n),
        title=title,
        category=ItemCategory(cat),
        condition=ItemCondition(cond),
        brand=brand,
        size=size,
        color=color,
        original_price=Decimal(str(orig)),
        selling_price=sp,
        seller_payout=payout,
        commission=commission,
        status=ItemStatus.SOLD,   # will be adjusted below per order status
        seller_id=sellers[si].id,
        is_featured=False,
        received_at=received,
        listed_at=received + timedelta(days=3),
    )
    db.add(item)
    hist_items.append(item)

db.flush()
print(f"Ítems históricos: {len(hist_items)} procesados")

# ── 2. Crear 50 pedidos en distintas fases ─────────────────────────────────────
CARRIERS = ["Estafeta", "FedEx", "DHL", "Redpack", "J&T Express"]
ADDRESSES = [
    "Av. Insurgentes Sur 1234, Col. Del Valle, CDMX",
    "Calle Ámsterdam 45, Col. Condesa, CDMX",
    "Blvd. Miguel de Cervantes Saavedra 303, Col. Granada, CDMX",
    "Av. Revolución 1500, Col. Guadalupe Inn, CDMX",
    "Calle Durango 180, Col. Roma Norte, CDMX",
]

# (item_idx 0-49, buyer_idx 0-4, status, shipping_method, order_days_ago, seller_paid, notes)
orders_plan = [
    # ── PENDING_PAYMENT (5) — checkout iniciado, no confirmado ──────────────────
    ( 0, 0, "pending_payment", "pickup",        1,   0, "Esperando confirmación de pago MP"),
    ( 1, 1, "pending_payment", "delivery_cdmx", 1,   0, None),
    ( 2, 2, "pending_payment", "parcel",         0,   0, "Checkout iniciado hace unos minutos"),
    ( 3, 3, "pending_payment", "pickup",         0,   0, None),
    ( 4, 4, "pending_payment", "delivery_cdmx",  2,   0, "Pago pendiente verificación"),

    # ── PAID (6) — pago confirmado, aún no preparamos ───────────────────────────
    ( 5, 0, "paid", "pickup",        3,  0, "Pago aprobado por MP"),
    ( 6, 1, "paid", "parcel",        2,  0, None),
    ( 7, 2, "paid", "delivery_cdmx", 4,  0, "Compradora confirmó pago por WhatsApp"),
    ( 8, 3, "paid", "parcel",        3,  0, None),
    ( 9, 4, "paid", "pickup",        5,  0, "Pago OXXO confirmado"),
    (10, 0, "paid", "delivery_cdmx", 2,  0, None),

    # ── PREPARING (7) — artículo separado del inventario ────────────────────────
    (11, 1, "preparing", "parcel",        6,  0, "Empacando con papel burbuja"),
    (12, 2, "preparing", "pickup",        5,  0, None),
    (13, 3, "preparing", "delivery_cdmx", 7,  0, "Lista para recoger hoy"),
    (14, 4, "preparing", "parcel",        4,  0, None),
    (15, 0, "preparing", "delivery_cdmx", 8,  0, "Coordinando ruta de entrega"),
    (16, 1, "preparing", "pickup",        5,  0, None),
    (17, 2, "preparing", "parcel",        6,  0, "Caja lista, por etiquetar"),

    # ── SHIPPED (8) — en camino ──────────────────────────────────────────────────
    (18, 3, "shipped", "parcel",         9,  0, None),
    (19, 4, "shipped", "parcel",        10,  0, "Entrega estimada 2 días"),
    (20, 0, "shipped", "parcel",         8,  0, None),
    (21, 1, "shipped", "delivery_cdmx", 11,  0, "Repartidor en camino"),
    (22, 2, "shipped", "parcel",         7,  0, None),
    (23, 3, "shipped", "parcel",        12,  0, "Paquete en ciudad destino"),
    (24, 4, "shipped", "delivery_cdmx", 10,  0, None),
    (25, 0, "shipped", "parcel",         9,  0, "Cliente notificado por WA"),

    # ── DELIVERED (14) — entregado, mix de pagado/no pagado a vendedora ─────────
    (26, 1, "delivered", "parcel",        20, 1, "Entregado y confirmado"),
    (27, 2, "delivered", "pickup",        25, 1, None),
    (28, 3, "delivered", "delivery_cdmx", 18, 1, "Cliente muy satisfecha"),
    (29, 4, "delivered", "parcel",        30, 1, None),
    (30, 0, "delivered", "parcel",        22, 1, "5 estrellas en WA"),
    (31, 1, "delivered", "pickup",        35, 1, "Recomendó a 2 amigas"),
    (32, 2, "delivered", "delivery_cdmx", 40, 1, None),
    (33, 3, "delivered", "parcel",        28, 0, "Pendiente pagar vendedora"),
    (34, 4, "delivered", "pickup",        15, 0, None),
    (35, 0, "delivered", "parcel",        17, 0, "Pago vendedora programado"),
    (36, 1, "delivered", "delivery_cdmx", 21, 0, None),
    (37, 2, "delivered", "parcel",        45, 1, "Vendedora cobró en efectivo"),
    (38, 3, "delivered", "parcel",        50, 1, None),
    (39, 4, "delivered", "pickup",        60, 1, "Fiel compradora, 3er pedido"),

    # ── CANCELLED (6) — cancelados, artículo devuelto a LISTED ──────────────────
    (40, 0, "cancelled", "parcel",        14, 0, "Compradora no se presentó"),
    (41, 1, "cancelled", "pickup",        20, 0, "Pago rechazado 2 veces"),
    (42, 2, "cancelled", "delivery_cdmx",  8, 0, None),
    (43, 3, "cancelled", "parcel",        30, 0, "Artículo ya no disponible"),
    (44, 4, "cancelled", "pickup",        12, 0, "Compradora canceló por cambio de talla"),
    (45, 0, "cancelled", "delivery_cdmx", 25, 0, None),

    # ── REFUNDED (4) — reembolso procesado ──────────────────────────────────────
    (46, 1, "refunded", "parcel",        35, 0, "Artículo llegó dañado en envío"),
    (47, 2, "refunded", "delivery_cdmx", 28, 0, "No coincidía con descripción"),
    (48, 3, "refunded", "parcel",        42, 0, "Reembolso MP procesado en 5 días"),
    (49, 4, "refunded", "pickup",        55, 0, "Devolución acordada con vendedora"),
]

# Map order status → item status
ITEM_STATUS_MAP = {
    "pending_payment": ItemStatus.SOLD,
    "paid":            ItemStatus.SOLD,
    "preparing":       ItemStatus.SOLD,
    "shipped":         ItemStatus.SHIPPED,
    "delivered":       ItemStatus.DELIVERED,
    "cancelled":       ItemStatus.LISTED,     # devuelto al catálogo
    "refunded":        ItemStatus.RETURNED,
}

created = 0
for order_n, (item_idx, buyer_idx, status, shipping, order_days, spaid, notes) in enumerate(orders_plan, start=1):
    if db.query(Order).filter(Order.order_number == ord_num(order_n)).first():
        continue

    item = hist_items[item_idx]
    buyer = buyers[buyer_idx]
    sp = item.selling_price
    payout = item.seller_payout
    commission = item.commission

    order_date = days_ago(order_days)

    # Tracking info for shipped/delivered
    tracking = None
    carrier = None
    if status in ("shipped", "delivered"):
        tracking = f"TRACK{random.randint(100000000, 999999999)}"
        carrier = random.choice(CARRIERS)

    # Shipping address for non-pickup
    address = None
    if shipping != "pickup":
        address = random.choice(ADDRESSES)

    # Fake MP payment ID for paid+
    mp_id = None
    if status not in ("pending_payment", "cancelled"):
        mp_id = f"MP{random.randint(10000000000, 99999999999)}"

    # seller_paid_at
    paid_at = None
    if spaid:
        paid_at = order_date + timedelta(days=random.randint(3, 10))

    order = Order(
        order_number=ord_num(order_n),
        buyer_id=buyer.id,
        item_id=item.id,
        amount=sp,
        commission_amount=commission,
        seller_payout_amount=payout,
        status=OrderStatus(status),
        mp_payment_id=mp_id,
        shipping_method=ShippingMethod(shipping),
        shipping_address=address,
        tracking_number=tracking,
        shipping_carrier=carrier,
        seller_paid=spaid,
        seller_paid_at=paid_at,
        notes=notes,
        created_at=order_date,
    )
    db.add(order)

    # Update item status + sold_at
    item.status = ITEM_STATUS_MAP[status]
    if status not in ("cancelled", "pending_payment"):
        item.sold_at = order_date
    if status == "cancelled":
        item.sold_at = None

    created += 1

db.commit()
print(f"Ordenes creadas: {created}")

# ── Summary ────────────────────────────────────────────────────────────────────
from app.models.order import OrderStatus as OS
counts = {s.value: db.query(Order).filter(Order.status == s).count() for s in OS}
total_revenue = sum(
    float(o.amount)
    for o in db.query(Order).filter(Order.status.in_([OS.PAID, OS.PREPARING, OS.SHIPPED, OS.DELIVERED])).all()
)
seller_pending = db.query(Order).filter(
    Order.status == OS.DELIVERED, Order.seller_paid == 0
).count()

print(f"""
╔══════════════════════════════════════════════════╗
║          MommyBazar — Seed Pedidos               ║
╠══════════════════════════════════════════════════╣
║  pending_payment : {counts.get('pending_payment',0):<4}                         ║
║  paid            : {counts.get('paid',0):<4}                         ║
║  preparing       : {counts.get('preparing',0):<4}                         ║
║  shipped         : {counts.get('shipped',0):<4}                         ║
║  delivered       : {counts.get('delivered',0):<4}                         ║
║  cancelled       : {counts.get('cancelled',0):<4}                         ║
║  refunded        : {counts.get('refunded',0):<4}                         ║
╠══════════════════════════════════════════════════╣
║  Total ordenes   : {sum(counts.values()):<4}                         ║
║  Revenue activo  : ${total_revenue:>10,.0f} MXN             ║
║  Pendiente pagar : {seller_pending:<4} vendedoras sin cobrar         ║
╚══════════════════════════════════════════════════╝
""")
db.close()

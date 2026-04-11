"""
Seed script — MommyBazar
Crea: 1 admin, 5 vendedoras, 5 compradoras, 25 artículos de inventario
Uso: python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.seller import Seller
from app.models.buyer import Buyer
from app.models.item import Item, ItemStatus, ItemCategory, ItemCondition

db = SessionLocal()

# ── Helpers ────────────────────────────────────────────────────────────────────
def now(): return datetime.now(timezone.utc)
def days_ago(n): return now() - timedelta(days=n)

def price(selling, pct=0.70):
    sp = Decimal(str(selling))
    payout = (sp * Decimal(str(pct))).quantize(Decimal("0.01"))
    commission = (sp - payout).quantize(Decimal("0.01"))
    return sp, payout, commission

def sku(n): return f"MB-2024-{n:05d}"

# ── 1. Admin user ──────────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == "admin@mommybazar.mx").first():
    db.add(User(
        email="admin@mommybazar.mx",
        full_name="Admin MommyBazar",
        hashed_password=hash_password("mommy2024"),
        is_active=True,
        is_superuser=True,
    ))
    db.commit()
    print("✅ Admin creado: admin@mommybazar.mx / mommy2024")
else:
    print("ℹ️  Admin ya existe")

# ── 2. Vendedoras ──────────────────────────────────────────────────────────────
sellers_data = [
    dict(full_name="Sofía Ramírez López",    phone="+525511111001", email="sofia@gmail.com",    neighborhood="Polanco",          city="Ciudad de México", bank_name="BBVA",      clabe="012180001234567890", is_approved=True),
    dict(full_name="Valeria Torres Mendoza",  phone="+525511111002", email="vale@gmail.com",     neighborhood="Condesa",          city="Ciudad de México", bank_name="Santander", clabe="014180002345678901", is_approved=True),
    dict(full_name="Camila Hernández Ruiz",   phone="+525511111003", email="camila@gmail.com",   neighborhood="Coyoacán",         city="Ciudad de México", bank_name="Banamex",   clabe="002180003456789012", is_approved=True),
    dict(full_name="Isabella Morales Vega",   phone="+525511111004", email="isa@gmail.com",      neighborhood="Roma Norte",       city="Ciudad de México", bank_name="BBVA",      clabe="012180004567890123", is_approved=False),
    dict(full_name="Daniela Castro Fuentes",  phone="+525511111005", email="dani@gmail.com",     neighborhood="Santa Fe",         city="Ciudad de México", bank_name="HSBC",      clabe="021180005678901234", is_approved=True),
]
sellers = []
for sd in sellers_data:
    s = db.query(Seller).filter(Seller.phone == sd["phone"]).first()
    if not s:
        s = Seller(**sd, password_hash=hash_password("vendedora123"), is_active=True)
        db.add(s)
        db.flush()
    sellers.append(s)
db.commit()
print(f"✅ {len(sellers)} vendedoras listas")

# ── 3. Compradoras ─────────────────────────────────────────────────────────────
buyers_data = [
    dict(full_name="Ana García Martínez",    phone="+525522221001", email="ana@gmail.com",    neighborhood="Narvarte",     city="Ciudad de México", is_approved=True),
    dict(full_name="Lucía Pérez Sánchez",    phone="+525522221002", email="lucia@gmail.com",  neighborhood="Del Valle",    city="Ciudad de México", is_approved=True),
    dict(full_name="Marina López Jiménez",   phone="+525522221003", email="marina@gmail.com", neighborhood="Insurgentes",  city="Ciudad de México", is_approved=False),
    dict(full_name="Fernanda Díaz Reyes",    phone="+525522221004", email="fer@gmail.com",    neighborhood="Tlalpan",      city="Ciudad de México", is_approved=True),
    dict(full_name="Gabriela Ortiz Vargas",  phone="+525522221005", email="gabi@gmail.com",   neighborhood="Xochimilco",   city="Ciudad de México", is_approved=True),
]
buyers = []
for bd in buyers_data:
    b = db.query(Buyer).filter(Buyer.phone == bd["phone"]).first()
    if not b:
        b = Buyer(**bd, password_hash=hash_password("compradora123"), is_active=True)
        db.add(b)
        db.flush()
    buyers.append(b)
db.commit()
print(f"✅ {len(buyers)} compradoras listas")

# ── 4. Artículos ───────────────────────────────────────────────────────────────
# (seller_idx, title, category, condition, brand, size, color, original, selling, notes, listed_days_ago, featured)
items_data = [
    # Sofía (0)
    (0, "Conjunto floral manga larga bebé",      "clothing",    "like_new", "Zara Baby",   "3-6m",  "Rosa",     750,  350, "Usado 2 veces, impecable",         5,  True),
    (0, "Mameluco dinosaurio algodón",            "clothing",    "good",     "H&M",         "6-9m",  "Verde",    480,  200, "Sin manchas, botones en perfecto estado", 12, False),
    (0, "Vestido fiesta tul blanco",              "clothing",    "like_new", "Mayoral",     "12m",   "Blanco",   1200, 580, "Solo se usó en bautizo",           3,  True),
    (0, "Set 3 bodies manga corta",               "clothing",    "good",     "Carter's",    "0-3m",  "Surtido",  350,  150, "Lavados, sin desgaste",            20, False),
    (0, "Saco tejido artesanal bebé",             "clothing",    "like_new", "Artesanal",   "3-6m",  "Crema",    400,  220, "Tejido a mano, regalo que no usamos", 8, False),

    # Valeria (1)
    (1, "Carriola travel system Graco",           "strollers",   "good",     "Graco",       None,    "Gris",     8500, 3800, "Usado 8 meses, ruedas perfectas", 15, True),
    (1, "Silla de auto Chicco grupo 0+",          "strollers",   "like_new", "Chicco",      None,    "Negro",    6200, 3200, "Menos de 1 año de uso",           7,  True),
    (1, "Andador musical 4 ruedas",               "toys",        "good",     "Bright Starts", None,  "Multicolor", 950, 380, "Funciona perfecto, pilas nuevas", 22, False),
    (1, "Bañera plegable con soporte",            "accessories", "like_new", "Bebe Due",    None,    "Azul",     650,  290, "Casi sin uso",                    10, False),
    (1, "Bouncer mecedora Fischer Price",          "accessories", "good",     "Fisher-Price", None,   "Beige",    1800, 750, "Funciona perfecto, limpio",       18, False),

    # Camila (2)
    (2, "Bomba extractor de leche eléctrica",     "lactancy",    "good",     "Medela",      None,    "Blanco",   3200, 1400, "Kit completo, piezas nuevas",    4,  True),
    (2, "Set copas de lactancia silicona",        "lactancy",    "like_new", "Haakaa",      None,    "Transparente", 450, 200, "2 piezas, esterilizadas",      6,  False),
    (2, "Cojín de lactancia C",                   "lactancy",    "good",     "Boppy",       None,    "Gris",     780,  340, "Funda lavada, firme",            25, False),
    (2, "Cuna portátil plegable",                 "furniture",   "good",     "Baby Trend",  None,    "Beige",    4500, 1900, "Colchón incluido, lavable",      30, False),
    (2, "Monitor de bebé con video",              "accessories", "like_new", "Motorola",    None,    "Blanco",   2800, 1300, "Imagen clara, alcance 300m",     11, True),

    # Isabella (3)
    (3, "Juguete de actividades tapete",          "toys",        "good",     "Tiny Love",   None,    "Multicolor", 1200, 520, "Arco completo, lavado",         8,  False),
    (3, "Set bloques blandos apilables 20pz",     "toys",        "like_new", "Infantino",   None,    "Surtido",  680,  280, "Completo, sin mordidas",         14, False),
    (3, "Pelele punto algodón orgánico",           "clothing",    "like_new", "Petit Bateau","6m",    "Azul marino", 890, 420, "Primera calidad, etiquetas",    2,  True),
    (3, "Silla alta de madera regulable",          "furniture",   "good",     "Stokke",      None,    "Natural",  9800, 4200, "Regulable 6m-10 años",          35, True),
    (3, "Portabebés ergonómico",                   "accessories", "good",     "Ergobaby",    None,    "Negro",    3500, 1600, "Posiciones múltiples, limpio",  20, False),

    # Daniela (4)
    (4, "Vestido punto rayas marineras",           "clothing",    "like_new", "Zara",        "18m",   "Azul/Blanco", 620, 290, "Como nuevo",                  3,  False),
    (4, "Pijama 2 piezas osito polar",             "clothing",    "good",     "H&M",         "12-18m","Gris",    380,  160, "Suave, perfecto",               16, False),
    (4, "Cambiador portátil con bolsa",            "accessories", "like_new", "Skip Hop",    None,    "Negro",    1100, 480, "Incluye bolsa y accesorios",    9,  False),
    (4, "Mochila pañalera grande",                 "accessories", "good",     "Béaba",       None,    "Mostaza",  1400, 600, "Compartimentos, lavada",        27, False),
    (4, "Piano de suelo musical interactivo",      "toys",        "good",     "Fisher-Price", None,   "Multicolor", 850, 360, "Funciona todo, limpio",       19, False),
]

created = 0
for idx, (si, title, cat, cond, brand, size, color, orig, sell, notes, listed_ago, featured) in enumerate(items_data, start=1):
    if db.query(Item).filter(Item.sku == sku(idx)).first():
        continue
    sp, payout, commission = price(sell)
    listed_at = days_ago(listed_ago)
    item = Item(
        sku=sku(idx),
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
        notes=notes,
        status=ItemStatus.LISTED,
        seller_id=sellers[si].id,
        is_featured=featured,
        received_at=listed_at - timedelta(days=3),
        listed_at=listed_at,
    )
    db.add(item)
    created += 1

db.commit()
print(f"✅ {created} artículos creados")

# ── Summary ────────────────────────────────────────────────────────────────────
total_items = db.query(Item).count()
total_sellers = db.query(Seller).count()
total_buyers = db.query(Buyer).count()
total_value = sum(float(i.selling_price) for i in db.query(Item).filter(Item.status == ItemStatus.LISTED).all())

print(f"""
╔══════════════════════════════════════════╗
║         MommyBazar — Seed completo       ║
╠══════════════════════════════════════════╣
║  Admin:      admin@mommybazar.mx         ║
║  Password:   mommy2024                   ║
╠══════════════════════════════════════════╣
║  Vendedoras: {total_sellers:<4} (pass: vendedora123)   ║
║  Compradoras:{total_buyers:<4} (pass: compradora123)  ║
║  Artículos:  {total_items:<4} publicados               ║
║  Valor total: ${total_value:>10,.0f} MXN        ║
╚══════════════════════════════════════════╝
""")
db.close()

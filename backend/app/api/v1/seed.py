"""
One-time demo data seeder.
POST /api/v1/seed/demo  (admin auth required)
Creates: 8 sellers, 20 buyers, 100 items, 25 orders, WA messages.
"""
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.security import hash_password
from app.models.seller import Seller
from app.models.buyer import Buyer
from app.models.item import Item, ItemStatus, ItemCategory, ItemCondition, ItemGender
from app.models.order import Order, OrderStatus, ShippingMethod
from app.models.whatsapp import WhatsAppMessage, MessageDirection, MessageType

router = APIRouter(prefix="/seed", tags=["seed"])

# ── Static seed data ───────────────────────────────────────────────────────────

SELLERS = [
    {"full_name": "María González Pérez",   "phone": "+525511001001", "email": "maria.gonzalez@test.com",   "neighborhood": "Polanco",      "bank_name": "BBVA",    "clabe": "012180001234500001"},
    {"full_name": "Ana Martínez López",      "phone": "+525511001002", "email": "ana.martinez@test.com",     "neighborhood": "Condesa",      "bank_name": "Banamex", "clabe": "002180001234500002"},
    {"full_name": "Sofía López Ramírez",     "phone": "+525511001003", "email": "sofia.lopez@test.com",      "neighborhood": "Coyoacán",     "bank_name": "HSBC",    "clabe": "021180001234500003"},
    {"full_name": "Valentina Rodríguez",     "phone": "+525511001004", "email": "valentina.r@test.com",      "neighborhood": "Narvarte",     "bank_name": "Santander","clabe": "014180001234500004"},
    {"full_name": "Daniela García Flores",   "phone": "+525511001005", "email": "daniela.garcia@test.com",   "neighborhood": "Del Valle",    "bank_name": "BBVA",    "clabe": "012180001234500005"},
    {"full_name": "Fernanda Hernández",      "phone": "+525511001006", "email": "fernanda.h@test.com",       "neighborhood": "Roma Norte",   "bank_name": "Banorte", "clabe": "006180001234500006"},
    {"full_name": "Paola Jiménez Soto",      "phone": "+525511001007", "email": "paola.jimenez@test.com",    "neighborhood": "Satélite",     "bank_name": "BBVA",    "clabe": "012180001234500007"},
    {"full_name": "Claudia Morales Vega",    "phone": "+525511001008", "email": "claudia.morales@test.com",  "neighborhood": "Pedregal",     "bank_name": "Banamex", "clabe": "002180001234500008"},
]

BUYERS = [
    {"full_name": "Laura Sánchez Torres",    "phone": "+525511002001", "email": "laura.s@test.com",    "neighborhood": "Narvarte"},
    {"full_name": "Gabriela Ruiz Mendoza",   "phone": "+525511002002", "email": "gaby.r@test.com",     "neighborhood": "Tlalpan"},
    {"full_name": "Patricia Vega Cruz",      "phone": "+525511002003", "email": "paty.v@test.com",     "neighborhood": "Xochimilco"},
    {"full_name": "Carmen Díaz Reyes",       "phone": "+525511002004", "email": "carmen.d@test.com",   "neighborhood": "Iztapalapa"},
    {"full_name": "Rosa Castillo Mora",      "phone": "+525511002005", "email": "rosa.c@test.com",     "neighborhood": "Magdalena Contreras"},
    {"full_name": "Elena Vargas Ríos",       "phone": "+525511002006", "email": "elena.v@test.com",    "neighborhood": "Cuajimalpa"},
    {"full_name": "Isabel Flores Guzmán",    "phone": "+525511002007", "email": "isabel.f@test.com",   "neighborhood": "Álvaro Obregón"},
    {"full_name": "Martha Romero Salinas",   "phone": "+525511002008", "email": "martha.r@test.com",   "neighborhood": "Azcapotzalco"},
    {"full_name": "Alicia Peña Herrera",     "phone": "+525511002009", "email": "alicia.p@test.com",   "neighborhood": "Gustavo Madero"},
    {"full_name": "Beatriz Cruz Luna",       "phone": "+525511002010", "email": "bea.c@test.com",      "neighborhood": "Venustiano Carranza"},
    {"full_name": "Silvia Moreno Zavala",    "phone": "+525511002011", "email": "silvia.m@test.com",   "neighborhood": "Tláhuac"},
    {"full_name": "Norma Reyes Aguilar",     "phone": "+525511002012", "email": "norma.r@test.com",    "neighborhood": "Milpa Alta"},
    {"full_name": "Rebeca Torres Leal",      "phone": "+525511002013", "email": "rebeca.t@test.com",   "neighborhood": "Benito Juárez"},
    {"full_name": "Adriana Medina Soto",     "phone": "+525511002014", "email": "adriana.m@test.com",  "neighborhood": "Miguel Hidalgo"},
    {"full_name": "Verónica Campos Duarte",  "phone": "+525511002015", "email": "vero.c@test.com",     "neighborhood": "Cuauhtémoc"},
    {"full_name": "Leticia Fuentes Mora",    "phone": "+525511002016", "email": "lety.f@test.com",     "neighborhood": "Iztacalco"},
    {"full_name": "Esperanza Ramos Pedraza", "phone": "+525511002017", "email": "espe.r@test.com",     "neighborhood": "Coyoacán"},
    {"full_name": "Yolanda Ortega Blanco",   "phone": "+525511002018", "email": "yoli.o@test.com",     "neighborhood": "La Magdalena"},
    {"full_name": "Sandra Guerrero Ponce",   "phone": "+525511002019", "email": "sandy.g@test.com",    "neighborhood": "Tlalpan"},
    {"full_name": "Diana Ávila Serrano",     "phone": "+525511002020", "email": "diana.a@test.com",    "neighborhood": "Xochimilco"},
]

ITEMS_DATA = [
    # ── ROPA (35) ──────────────────────────────────────────────────────────────
    ("Conjunto floral niña manga larga",        "clothing", "like_new", "Zara Kids",  "3m",  "Rosa",       380,  650,  "girl"),
    ("Pijama estrellas algodón niño",           "clothing", "good",     "Carter's",   "6m",  "Azul",       220,  None, "boy"),
    ("Vestido bordado rosa fiesta",             "clothing", "like_new", "Monnalisa",  "12m", "Rosa",       750,  1200, "girl"),
    ("Mameluco rayas marinero",                 "clothing", "like_new", "H&M",        "0m",  "Azul/Blanco",180,  None, "unisex"),
    ("Set verano 3 piezas niña",                "clothing", "good",     "Carters",    "18m", "Verde menta",350,  580,  "girl"),
    ("Pants tejido gris suave",                 "clothing", "like_new", "GAP",        "9m",  "Gris",       290,  None, "unisex"),
    ("Chamarra impermeable niño",               "clothing", "good",     "Columbia",   "2a+", "Azul marino",680,  1100, "boy"),
    ("Bodies algodón pack x3",                  "clothing", "like_new", "Carter's",   "0m",  "Blanco",     250,  400,  "unisex"),
    ("Leggings flores estampadas",              "clothing", "like_new", "Zara Baby",  "3m",  "Multicolor", 190,  None, "girl"),
    ("Sudadera unicornio bordado",              "clothing", "good",     "H&M",        "6m",  "Lila",       310,  None, "girl"),
    ("Traje de baño niña volantes",             "clothing", "like_new", "Speedo",     "18m", "Coral",      320,  520,  "girl"),
    ("Short bermuda cargo niño",                "clothing", "good",     "GAP",        "12m", "Caqui",      240,  None, "boy"),
    ("Blusa volantes fiesta",                   "clothing", "like_new", "Zara",       "9m",  "Blanco",     280,  None, "girl"),
    ("Pantalón jeans slim fit niño",            "clothing", "good",     "Levi's",     "6m",  "Azul",       350,  600,  "boy"),
    ("Playera deportiva dry fit",               "clothing", "like_new", "Nike",       "2a+", "Negra",      420,  720,  "boy"),
    ("Vestido de cumpleaños tutú",              "clothing", "like_new", "Baby Dior",  "12m", "Rosa",       890,  1500, "girl"),
    ("Conjunto navideño rojo",                  "clothing", "good",     "Carter's",   "3m",  "Rojo",       290,  None, "unisex"),
    ("Pijama dinosaurios 2 piezas",             "clothing", "like_new", "Gerber",     "18m", "Verde",      280,  450,  "boy"),
    ("Chamarra azul marino polar",              "clothing", "good",     "OshKosh",    "9m",  "Azul marino",450,  780,  "unisex"),
    ("Jumpsuit rayas verano niña",              "clothing", "like_new", "Zara Baby",  "6m",  "Blanco/Azul",310,  None, "girl"),
    ("Set básico bodies pack x5",               "clothing", "like_new", "Gerber",     "0m",  "Pastel",     390,  650,  "unisex"),
    ("Pants polar suave beige",                 "clothing", "good",     "H&M",        "12m", "Beige",      240,  None, "unisex"),
    ("Vestido casual floreado",                 "clothing", "like_new", "Mango Baby", "3m",  "Amarillo",   350,  None, "girl"),
    ("Conjunto deportivo rosa completo",        "clothing", "good",     "Adidas",     "2a+", "Rosa",       580,  950,  "girl"),
    ("Blusa bordada estilo mexicano",           "clothing", "like_new", "Artesanal",  "18m", "Multicolor", 420,  None, "girl"),
    ("Mameluco formal bautizo niño",            "clothing", "like_new", "Ralph Lauren","0m", "Blanco",     680,  1100, "boy"),
    ("Jeans con elástico ajustable",            "clothing", "good",     "Carter's",   "12m", "Azul",       290,  None, "boy"),
    ("Falda tutú princesa 3 capas",             "clothing", "like_new", "Tu Tu",      "9m",  "Rosa",       340,  None, "girl"),
    ("Camiseta gráfica dinosaurios",            "clothing", "good",     "GAP",        "2a+", "Gris",       220,  None, "boy"),
    ("Conjunto lino verano 2 piezas",           "clothing", "like_new", "Mango Baby", "6m",  "Beige",      420,  700,  "girl"),
    ("Pijama caricaturas manga larga",          "clothing", "good",     "Gerber",     "2a+", "Azul",       270,  None, "unisex"),
    ("Bodies sin manga pack x3",                "clothing", "like_new", "Carters",    "3m",  "Blanco",     230,  None, "unisex"),
    ("Leggings estampados 2 piezas",            "clothing", "good",     "H&M",        "18m", "Multicolor", 210,  None, "girl"),
    ("Suéter tejido grueso invierno",           "clothing", "like_new", "Zara Kids",  "12m", "Mostaza",    380,  620,  "unisex"),
    ("Traje formal bautizo niño blanco",        "clothing", "like_new", "Bebe",       "0m",  "Blanco",     720,  1200, "boy"),

    # ── JUGUETES (20) ──────────────────────────────────────────────────────────
    ("Pelota sonajera colores Fisher Price",    "toys",     "like_new", "Fisher-Price",None,  "Multicolor", 280,  450,  None),
    ("Gimnasio de actividades musical",         "toys",     "good",     "Bright Starts",None, "Multicolor", 890,  1500, None),
    ("Peluche oso gigante suave",               "toys",     "like_new", "Ty",          None,  "Café",       650,  None, None),
    ("Set bloques madera 50 piezas",            "toys",     "good",     "Hape",        None,  "Natural",    780,  1300, None),
    ("Carrito empujar madera andadera",         "toys",     "like_new", "Janod",       None,  "Natural",    920,  1500, None),
    ("Piano musical bebé luces",                "toys",     "good",     "Fisher-Price",None,  "Colorido",   450,  750,  None),
    ("Rompecabezas 24 piezas animales",         "toys",     "like_new", "Ravensburger",None, "Multicolor",  320,  None, None),
    ("Set cocina juguete completo",             "toys",     "good",     "KidKraft",    None,  "Rosa/Gris",  2100, 3500, None),
    ("Muñeca con accesorios 30cm",              "toys",     "like_new", "Baby Born",   None,  "Rosa",       890,  1400, None),
    ("Xilófono madera colores",                 "toys",     "like_new", "Hape",        None,  "Multicolor", 340,  None, None),
    ("Juego de mesa Don't Break the Ice",       "toys",     "good",     "Hasbro",      None,  "Azul",       420,  None, None),
    ("Tobogán plástico jardín infantil",        "toys",     "good",     "Little Tikes",None,  "Amarillo",   1800, 3000, None),
    ("Colección Hot Wheels 20 carros",          "toys",     "like_new", "Hot Wheels",  None,  "Multicolor", 650,  None, None),
    ("Set herramientas mecánico niño",          "toys",     "good",     "Black & Decker Jr",None,"Amarillo", 580, 950,  None),
    ("Juego de médico maletín completo",        "toys",     "like_new", "Klein",       None,  "Verde",      490,  None, None),
    ("Triciclo con empujadera rosa",            "toys",     "good",     "Kettler",     None,  "Rosa",       1450, 2400, None),
    ("Cubo Rubik velocidad 3x3",                "toys",     "like_new", "GAN",         None,  "Multicolor", 380,  None, None),
    ("Set pintura lavable 24 colores",          "toys",     "good",     "Crayola",     None,  "Multicolor", 290,  None, None),
    ("Pelele bebé peluche dinosaurio",          "toys",     "like_new", "Jellycat",    None,  "Verde",      750,  1200, None),
    ("Tren madera con rieles 30 piezas",        "toys",     "good",     "BRIO",        None,  "Natural",    1650, 2800, None),

    # ── MUEBLES (15) ──────────────────────────────────────────────────────────
    ("Cuna convertible madera blanca",          "furniture","good",     "Chicco",      None,  "Blanco",     4500, 8000, None),
    ("Cambiador con cajones madera",            "furniture","like_new", "IKEA",        None,  "Blanco",     3200, 5500, None),
    ("Silla de comer alta plegable",            "furniture","good",     "Chicco",      None,  "Gris",       1800, 3000, None),
    ("Corral cuadrado plegable portátil",       "furniture","like_new", "Graco",       None,  "Gris/Azul",  2400, 4000, None),
    ("Mecedora lactancia nursing chair",        "furniture","good",     "Dutailier",   None,  "Beige",      5200, 9000, None),
    ("Mesa y sillas niños madera",              "furniture","like_new", "IKEA",        None,  "Natural",    1900, None, None),
    ("Tapete espuma EVA colores 9 pzas",        "furniture","good",     "Skip Hop",    None,  "Multicolor", 780,  1300, None),
    ("Bouncer vibratorio musical",              "furniture","like_new", "Fisher-Price",None,  "Gris",       1650, 2800, None),
    ("Cuna moisés portátil con stand",          "furniture","good",     "Chicco",      None,  "Gris",       3800, 6500, None),
    ("Columpio eléctrico 6 velocidades",        "furniture","like_new", "Graco",       None,  "Gris/Blanco",3200, 5500, None),
    ("Hamaca porta bebé tejida",                "furniture","good",     "Ergobaby",    None,  "Azul",       890,  1500, None),
    ("Silla reclinable ajustable",              "furniture","like_new", "BabyBjörn",   None,  "Gris",       2100, 3600, None),
    ("Andadera musical luces",                  "furniture","good",     "Chicco",      None,  "Multicolor", 1200, None, None),
    ("Periquera madera convertible",            "furniture","like_new", "KidKraft",    None,  "Natural",    2800, 4800, None),
    ("Cuna viaje compacta con moisés",          "furniture","good",     "Graco",       None,  "Gris",       2200, 3800, None),

    # ── CARRIOLAS (10) ──────────────────────────────────────────────────────────
    ("Travel system 3 en 1 completo",           "strollers","good",     "Graco",       None,  "Gris/Negro", 6500, 11000,None),
    ("Cochecito paraguas ultraligero",          "strollers","like_new", "Maclaren",    None,  "Negro",      3800, 6500, None),
    ("Silla paseo reclinable completa",         "strollers","good",     "Maxi-Cosi",   None,  "Gris",       5200, 8800, None),
    ("Carriola todo terreno ruedas grandes",    "strollers","like_new", "Bugaboo",     None,  "Verde olivo",8500, 15000,None),
    ("Sistema modular adaptable",               "strollers","good",     "Uppababy",    None,  "Azul marino",7200, 12500,None),
    ("Cochecito deportivo jogging",             "strollers","like_new", "BOB",         None,  "Rojo",       6800, 11500,None),
    ("Silla de auto grupo 0+1 isofix",          "strollers","good",     "Chicco",      None,  "Negro",      3200, 5500, None),
    ("Carriola gemelar side by side",           "strollers","like_new", "Joovy",       None,  "Azul",       5800, 9800, None),
    ("Triciclo evolutivo 4 en 1",               "strollers","good",     "Chicco",      None,  "Rosa",       2400, 4200, None),
    ("Moisés portátil ruedas plegable",         "strollers","like_new", "Inglesina",   None,  "Gris",       2800, 4800, None),

    # ── LACTANCIA (10) ──────────────────────────────────────────────────────────
    ("Extractor leche doble eléctrico",         "lactancy", "good",     "Medela",      None,  "Blanco",     2800, 4800, None),
    ("Cojín de lactancia cuña",                 "lactancy", "like_new", "Boppy",       None,  "Gris/Blanco",680,  None, None),
    ("Biberones anticólico set x6",             "lactancy", "good",     "Dr. Brown's", None,  "Transparente",780, 1300, None),
    ("Esterilizador microondas 6 biberones",    "lactancy", "like_new", "Philips Avent",None, "Blanco",     980,  1600, None),
    ("Calentador biberones portátil",           "lactancy", "good",     "Philips Avent",None, "Blanco",     750,  None, None),
    ("Baberos silicona con bolsillo x5",        "lactancy", "like_new", "EZPZ",        None,  "Multicolor", 420,  None, None),
    ("Plato silicona con ventosa",              "lactancy", "good",     "EZPZ",        None,  "Verde",      380,  None, None),
    ("Set destete cucharas silicona",           "lactancy", "like_new", "NumNum",      None,  "Coral",      290,  None, None),
    ("Monitor bebé digital con pantalla",       "lactancy", "good",     "Motorola",    None,  "Blanco",     1850, 3200, None),
    ("Almohada antireflujo cuña",               "lactancy", "like_new", "Clevamama",   None,  "Gris",       580,  None, None),

    # ── ACCESORIOS (10) ──────────────────────────────────────────────────────────
    ("Pañalera grande impermeable",             "accessories","like_new","Skip Hop",   None,  "Gris",       890,  1500, None),
    ("Portabebé ergonómico 4 posiciones",       "accessories","good",    "Ergobaby",   None,  "Negro",      2200, 3800, None),
    ("Mochila preescolar con ruedas",           "accessories","like_new","Trunki",     None,  "Azul",       1200, 2000, None),
    ("Termómetro digital axila",                "accessories","like_new","Braun",      None,  "Blanco",     580,  None, None),
    ("Andadera musical luces sonidos",          "accessories","good",    "Chicco",     None,  "Multicolor", 980,  1600, None),
    ("Set cubiertos aprendizaje silicona",      "accessories","like_new","NumNum",     None,  "Coral",      290,  None, None),
    ("Pelela musical con canciones",            "accessories","good",    "Fisher-Price",None, "Blanco",     450,  None, None),
    ("Reductor WC adaptador niños",             "accessories","like_new","BabyBjörn",  None,  "Blanco",     680,  None, None),
    ("Kit viaje organizador 5 piezas",          "accessories","good",    "Skip Hop",   None,  "Gris/Azul",  480,  None, None),
    ("Humidificador silencioso bebé",           "accessories","like_new","Crane",      None,  "Blanco",     1450, 2400, None),
]

WA_MESSAGES = [
    "¡Hola! Me llega tu artículo mañana, ¿a qué hora puedo pasar?",
    "Hola, ¿el conjunto floral está disponible en talla 6m?",
    "Muchas gracias por la atención, llegó perfecto el pedido 🙏",
    "¿Hacen envíos a Querétaro?",
    "El cochecito que me llegó está en perfectas condiciones, gracias!",
    "¿Tienen más colores de la silla de comer?",
    "Hola, me gustaría apartar la carriola Graco.",
    "¿Aceptan tarjeta de crédito?",
    "El oso peluche es igualito a las fotos, mi bebé lo adora 💕",
    "¿Cuándo tienen nueva mercancía de ropa niña?",
]


@router.post("/demo")
def seed_demo(db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Seller).filter(Seller.phone.like("+5255110010%")).count() > 0:
        raise HTTPException(status_code=400, detail="Demo ya fue cargado. Usa /seed/reset para limpiar primero.")

    now = datetime.now(timezone.utc)
    pw = hash_password("Demo2024!")

    # ── 1. Sellers ────────────────────────────────────────────────────────────
    sellers = []
    for s in SELLERS:
        seller = Seller(
            full_name=s["full_name"], phone=s["phone"], email=s["email"],
            neighborhood=s["neighborhood"], city="Ciudad de México",
            bank_name=s.get("bank_name"), clabe=s.get("clabe"),
            is_active=True, is_approved=True,
            password_hash=pw,
        )
        db.add(seller)
    db.flush()
    sellers = db.query(Seller).filter(Seller.phone.like("+5255110010%")).order_by(Seller.id).all()

    # ── 2. Buyers ─────────────────────────────────────────────────────────────
    buyers = []
    for b in BUYERS:
        buyer = Buyer(
            full_name=b["full_name"], phone=b["phone"], email=b["email"],
            neighborhood=b["neighborhood"], city="Ciudad de México",
            is_active=True,
        )
        db.add(buyer)
    db.flush()
    buyers = db.query(Buyer).filter(Buyer.phone.like("+5255110020%")).order_by(Buyer.id).all()

    # ── 3. Items ──────────────────────────────────────────────────────────────
    base_count = db.query(Item).count()
    year = now.year
    items_created = []

    cat_map = {
        "clothing":    ItemCategory.CLOTHING,
        "toys":        ItemCategory.TOYS,
        "furniture":   ItemCategory.FURNITURE,
        "strollers":   ItemCategory.STROLLERS,
        "lactancy":    ItemCategory.LACTANCY,
        "accessories": ItemCategory.ACCESSORIES,
    }
    cond_map = {
        "like_new": ItemCondition.LIKE_NEW,
        "good":     ItemCondition.GOOD,
        "fair":     ItemCondition.FAIR,
    }
    gender_map = {
        "girl":    ItemGender.GIRL,
        "boy":     ItemGender.BOY,
        "unisex":  ItemGender.UNISEX,
        None:      None,
    }

    for idx, row in enumerate(ITEMS_DATA):
        title, cat, cond, brand, size, color, sell_price, orig_price, gender = row
        sku = f"MB-{year}-{base_count + idx + 1:05d}"
        commission = round(sell_price * 0.30, 2)
        payout     = round(sell_price * 0.70, 2)
        seller = sellers[idx % len(sellers)]
        days_ago = random.randint(2, 60)
        item = Item(
            sku=sku,
            title=title,
            category=cat_map[cat],
            condition=cond_map[cond],
            brand=brand,
            size=size,
            color=color,
            gender=gender_map.get(gender),
            selling_price=sell_price,
            original_price=orig_price,
            commission=commission,
            seller_payout=payout,
            status=ItemStatus.LISTED,
            is_featured=(idx % 7 == 0),
            seller_id=seller.id,
            listed_at=now - timedelta(days=days_ago),
            received_at=now - timedelta(days=days_ago + 5),
            created_at=now - timedelta(days=days_ago + 6),
        )
        db.add(item)
        items_created.append(item)

    db.flush()

    # ── 4. Orders (25) ────────────────────────────────────────────────────────
    # Pick 25 items — spread across statuses
    orderable = items_created[:25]
    order_configs = [
        # (item_idx, order_status, item_status, days_ago)
        (0,  OrderStatus.PENDING_PAYMENT, ItemStatus.SOLD,      1),
        (1,  OrderStatus.PENDING_PAYMENT, ItemStatus.SOLD,      2),
        (2,  OrderStatus.PENDING_PAYMENT, ItemStatus.SOLD,      0),
        (3,  OrderStatus.PENDING_PAYMENT, ItemStatus.SOLD,      1),
        (4,  OrderStatus.PENDING_PAYMENT, ItemStatus.SOLD,      3),
        (5,  OrderStatus.PAID,            ItemStatus.SOLD,      5),
        (6,  OrderStatus.PAID,            ItemStatus.SOLD,      4),
        (7,  OrderStatus.PAID,            ItemStatus.SOLD,      6),
        (8,  OrderStatus.PAID,            ItemStatus.SOLD,      7),
        (9,  OrderStatus.PAID,            ItemStatus.SOLD,      5),
        (10, OrderStatus.PREPARING,       ItemStatus.SOLD,      8),
        (11, OrderStatus.PREPARING,       ItemStatus.SOLD,      9),
        (12, OrderStatus.PREPARING,       ItemStatus.SOLD,      7),
        (13, OrderStatus.PREPARING,       ItemStatus.SOLD,      10),
        (14, OrderStatus.PREPARING,       ItemStatus.SOLD,      8),
        (15, OrderStatus.SHIPPED,         ItemStatus.SHIPPED,   12),
        (16, OrderStatus.SHIPPED,         ItemStatus.SHIPPED,   14),
        (17, OrderStatus.SHIPPED,         ItemStatus.SHIPPED,   11),
        (18, OrderStatus.SHIPPED,         ItemStatus.SHIPPED,   13),
        (19, OrderStatus.SHIPPED,         ItemStatus.SHIPPED,   15),
        (20, OrderStatus.DELIVERED,       ItemStatus.DELIVERED, 20),
        (21, OrderStatus.DELIVERED,       ItemStatus.DELIVERED, 25),
        (22, OrderStatus.DELIVERED,       ItemStatus.DELIVERED, 18),
        (23, OrderStatus.CLOSED,          ItemStatus.DELIVERED, 30),
        (24, OrderStatus.CLOSED,          ItemStatus.DELIVERED, 35),
    ]

    base_order_count = db.query(Order).count()
    orders_created = []
    for i, (item_idx, order_status, item_status, days_ago) in enumerate(order_configs):
        item = orderable[item_idx]
        buyer = buyers[i % len(buyers)]
        order_number = f"ORD-{year}-{base_order_count + i + 1:05d}"
        created = now - timedelta(days=days_ago)
        seller_paid = 1 if order_status == OrderStatus.CLOSED else 0

        order = Order(
            order_number=order_number,
            buyer_id=buyer.id,
            buyer_name=buyer.full_name,
            buyer_phone=buyer.phone,
            buyer_email=buyer.email,
            item_id=item.id,
            amount=item.selling_price,
            commission_amount=item.commission,
            seller_payout_amount=item.seller_payout,
            status=order_status,
            shipping_method=ShippingMethod.PICKUP,
            seller_paid=seller_paid,
            created_at=created,
        )
        db.add(order)

        # Update item status
        item.status = item_status
        if item_status != ItemStatus.LISTED:
            item.sold_at = created

        orders_created.append(order_number)

    db.flush()

    # ── 5. WhatsApp messages ──────────────────────────────────────────────────
    for i, body in enumerate(WA_MESSAGES):
        buyer = buyers[i % len(buyers)]
        direction = MessageDirection.INBOUND if i % 3 != 0 else MessageDirection.OUTBOUND
        msg = WhatsAppMessage(
            to_number="+523319537644" if direction == MessageDirection.INBOUND else buyer.phone,
            from_number=buyer.phone if direction == MessageDirection.INBOUND else "+523319537644",
            body=body,
            direction=direction,
            message_type=MessageType.MANUAL,
            status="delivered",
            buyer_id=buyer.id,
            created_at=now - timedelta(days=random.randint(0, 10), hours=random.randint(0, 23)),
        )
        db.add(msg)

    db.commit()

    return {
        "ok": True,
        "sellers": len(sellers),
        "buyers": len(buyers),
        "items": len(items_created),
        "orders": len(orders_created),
        "whatsapp_messages": len(WA_MESSAGES),
        "order_numbers": orders_created,
    }

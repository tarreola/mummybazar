"""sync_item_status_from_orders

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-13 12:00:00.000000

Fixes commission_amount on no_seller orders and syncs item statuses from
their linked order statuses for existing data.

NOTE: PostgreSQL enum values in this DB are stored UPPERCASE (SHIPPED,
DELIVERED, CLOSED, etc.) — must use uppercase in raw SQL.
"""
from alembic import op
import sqlalchemy as sa

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade():
    # Fix commission_amount and seller_payout_amount on orders for no_seller items
    op.execute(sa.text("""
        UPDATE orders
        SET commission_amount = orders.amount,
            seller_payout_amount = 0
        FROM items
        WHERE items.id = orders.item_id
          AND items.no_seller = true
          AND orders.commission_amount < orders.amount
    """))

    # Items linked to shipped orders → SHIPPED
    op.execute(sa.text("""
        UPDATE items
        SET status = 'SHIPPED'
        FROM orders
        WHERE orders.item_id = items.id
          AND orders.status = 'SHIPPED'
          AND items.status NOT IN ('RETURNED', 'ARCHIVED')
    """))

    # Items linked to delivered or closed orders → DELIVERED
    op.execute(sa.text("""
        UPDATE items
        SET status = 'DELIVERED'
        FROM orders
        WHERE orders.item_id = items.id
          AND orders.status IN ('DELIVERED', 'CLOSED')
          AND items.status NOT IN ('RETURNED', 'ARCHIVED')
    """))

    # Items linked to cancelled orders → LISTED
    op.execute(sa.text("""
        UPDATE items
        SET status = 'LISTED',
            sold_at = NULL
        FROM orders
        WHERE orders.item_id = items.id
          AND orders.status = 'CANCELLED'
          AND items.status = 'SOLD'
    """))


def downgrade():
    pass

"""sync_item_status_from_orders

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-13 12:00:00.000000

Sets item status to match the linked order's current status for all
existing orders so Historic Orders and Dashboard reflect real data.
"""
from alembic import op
import sqlalchemy as sa

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade():
    # Fix commission_amount and seller_payout_amount on orders for no_seller items
    # (at order creation, commission was wrongly calculated at 30% instead of 100%)
    op.execute(sa.text("""
        UPDATE orders
        SET commission_amount = orders.amount,
            seller_payout_amount = 0
        FROM items
        WHERE items.id = orders.item_id
          AND items.no_seller = true
          AND orders.commission_amount < orders.amount
    """))

    # Items linked to shipped orders → shipped
    op.execute(sa.text("""
        UPDATE items
        SET status = 'shipped'
        FROM orders
        WHERE orders.item_id = items.id
          AND orders.status = 'shipped'
          AND items.status NOT IN ('returned', 'archived')
    """))

    # Items linked to delivered or closed orders → delivered
    op.execute(sa.text("""
        UPDATE items
        SET status = 'delivered'
        FROM orders
        WHERE orders.item_id = items.id
          AND orders.status IN ('delivered', 'closed')
          AND items.status NOT IN ('returned', 'archived')
    """))

    # Items linked to cancelled orders → listed (re-list them)
    op.execute(sa.text("""
        UPDATE items
        SET status = 'listed',
            sold_at = NULL
        FROM orders
        WHERE orders.item_id = items.id
          AND orders.status = 'cancelled'
          AND items.status = 'sold'
    """))


def downgrade():
    pass

"""fix_noseller_commission

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-04-13 00:00:00.000000

Sets commission = selling_price and seller_payout = 0 for all no_seller items
that currently have incorrect 30% commission.
"""
from alembic import op
import sqlalchemy as sa

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        UPDATE items
        SET commission = selling_price,
            seller_payout = 0
        WHERE no_seller = true
    """))


def downgrade():
    pass

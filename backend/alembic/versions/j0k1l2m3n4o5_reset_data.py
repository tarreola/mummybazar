"""reset_data

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-04-13 13:00:00.000000

One-time data reset: truncates orders, items, buyers, sellers.
Admin users are preserved.
"""
from alembic import op
import sqlalchemy as sa

revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def upgrade():
    # Delete in FK-safe order, then reset sequences
    op.execute(sa.text("DELETE FROM orders"))
    op.execute(sa.text("DELETE FROM items"))
    op.execute(sa.text("DELETE FROM buyers"))
    op.execute(sa.text("DELETE FROM sellers"))

    # Reset auto-increment sequences so IDs start from 1 again
    op.execute(sa.text("ALTER SEQUENCE orders_id_seq RESTART WITH 1"))
    op.execute(sa.text("ALTER SEQUENCE items_id_seq RESTART WITH 1"))
    op.execute(sa.text("ALTER SEQUENCE buyers_id_seq RESTART WITH 1"))
    op.execute(sa.text("ALTER SEQUENCE sellers_id_seq RESTART WITH 1"))


def downgrade():
    pass  # Data deletion cannot be undone

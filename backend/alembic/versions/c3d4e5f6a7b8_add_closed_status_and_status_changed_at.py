"""add_closed_status_and_status_changed_at

Revision ID: c3d4e5f6a7b8
Revises: 7a3cec30e271
Create Date: 2026-04-09 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = '7a3cec30e271'
branch_labels = None
depends_on = None


def upgrade():
    # Add 'closed' value to the orderstatus enum.
    # PostgreSQL requires this outside a transaction block.
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'closed' "
        "                 AND enumtypid = 'orderstatus'::regtype) THEN "
        "    ALTER TYPE orderstatus ADD VALUE 'closed'; "
        "  END IF; "
        "END $$;"
    ))
    connection.execute(sa.text("BEGIN"))

    # Add status_changed_at column
    op.add_column('orders', sa.Column('status_changed_at', sa.DateTime(timezone=True), nullable=True))

    # Backfill: set status_changed_at = updated_at (best approximation)
    op.execute(sa.text(
        "UPDATE orders SET status_changed_at = COALESCE(updated_at, created_at)"
    ))


def downgrade():
    op.drop_column('orders', 'status_changed_at')
    # Note: PostgreSQL does not support removing enum values; 'closed' stays in the type.

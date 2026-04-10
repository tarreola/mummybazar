"""fix_closed_enum_uppercase

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-09 23:00:00.000000

The previous migration added 'closed' (lowercase) to the orderstatus enum,
but all other values are UPPERCASE. SQLAlchemy sends the Python enum NAME
(uppercase) to PostgreSQL, so queries for OrderStatus.CLOSED were sending
'CLOSED' which PostgreSQL didn't recognise.

This migration adds 'CLOSED' (uppercase) to match the existing convention.
The lowercase 'closed' remains (PostgreSQL cannot remove enum values).
"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLOSED' "
        "                 AND enumtypid = 'orderstatus'::regtype) THEN "
        "    ALTER TYPE orderstatus ADD VALUE 'CLOSED'; "
        "  END IF; "
        "END $$;"
    ))
    connection.execute(sa.text("BEGIN"))


def downgrade():
    # PostgreSQL does not support removing enum values.
    pass

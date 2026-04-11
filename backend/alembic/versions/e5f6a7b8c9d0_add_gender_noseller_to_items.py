"""add_gender_noseller_to_items

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-10 00:00:00.000000

Adds gender (girl/boy/unisex) and no_seller (bool) fields to items.
Also makes seller_id nullable for no-seller items.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itemgender') THEN "
        "    CREATE TYPE itemgender AS ENUM ('girl', 'boy', 'unisex'); "
        "  END IF; "
        "END $$;"
    ))
    connection.execute(sa.text("BEGIN"))

    op.add_column('items', sa.Column('gender', sa.Enum('girl', 'boy', 'unisex', name='itemgender'), nullable=True))
    op.add_column('items', sa.Column('no_seller', sa.Boolean(), nullable=False, server_default='false'))
    op.alter_column('items', 'seller_id', nullable=True)


def downgrade():
    op.alter_column('items', 'seller_id', nullable=False)
    op.drop_column('items', 'no_seller')
    op.drop_column('items', 'gender')

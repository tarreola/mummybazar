"""add_item_extra_fields

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-12 00:00:00.000000

Adds measurements, usage_time, includes_manual, seller_review columns to items.
Also adds ADULT value to itemgender enum.
"""
from alembic import op
import sqlalchemy as sa

revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('items', sa.Column('measurements', sa.String(), nullable=True))
    op.add_column('items', sa.Column('usage_time', sa.String(), nullable=True))
    op.add_column('items', sa.Column('includes_manual', sa.Boolean(), nullable=True))
    op.add_column('items', sa.Column('seller_review', sa.Text(), nullable=True))

    # Add ADULT to itemgender enum
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'adult' "
        "    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'itemgender')) THEN "
        "    ALTER TYPE itemgender ADD VALUE 'adult'; "
        "  END IF; "
        "END $$;"
    ))
    connection.execute(sa.text("BEGIN"))


def downgrade():
    op.drop_column('items', 'seller_review')
    op.drop_column('items', 'includes_manual')
    op.drop_column('items', 'usage_time')
    op.drop_column('items', 'measurements')

"""fix_itemgender_uppercase

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-12 00:00:00.000000

Adds uppercase values (GIRL, BOY, UNISEX) to itemgender enum so SQLAlchemy
can insert them correctly in production PostgreSQL.
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    for value in ('GIRL', 'BOY', 'UNISEX'):
        connection.execute(sa.text("COMMIT"))
        connection.execute(sa.text(
            f"DO $$ BEGIN "
            f"  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = '{value}' "
            f"    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'itemgender')) THEN "
            f"    ALTER TYPE itemgender ADD VALUE '{value}'; "
            f"  END IF; "
            f"END $$;"
        ))
        connection.execute(sa.text("BEGIN"))


def downgrade():
    pass

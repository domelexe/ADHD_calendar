"""add color and icon override to events

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("color", sa.String(20), nullable=True))
    op.add_column("events", sa.Column("icon", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "color")
    op.drop_column("events", "icon")

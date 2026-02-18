"""add is_background to events and activity_templates

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "is_background", sa.Boolean(), nullable=False, server_default="false"
        ),
    )
    op.add_column(
        "activity_templates",
        sa.Column(
            "is_background", sa.Boolean(), nullable=False, server_default="false"
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "is_background")
    op.drop_column("activity_templates", "is_background")

"""Add description to activity_templates

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-15 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activity_templates", sa.Column("description", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("activity_templates", "description")

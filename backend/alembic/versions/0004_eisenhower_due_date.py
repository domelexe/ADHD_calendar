"""Add due_date and target_quadrant to eisenhower_tasks

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "eisenhower_tasks",
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "eisenhower_tasks", sa.Column("target_quadrant", sa.String(20), nullable=True)
    )


def downgrade():
    op.drop_column("eisenhower_tasks", "due_date")
    op.drop_column("eisenhower_tasks", "target_quadrant")

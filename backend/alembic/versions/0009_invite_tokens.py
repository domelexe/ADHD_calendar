"""invite_tokens table and is_admin column

Revision ID: 0009
Revises: 0008
Create Date: 2026-02-18
"""

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Pole is_admin w tabeli users
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Tabela tokenów zaproszeń
    op.create_table(
        "invite_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "used_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("invite_tokens")
    op.drop_column("users", "is_admin")

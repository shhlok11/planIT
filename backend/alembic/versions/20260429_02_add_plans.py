"""add plans and link uploads

Revision ID: 20260429_02
Revises: 20260429_01
Create Date: 2026-04-29 18:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260429_02"
down_revision = "20260429_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_plans_id", "plans", ["id"])
    op.create_index("ix_plans_user_id", "plans", ["user_id"])

    op.add_column("uploads", sa.Column("plan_id", sa.Integer(), nullable=True))
    op.create_index("ix_uploads_plan_id", "uploads", ["plan_id"])
    op.create_foreign_key(
        "fk_uploads_plan_id_plans",
        "uploads",
        "plans",
        ["plan_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_uploads_plan_id_plans", "uploads", type_="foreignkey")
    op.drop_index("ix_uploads_plan_id", table_name="uploads")
    op.drop_column("uploads", "plan_id")

    op.drop_index("ix_plans_user_id", table_name="plans")
    op.drop_index("ix_plans_id", table_name="plans")
    op.drop_table("plans")

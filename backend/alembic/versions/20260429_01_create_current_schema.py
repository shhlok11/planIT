"""create current schema

Revision ID: 20260429_01
Revises: None
Create Date: 2026-04-29 15:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260429_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("saved_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("clean_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_uploads_id", "uploads", ["id"])
    op.create_index("ix_uploads_user_id", "uploads", ["user_id"])

    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("provider_user_id", sa.String(), nullable=False),
        sa.Column("provider_email", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
    )
    op.create_index("ix_oauth_accounts_id", "oauth_accounts", ["id"])

    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("study_hours_per_day", sa.Float(), nullable=False),
        sa.Column("preferred_study_time", sa.String(), nullable=False),
        sa.Column("intensity", sa.String(), nullable=False),
        sa.Column("weekends_available", sa.Boolean(), nullable=False),
        sa.Column("minimum_reminder_days", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_user_preferences_id", "user_preferences", ["id"])
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("upload_id", sa.Integer(), sa.ForeignKey("uploads.id"), nullable=False),
        sa.Column("course_code", sa.String(), nullable=False),
        sa.Column("course_name", sa.String(), nullable=True),
        sa.Column("semester", sa.String(), nullable=True),
        sa.Column("priority_rank", sa.Integer(), nullable=True),
        sa.Column("difficulty", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_courses_id", "courses", ["id"])
    op.create_index("ix_courses_upload_id", "courses", ["upload_id"])
    op.create_index("ix_courses_course_code", "courses", ["course_code"])

    op.create_table(
        "course_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("source_text", sa.Text(), nullable=True),
        sa.Column("is_user_edited", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_course_events_id", "course_events", ["id"])
    op.create_index("ix_course_events_course_id", "course_events", ["course_id"])
    op.create_index("ix_course_events_date", "course_events", ["date"])

    op.create_table(
        "study_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("upload_id", sa.Integer(), sa.ForeignKey("uploads.id"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("course_events.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("start_time", sa.DateTime(), nullable=False),
        sa.Column("end_time", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("priority_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_study_blocks_id", "study_blocks", ["id"])
    op.create_index("ix_study_blocks_upload_id", "study_blocks", ["upload_id"])
    op.create_index("ix_study_blocks_course_id", "study_blocks", ["course_id"])
    op.create_index("ix_study_blocks_event_id", "study_blocks", ["event_id"])
    op.create_index("ix_study_blocks_start_time", "study_blocks", ["start_time"])


def downgrade() -> None:
    op.drop_index("ix_study_blocks_start_time", table_name="study_blocks")
    op.drop_index("ix_study_blocks_event_id", table_name="study_blocks")
    op.drop_index("ix_study_blocks_course_id", table_name="study_blocks")
    op.drop_index("ix_study_blocks_upload_id", table_name="study_blocks")
    op.drop_index("ix_study_blocks_id", table_name="study_blocks")
    op.drop_table("study_blocks")

    op.drop_index("ix_course_events_date", table_name="course_events")
    op.drop_index("ix_course_events_course_id", table_name="course_events")
    op.drop_index("ix_course_events_id", table_name="course_events")
    op.drop_table("course_events")

    op.drop_index("ix_courses_course_code", table_name="courses")
    op.drop_index("ix_courses_upload_id", table_name="courses")
    op.drop_index("ix_courses_id", table_name="courses")
    op.drop_table("courses")

    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_index("ix_user_preferences_id", table_name="user_preferences")
    op.drop_table("user_preferences")

    op.drop_index("ix_oauth_accounts_id", table_name="oauth_accounts")
    op.drop_table("oauth_accounts")

    op.drop_index("ix_uploads_user_id", table_name="uploads")
    op.drop_index("ix_uploads_id", table_name="uploads")
    op.drop_table("uploads")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

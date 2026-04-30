import logging

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from core.rate_limit import rate_limit
from db.models import Plan
from db.session import get_db
from dependencies.resources import (
    get_current_user_id,
    get_latest_user_preference,
    get_plan_or_404,
)
from schemas.plan import (
    PlanConflictsResponse,
    PlanCoursesResponse,
    PlanCreate,
    PlanPriorityScoresResponse,
    PlanRead,
    PlanScheduleResponse,
    PlanUpdate,
)
from service.pdf_parser import handle_file_upload
from service.upload_analysis import (
    build_and_save_plan_schedule,
    build_plan_conflicts_response,
    build_plan_courses_response,
    build_plan_ics_response,
    build_plan_pdf_response,
    build_plan_priority_scores_response,
    build_plan_read,
    build_plan_study_blocks_response,
)
from service.upload_pipeline import extract_and_save_courses


router = APIRouter(prefix="/plans", tags=["plans"])
logger = logging.getLogger(__name__)
EXTRACTABLE_UPLOAD_STATUSES = {"UPLOADED", "PROCESSING", "PARSED", "CLEANED"}


@router.post("", response_model=PlanRead)
async def create_plan(
    payload: PlanCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    plan = Plan(user_id=current_user_id, title=payload.title)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return build_plan_read(plan)


@router.get("", response_model=list[PlanRead])
async def list_plans(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    plans = (
        db.query(Plan)
        .filter(Plan.user_id == current_user_id)
        .order_by(Plan.created_at.desc(), Plan.id.desc())
        .all()
    )
    return [build_plan_read(plan) for plan in plans]


@router.get("/{plan_id}", response_model=PlanRead)
async def get_plan(
    plan: Plan = Depends(get_plan_or_404),
):
    return build_plan_read(plan)


@router.patch("/{plan_id}", response_model=PlanRead)
async def update_plan(
    payload: PlanUpdate,
    plan: Plan = Depends(get_plan_or_404),
    db: Session = Depends(get_db),
):
    plan.title = payload.title
    db.commit()
    db.refresh(plan)
    return build_plan_read(plan)


@router.post("/{plan_id}/upload-file")
async def upload_file_to_plan(
    file: UploadFile = File(...),
    plan: Plan = Depends(get_plan_or_404),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
    _: None = rate_limit(
        "plans:upload-file",
        limit=8,
        window_seconds=60,
        prefer_authenticated_user=True,
    ),
):
    return await handle_file_upload(file, db, user_id=current_user_id, plan_id=plan.id)


@router.post("/{plan_id}/extract", response_model=PlanCoursesResponse)
async def extract_plan_courses(
    plan: Plan = Depends(get_plan_or_404),
    db: Session = Depends(get_db),
    _: None = rate_limit(
        "plans:extract",
        limit=5,
        window_seconds=60,
        prefer_authenticated_user=True,
    ),
):
    uploads_to_extract = [
        upload
        for upload in sorted(plan.uploads, key=lambda item: item.created_at)
        if upload.status in EXTRACTABLE_UPLOAD_STATUSES
    ]

    for upload in uploads_to_extract:
        try:
            extract_and_save_courses(upload, db)
        except Exception:
            logger.exception(
                "Plan extraction failed for upload %s in plan %s",
                upload.id,
                plan.id,
            )
            db.rollback()
            upload.status = "NEEDS_REVIEW"
            db.add(upload)
            db.commit()

    db.refresh(plan)
    return build_plan_courses_response(plan)


@router.get("/{plan_id}/courses", response_model=PlanCoursesResponse)
async def get_plan_courses(
    plan: Plan = Depends(get_plan_or_404),
):
    return build_plan_courses_response(plan)


@router.get("/{plan_id}/priority-scores", response_model=PlanPriorityScoresResponse)
async def get_plan_priority_scores(
    plan: Plan = Depends(get_plan_or_404),
    preference=Depends(get_latest_user_preference),
):
    return build_plan_priority_scores_response(plan, preference)


@router.get("/{plan_id}/conflicts", response_model=PlanConflictsResponse)
async def get_plan_conflicts(
    plan: Plan = Depends(get_plan_or_404),
):
    return build_plan_conflicts_response(plan)


@router.post("/{plan_id}/schedule", response_model=PlanScheduleResponse)
async def generate_plan_schedule(
    plan: Plan = Depends(get_plan_or_404),
    db: Session = Depends(get_db),
    preference=Depends(get_latest_user_preference),
    _: None = rate_limit(
        "plans:schedule",
        limit=5,
        window_seconds=60,
        prefer_authenticated_user=True,
    ),
):
    return build_and_save_plan_schedule(plan, db, preference=preference)


@router.get("/{plan_id}/study-blocks", response_model=PlanScheduleResponse)
async def get_plan_study_blocks(
    plan: Plan = Depends(get_plan_or_404),
    preference=Depends(get_latest_user_preference),
):
    return build_plan_study_blocks_response(plan, preference)


@router.get("/{plan_id}/export.ics")
async def export_plan_ics(
    plan: Plan = Depends(get_plan_or_404),
):
    return build_plan_ics_response(plan)


@router.get("/{plan_id}/export.pdf")
async def export_plan_pdf(
    plan: Plan = Depends(get_plan_or_404),
    preference=Depends(get_latest_user_preference),
    theme: str = Query(default="dark", pattern="^(dark|light|white)$"),
):
    return build_plan_pdf_response(plan, preference, theme=theme)

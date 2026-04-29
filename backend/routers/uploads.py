from fastapi import APIRouter, Body, Depends, File, UploadFile
from sqlalchemy.orm import Session

from core.rate_limit import rate_limit
from db.models import Upload
from db.session import get_db
from dependencies.resources import (
    get_current_user_id,
    get_latest_user_preference,
    get_upload_or_404,
)
from schemas.clean_text import CleanTextRequest, CleanTextResponse
from schemas.conflict import UploadConflictsResponse
from schemas.extraction import UploadCoursesResponse
from schemas.priority import UploadPriorityScoresResponse
from schemas.study_block import UploadScheduleResponse
from service.pdf_parser import handle_file_upload
from service.upload_analysis import (
    build_and_save_schedule,
    build_conflicts_response,
    build_ics_response,
    build_priority_scores_response,
    build_study_blocks_response,
)
from service.upload_pipeline import (
    build_upload_courses_response,
    build_upload_status,
    ensure_cleaned,
    extract_and_save_courses,
    get_chunk_payload,
    parse_upload_text,
)


router = APIRouter(prefix="/uploads", tags=["uploads"])


# Stage 1: Upload and status

@router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
    _: None = rate_limit(
        "uploads:upload-file",
        limit=5,
        window_seconds=60,
        prefer_authenticated_user=True,
    ),
):
    return await handle_file_upload(file, db, user_id=current_user_id)


@router.get("/upload-status/{upload_id}")
async def get_upload_status(
    upload: Upload = Depends(get_upload_or_404),
):
    return build_upload_status(upload)


@router.post("/parse-upload/{upload_id}")
async def parse_upload(
    upload: Upload = Depends(get_upload_or_404),
    db: Session = Depends(get_db),
):
    return parse_upload_text(upload, db)


# Stage 2: Text preparation

@router.post("/clean-upload/{upload_id}", response_model=CleanTextResponse)
async def clean_upload_text(
    upload: Upload = Depends(get_upload_or_404),
    options: CleanTextRequest = Body(default_factory=CleanTextRequest),
    db: Session = Depends(get_db),
):
    return ensure_cleaned(upload, db, options=options)


@router.post("/chunk-upload/{upload_id}")
async def chunk_upload_text(
    upload: Upload = Depends(get_upload_or_404),
    db: Session = Depends(get_db),
):
    return get_chunk_payload(upload, db)


# Stage 3: Structured extraction and review

@router.post("/{upload_id}/extract", response_model=UploadCoursesResponse)
async def extract_upload_courses(
    upload: Upload = Depends(get_upload_or_404),
    db: Session = Depends(get_db),
    _: None = rate_limit(
        "uploads:extract",
        limit=5,
        window_seconds=60,
        prefer_authenticated_user=True,
    ),
):
    return extract_and_save_courses(upload, db)


@router.get("/{upload_id}/courses", response_model=UploadCoursesResponse)
async def get_upload_courses(
    upload: Upload = Depends(get_upload_or_404),
):
    return build_upload_courses_response(upload)


# Stage 4: Analysis

@router.get("/{upload_id}/priority-scores", response_model=UploadPriorityScoresResponse)
async def get_upload_priority_scores(
    upload: Upload = Depends(get_upload_or_404),
    preference=Depends(get_latest_user_preference),
):
    return build_priority_scores_response(upload, preference)


@router.get("/{upload_id}/conflicts", response_model=UploadConflictsResponse)
async def get_upload_conflicts(
    upload: Upload = Depends(get_upload_or_404),
):
    return build_conflicts_response(upload)


# Stage 5: Schedule generation

@router.post("/{upload_id}/schedule", response_model=UploadScheduleResponse)
async def generate_upload_schedule(
    upload: Upload = Depends(get_upload_or_404),
    db: Session = Depends(get_db),
    preference=Depends(get_latest_user_preference),
    _: None = rate_limit(
        "uploads:schedule",
        limit=5,
        window_seconds=60,
        prefer_authenticated_user=True,
    ),
):
    return build_and_save_schedule(
        upload,
        db,
        preference=preference,
    )


@router.get("/{upload_id}/study-blocks", response_model=UploadScheduleResponse)
async def get_upload_study_blocks(
    upload: Upload = Depends(get_upload_or_404),
    preference=Depends(get_latest_user_preference),
):
    return build_study_blocks_response(upload, preference)


# Stage 6: Export

@router.get("/{upload_id}/export.ics")
async def export_upload_ics(
    upload: Upload = Depends(get_upload_or_404),
):
    return build_ics_response(upload)

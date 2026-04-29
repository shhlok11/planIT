from fastapi import APIRouter, Body, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from core.conflict_engine import detect_conflicts
from core.ics_builder import build_calendar_ics
from core.priority_scoring import score_upload_events
from core.rate_limit import rate_limit
from core.scheduler_engine import generate_study_blocks
from db.models import Course, CourseEvent, StudyBlock, Upload
from db.session import get_db
from dependencies.resources import (
    get_current_user_id,
    get_latest_user_preference,
    get_upload_or_404,
)
from schemas.clean_text import CleanTextRequest, CleanTextResponse
from schemas.conflict import UploadConflictsResponse
from schemas.extraction import CourseRead, UploadCoursesResponse
from schemas.priority import UploadPriorityScoresResponse
from schemas.study_block import StudyBlockRead, UploadScheduleResponse
from service.clean_text_optimize import clean_extracted_text
from service.extract_academic_events import ExtractionServiceError, extract_academic_events
from service.extract_from_pdf import extract_text_from_pdf
from service.pdf_parser import handle_file_upload
from service.chunk_text import build_extraction_text_from_chunks, chunk_outline

router = APIRouter(prefix="/uploads", tags=["uploads"])


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
    return {
        "upload_id": upload.id,
        "original_filename": upload.original_filename,
        "saved_filename": upload.saved_filename,
        "status": upload.status,
        "file_size_bytes": upload.file_size_bytes,
        "storage_path": upload.storage_path,
        "created_at": upload.created_at,
        "has_extracted_text": upload.extracted_text is not None,
        "has_clean_text": upload.clean_text is not None,
    }


@router.get("/{upload_id}/courses", response_model=UploadCoursesResponse)
async def get_upload_courses(
    upload: Upload = Depends(get_upload_or_404),
):
    return UploadCoursesResponse(
        upload_id=upload.id,
        courses=[CourseRead.model_validate(course) for course in upload.courses],
    )


@router.get("/{upload_id}/priority-scores", response_model=UploadPriorityScoresResponse)
async def get_upload_priority_scores(
    upload: Upload = Depends(get_upload_or_404),
    preference=Depends(get_latest_user_preference),
):
    scores = score_upload_events(upload.courses, preference)
    return UploadPriorityScoresResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        scores=scores,
    )


@router.get("/{upload_id}/conflicts", response_model=UploadConflictsResponse)
async def get_upload_conflicts(
    upload: Upload = Depends(get_upload_or_404),
):
    events = [
        event
        for course in upload.courses
        for event in course.events
    ]
    return UploadConflictsResponse(
        upload_id=upload.id,
        conflicts=detect_conflicts(events),
    )


@router.get("/{upload_id}/study-blocks", response_model=UploadScheduleResponse)
async def get_upload_study_blocks(
    upload: Upload = Depends(get_upload_or_404),
    preference=Depends(get_latest_user_preference),
):
    return UploadScheduleResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        study_blocks=[
            StudyBlockRead.model_validate(block)
            for block in sorted(upload.study_blocks, key=lambda item: item.start_time)
        ],
    )


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
    priority_scores = score_upload_events(upload.courses, preference)
    events = [
        event
        for course in upload.courses
        for event in course.events
    ]
    generated_blocks = generate_study_blocks(
        upload_id=upload.id,
        courses=upload.courses,
        preference=preference,
        priority_scores=priority_scores,
        conflicts=detect_conflicts(events),
    )

    for existing_block in list(upload.study_blocks):
        db.delete(existing_block)
    db.flush()

    saved_blocks = []
    for block in generated_blocks:
        study_block = StudyBlock(**block.model_dump())
        db.add(study_block)
        saved_blocks.append(study_block)

    db.commit()
    for block in saved_blocks:
        db.refresh(block)

    return UploadScheduleResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        study_blocks=[StudyBlockRead.model_validate(block) for block in saved_blocks],
    )


@router.get("/{upload_id}/export.ics")
async def export_upload_ics(
    upload: Upload = Depends(get_upload_or_404),
):
    ics_content = build_calendar_ics(
        courses=upload.courses,
        study_blocks=upload.study_blocks,
    )
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="planit-upload-{upload.id}.ics"'
        },
    )


@router.post("/parse-upload/{upload_id}")
async def parse_upload(
    upload: Upload = Depends(get_upload_or_404),
    db: Session = Depends(get_db),
):
    upload.status = "PROCESSING"
    db.commit()
    text = extract_text_from_pdf(upload, db)
    return {
        "upload_id": upload.id,
        "status": upload.status,
        "text_preview": text[:1000],
        "text_length": len(text),
    }


@router.post("/clean-upload/{upload_id}", response_model=CleanTextResponse)
async def clean_upload_text(
    upload: Upload = Depends(get_upload_or_404),
    options: CleanTextRequest = Body(default_factory=CleanTextRequest),
    db: Session = Depends(get_db),
):
    if not upload.extracted_text:
        raise HTTPException(
            status_code=400,
            detail="No extracted text found for this upload. Parse the PDF first.",
        )
    response = clean_extracted_text(
        upload_id=upload.id,
        raw_text=upload.extracted_text,
        options=options,
    )
    upload.clean_text = response.clean_text
    upload.status = "CLEANED"
    db.commit()
    return response


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
    if not upload.extracted_text:
        upload.status = "PROCESSING"
        db.commit()
        extract_text_from_pdf(upload, db)

    if not upload.clean_text:
        clean_response = clean_extracted_text(
            upload_id=upload.id,
            raw_text=upload.extracted_text,
            options=CleanTextRequest(),
        )
        upload.clean_text = clean_response.clean_text
        upload.status = "CLEANED"
        db.commit()

    try:
        chunks = chunk_outline(upload.clean_text)
        extraction_text = build_extraction_text_from_chunks(chunks)
        extraction = extract_academic_events(extraction_text)
    except ExtractionServiceError as exc:
        upload.status = "NEEDS_REVIEW"
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    for existing_course in list(upload.courses):
        db.delete(existing_course)
    db.flush()

    extracted_course = extraction.course
    course = Course(
        upload_id=upload.id,
        course_code=extracted_course.course_code,
        course_name=extracted_course.course_name,
        semester=extracted_course.semester,
    )
    for extracted_event in extracted_course.events:
        course.events.append(
            CourseEvent(
                title=extracted_event.title,
                type=extracted_event.type.value,
                date=extracted_event.date,
                weight=extracted_event.weight,
                confidence=extracted_event.confidence,
                source_text=extracted_event.source_text,
            )
        )

    db.add(course)
    upload.status = "EXTRACTED"
    db.commit()
    db.refresh(course)

    return UploadCoursesResponse(
        upload_id=upload.id,
        courses=[CourseRead.model_validate(course)],
    )


@router.post("/chunk-upload/{upload_id}")
async def chunk_upload_text(
    upload: Upload = Depends(get_upload_or_404),
):
    if not upload.extracted_text:
        raise HTTPException(
            status_code=400,
            detail="No extracted text found for this upload. Parse the PDF first.",
        )
    source_text = upload.clean_text or upload.extracted_text
    chunks = chunk_outline(source_text)
    return {
        "upload_id": upload.id,
        "chunks": chunks,
        "extraction_text": build_extraction_text_from_chunks(chunks),
    }

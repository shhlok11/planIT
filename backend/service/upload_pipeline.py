from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import Course, CourseEvent, Upload
from schemas.clean_text import CleanTextRequest, CleanTextResponse
from schemas.extraction import CourseRead, UploadCoursesResponse
from service.chunk_text import build_extraction_text_from_chunks, chunk_outline
from service.clean_text_optimize import clean_extracted_text
from service.extract_academic_events import ExtractionServiceError, extract_academic_events
from service.extract_from_pdf import extract_text_from_pdf


def build_upload_status(upload: Upload) -> dict:
    return {
        "upload_id": upload.id,
        "plan_id": upload.plan_id,
        "original_filename": upload.original_filename,
        "saved_filename": upload.saved_filename,
        "status": upload.status,
        "file_size_bytes": upload.file_size_bytes,
        "storage_path": upload.storage_path,
        "created_at": upload.created_at,
        "has_extracted_text": upload.extracted_text is not None,
        "has_clean_text": upload.clean_text is not None,
    }


def parse_upload_text(upload: Upload, db: Session) -> dict:
    upload.status = "PROCESSING"
    db.commit()

    text = extract_text_from_pdf(upload, db)
    return {
        "upload_id": upload.id,
        "status": upload.status,
        "text_preview": text[:1000],
        "text_length": len(text),
    }


def ensure_extracted(upload: Upload, db: Session) -> str:
    if upload.extracted_text:
        return upload.extracted_text

    upload.status = "PROCESSING"
    db.commit()
    return extract_text_from_pdf(upload, db)


def ensure_cleaned(
    upload: Upload,
    db: Session,
    *,
    options: CleanTextRequest | None = None,
) -> CleanTextResponse:
    extracted_text = ensure_extracted(upload, db)
    response = clean_extracted_text(
        upload_id=upload.id,
        raw_text=extracted_text,
        options=options or CleanTextRequest(),
    )

    upload.clean_text = response.clean_text
    upload.status = "CLEANED"
    db.commit()
    return response


def get_chunk_payload(upload: Upload, db: Session) -> dict:
    source_text = upload.clean_text or ensure_extracted(upload, db)
    chunks = chunk_outline(source_text)
    return {
        "upload_id": upload.id,
        "chunks": chunks,
        "extraction_text": build_extraction_text_from_chunks(chunks),
    }


def extract_and_save_courses(upload: Upload, db: Session) -> UploadCoursesResponse:
    ensure_extracted(upload, db)
    if not upload.clean_text:
        ensure_cleaned(upload, db)

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


def build_upload_courses_response(upload: Upload) -> UploadCoursesResponse:
    return UploadCoursesResponse(
        upload_id=upload.id,
        courses=[CourseRead.model_validate(course) for course in upload.courses],
    )

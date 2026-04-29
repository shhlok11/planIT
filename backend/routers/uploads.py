from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db.models import Course, CourseEvent, Upload
from db.session import get_db
from schemas.clean_text import CleanTextRequest, CleanTextResponse
from schemas.extraction import CourseRead, UploadCoursesResponse
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
):
    return await handle_file_upload(file, db)


@router.get("/upload-status/{upload_id}")
async def get_upload_status(
    upload_id: int,
    db: Session = Depends(get_db),
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

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


@router.post("/parse-upload/{upload_id}")
async def parse_upload(
    upload_id: int,
    db: Session = Depends(get_db),
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

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
    upload_id: int,
    options: CleanTextRequest = Body(default_factory=CleanTextRequest),
    db: Session = Depends(get_db),
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

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
    upload_id: int,
    db: Session = Depends(get_db),
):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

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
async def chunk_upload_text(upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

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

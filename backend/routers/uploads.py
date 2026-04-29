from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db.models import Upload
from db.session import get_db
from schemas.clean_text import CleanTextRequest, CleanTextResponse
from service.clean_text_optimize import clean_extracted_text
from service.extract_from_pdf import extract_text_from_pdf
from service.pdf_parser import handle_file_upload


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

    return clean_extracted_text(
        upload_id=upload.id,
        raw_text=upload.extracted_text,
        options=options,
    )

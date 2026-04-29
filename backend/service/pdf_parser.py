from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from db.models import Upload


MAX_FILE_SIZE = 20 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024
PROJECT_ROOT = Path(__file__).resolve().parents[2]
UPLOADS_DIR = PROJECT_ROOT / "uploads"


async def handle_file_upload(file: UploadFile, db: Session):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    first_bytes = await file.read(4)

    if first_bytes != b"%PDF":
        raise HTTPException(status_code=400, detail="Not a valid PDF file")

    await file.seek(0)

    UPLOADS_DIR.mkdir(exist_ok=True)

    file_id = uuid4().hex
    saved_filename = f"{file_id}.pdf"
    file_path = UPLOADS_DIR / saved_filename

    total_size = 0

    try:
        with file_path.open("wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=400,
                        detail="File size should be less than 20MB",
                    )

                buffer.write(chunk)

        upload_record = Upload(
            original_filename=file.filename,
            saved_filename=saved_filename,
            content_type=file.content_type,
            file_size_bytes=total_size,
            storage_path=str(file_path),
            status="UPLOADED",
        )

        db.add(upload_record)
        db.commit()
        db.refresh(upload_record)

    finally:
        await file.close()

    return {
        "message": "File uploaded successfully",
        "upload_id": upload_record.id,
        "original_filename": upload_record.original_filename,
        "saved_filename": upload_record.saved_filename,
        "content_type": upload_record.content_type,
        "file_size_bytes": upload_record.file_size_bytes,
        "storage_path": upload_record.storage_path,
        "status": upload_record.status,
    }

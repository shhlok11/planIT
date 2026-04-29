import fitz
from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import Upload


def extract_text_from_pdf(upload: Upload, db: Session) -> str:
    try:
        with fitz.open(upload.storage_path) as doc:
            text = ""

            for page in doc:
                text += page.get_text()

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text found in PDF",
            )

        upload.extracted_text = text
        upload.status = "COMPLETED"
        db.commit()

        return text

    except HTTPException:
        upload.status = "FAILED"
        db.commit()
        raise
    except Exception:
        upload.status = "FAILED"
        db.commit()
        raise HTTPException(
            status_code=500,
            detail="Error parsing PDF",
        )

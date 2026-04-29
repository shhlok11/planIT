import fitz
from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import Upload

PAGE_BREAK_TOKEN = "<<PAGE_BREAK>>"


def extract_text_from_pdf(upload: Upload, db: Session) -> str:
    try:
        with fitz.open(upload.storage_path) as doc:
            page_texts = []

            for page in doc:
                page_texts.append(page.get_text())

            text = f"\n{PAGE_BREAK_TOKEN}\n".join(page_texts)

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

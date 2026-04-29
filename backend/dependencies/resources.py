from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import Course, CourseEvent, Upload
from db.session import get_db


def get_upload_or_404(
    upload_id: int,
    db: Session = Depends(get_db),
) -> Upload:
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload


def get_course_or_404(
    course_id: int,
    db: Session = Depends(get_db),
) -> Course:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def get_event_or_404(
    event_id: int,
    db: Session = Depends(get_db),
) -> CourseEvent:
    event = db.query(CourseEvent).filter(CourseEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

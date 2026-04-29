from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import Course, CourseEvent
from db.session import get_db
from schemas.extraction import CourseEventCreate, CourseEventRead, CourseRead
from schemas.preferences import CoursePreferenceUpdate


router = APIRouter(prefix="/courses", tags=["courses"])


@router.patch("/{course_id}/preferences", response_model=CourseRead)
async def update_course_preferences(
    course_id: int,
    update: CoursePreferenceUpdate,
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    update_data = update.model_dump(exclude_unset=True)
    requested_rank = update_data.get("priority_rank")
    if requested_rank is not None:
        duplicate = (
            db.query(Course)
            .filter(
                Course.upload_id == course.upload_id,
                Course.id != course.id,
                Course.priority_rank == requested_rank,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Another course for this upload already uses that priority rank",
            )

    for field, value in update_data.items():
        setattr(course, field, value)

    db.commit()
    db.refresh(course)

    return CourseRead.model_validate(course)


@router.post("/{course_id}/events", response_model=CourseEventRead, status_code=201)
async def create_course_event(
    course_id: int,
    event: CourseEventCreate,
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_event = CourseEvent(
        course_id=course.id,
        title=event.title,
        type=event.type.value,
        date=event.date,
        weight=event.weight,
        confidence=event.confidence,
        source_text=event.source_text,
        is_user_edited=True,
    )

    db.add(course_event)
    db.commit()
    db.refresh(course_event)

    return CourseEventRead.model_validate(course_event)

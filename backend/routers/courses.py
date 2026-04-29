from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.weight_validation import would_exceed_course_weight_limit
from db.models import Course, CourseEvent
from db.session import get_db
from dependencies.resources import get_course_or_404
from schemas.extraction import CourseEventCreate, CourseEventRead, CourseRead
from schemas.preferences import CoursePreferenceUpdate


router = APIRouter(prefix="/courses", tags=["courses"])


@router.patch("/{course_id}/preferences", response_model=CourseRead)
async def update_course_preferences(
    update: CoursePreferenceUpdate,
    course: Course = Depends(get_course_or_404),
    db: Session = Depends(get_db),
):
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
    event: CourseEventCreate,
    course: Course = Depends(get_course_or_404),
    db: Session = Depends(get_db),
):
    exceeds_limit, projected_total = would_exceed_course_weight_limit(
        db,
        course_id=course.id,
        new_weight=event.weight,
    )
    if exceeds_limit:
        raise HTTPException(
            status_code=409,
            detail=(
                "Course event weights cannot exceed 100%. "
                f"Projected total is {projected_total:g}%."
            ),
        )

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

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.weight_validation import would_exceed_course_weight_limit
from dependencies.resources import get_event_or_404
from db.models import CourseEvent
from db.session import get_db
from schemas.extraction import CourseEventRead, CourseEventUpdate


router = APIRouter(prefix="/events", tags=["events"])


class EventDeleteResponse(BaseModel):
    deleted: bool
    event_id: int = Field(gt=0)


@router.patch("/{event_id}", response_model=CourseEventRead)
async def update_event(
    update: CourseEventUpdate,
    event: CourseEvent = Depends(get_event_or_404),
    db: Session = Depends(get_db),
):
    update_data = update.model_dump(exclude_unset=True)
    if "type" in update_data and update_data["type"] is not None:
        update_data["type"] = update_data["type"].value
    if "weight" in update_data:
        exceeds_limit, projected_total = would_exceed_course_weight_limit(
            db,
            course_id=event.course_id,
            new_weight=update_data["weight"],
            exclude_event_id=event.id,
        )
        if exceeds_limit:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Course event weights cannot exceed 100%. "
                    f"Projected total is {projected_total:g}%."
                ),
            )

    for field, value in update_data.items():
        setattr(event, field, value)

    event.is_user_edited = True
    db.commit()
    db.refresh(event)

    return CourseEventRead.model_validate(event)


@router.delete("/{event_id}", response_model=EventDeleteResponse)
async def delete_event(
    event: CourseEvent = Depends(get_event_or_404),
    db: Session = Depends(get_db),
):
    event_id = event.id
    db.delete(event)
    db.commit()

    return EventDeleteResponse(deleted=True, event_id=event_id)

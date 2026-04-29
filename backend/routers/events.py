from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.models import CourseEvent
from db.session import get_db
from schemas.extraction import CourseEventRead, CourseEventUpdate


router = APIRouter(prefix="/events", tags=["events"])


class EventDeleteResponse(BaseModel):
    deleted: bool
    event_id: int = Field(gt=0)


@router.patch("/{event_id}", response_model=CourseEventRead)
async def update_event(
    event_id: int,
    update: CourseEventUpdate,
    db: Session = Depends(get_db),
):
    event = db.query(CourseEvent).filter(CourseEvent.id == event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = update.model_dump(exclude_unset=True)
    if "type" in update_data and update_data["type"] is not None:
        update_data["type"] = update_data["type"].value

    for field, value in update_data.items():
        setattr(event, field, value)

    event.is_user_edited = True
    db.commit()
    db.refresh(event)

    return CourseEventRead.model_validate(event)


@router.delete("/{event_id}", response_model=EventDeleteResponse)
async def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = db.query(CourseEvent).filter(CourseEvent.id == event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()

    return EventDeleteResponse(deleted=True, event_id=event_id)

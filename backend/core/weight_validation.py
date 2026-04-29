from sqlalchemy.orm import Session

from db.models import CourseEvent


MAX_COURSE_WEIGHT = 100.0


def get_course_weight_total(
    db: Session,
    *,
    course_id: int,
    exclude_event_id: int | None = None,
) -> float:
    query = db.query(CourseEvent).filter(CourseEvent.course_id == course_id)
    if exclude_event_id is not None:
        query = query.filter(CourseEvent.id != exclude_event_id)

    return sum(event.weight or 0 for event in query.all())


def would_exceed_course_weight_limit(
    db: Session,
    *,
    course_id: int,
    new_weight: float | None,
    exclude_event_id: int | None = None,
) -> tuple[bool, float]:
    total = get_course_weight_total(
        db,
        course_id=course_id,
        exclude_event_id=exclude_event_id,
    )
    projected_total = total + (new_weight or 0)
    return projected_total > MAX_COURSE_WEIGHT, projected_total

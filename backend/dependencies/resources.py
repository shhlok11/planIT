from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from db.models import Course, CourseEvent, Plan, Upload, User, UserPreference
from db.session import get_db


def get_current_user_id(current_user: User = Depends(get_current_user)) -> int:
    return current_user.id


def get_upload_or_404(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Upload:
    upload = (
        db.query(Upload)
        .filter(Upload.id == upload_id, Upload.user_id == current_user.id)
        .first()
    )
    if upload is None:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload


def get_plan_or_404(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Plan:
    plan = (
        db.query(Plan)
        .filter(Plan.id == plan_id, Plan.user_id == current_user.id)
        .first()
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


def get_course_or_404(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    course = (
        db.query(Course)
        .join(Upload, Course.upload_id == Upload.id)
        .filter(Course.id == course_id, Upload.user_id == current_user.id)
        .first()
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def get_event_or_404(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CourseEvent:
    event = (
        db.query(CourseEvent)
        .join(Course, CourseEvent.course_id == Course.id)
        .join(Upload, Course.upload_id == Upload.id)
        .filter(CourseEvent.id == event_id, Upload.user_id == current_user.id)
        .first()
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def get_latest_user_preference(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPreference | None:
    query = db.query(UserPreference)
    if hasattr(UserPreference, "user_id"):
        query = query.filter(UserPreference.user_id == current_user.id)
    return query.order_by(UserPreference.created_at.desc(), UserPreference.id.desc()).first()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import UserPreference
from db.session import get_db
from schemas.preferences import UserPreferenceCreate, UserPreferenceRead
from service.upload_analysis import get_latest_preference


router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.post("", response_model=UserPreferenceRead)
async def upsert_preferences(
    preferences: UserPreferenceCreate,
    db: Session = Depends(get_db),
):
    preference = get_latest_preference(db)

    if preference is None:
        preference = UserPreference()
        db.add(preference)

    preference.study_hours_per_day = preferences.study_hours_per_day
    preference.preferred_study_time = preferences.preferred_study_time.value
    preference.intensity = preferences.intensity.value
    preference.weekends_available = preferences.weekends_available
    preference.minimum_reminder_days = preferences.minimum_reminder_days

    db.commit()
    db.refresh(preference)

    return UserPreferenceRead.model_validate(preference)


@router.get("/latest", response_model=UserPreferenceRead)
async def get_latest_preferences(db: Session = Depends(get_db)):
    preference = get_latest_preference(db)

    if not preference:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return UserPreferenceRead.model_validate(preference)

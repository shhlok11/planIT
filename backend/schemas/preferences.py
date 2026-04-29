from datetime import datetime as DateTime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PreferredStudyTime(str, Enum):
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    night = "night"
    flexible = "flexible"


class PlanIntensity(str, Enum):
    light = "light"
    balanced = "balanced"
    intense = "intense"


class UserPreferenceCreate(BaseModel):
    study_hours_per_day: float = Field(gt=0, le=12)
    preferred_study_time: PreferredStudyTime = PreferredStudyTime.flexible
    intensity: PlanIntensity = PlanIntensity.balanced
    weekends_available: bool = True
    minimum_reminder_days: int = Field(default=3, ge=0, le=30)


class UserPreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    study_hours_per_day: float
    preferred_study_time: PreferredStudyTime
    intensity: PlanIntensity
    weekends_available: bool
    minimum_reminder_days: int
    created_at: DateTime
    updated_at: DateTime | None = None


class CoursePreferenceUpdate(BaseModel):
    priority_rank: int | None = Field(default=None, ge=1)
    difficulty: int | None = Field(default=None, ge=1, le=3)

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("At least one course preference field must be provided")
        return self

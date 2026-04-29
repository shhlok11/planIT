from datetime import date as Date

from pydantic import BaseModel, Field


class PriorityScoreComponents(BaseModel):
    urgency: float
    course_priority: float
    difficulty: float
    weight: float
    event_type: float
    confidence_adjustment: float
    reminder_window: float
    intensity_multiplier: float


class PriorityScoreRead(BaseModel):
    event_id: int
    course_id: int
    course_code: str
    title: str
    type: str
    date: Date | None
    days_until_due: int | None
    weight: float | None
    confidence: float | None
    priority_score: float = Field(ge=0, le=100)
    components: PriorityScoreComponents
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class UploadPriorityScoresResponse(BaseModel):
    upload_id: int = Field(gt=0)
    preference_id: int | None = None
    scores: list[PriorityScoreRead] = Field(default_factory=list)

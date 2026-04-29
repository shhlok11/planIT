from datetime import date as Date
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class ConflictSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ConflictRule(str, Enum):
    forty_eight_hour_window = "48_hour_window"
    same_week = "same_week"
    high_weight_window = "high_weight_window"


class ConflictRead(BaseModel):
    rule: ConflictRule
    severity: ConflictSeverity
    window_start: Date
    window_end: Date
    event_ids: list[int] = Field(min_length=2)
    message: str = Field(min_length=1)

    @field_validator("event_ids")
    @classmethod
    def normalize_event_ids(cls, value: list[int]) -> list[int]:
        return sorted(set(value))


class UploadConflictsResponse(BaseModel):
    upload_id: int = Field(gt=0)
    conflicts: list[ConflictRead] = Field(default_factory=list)

from datetime import datetime as DateTime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from schemas.conflict import ConflictRead
from schemas.extraction import CourseRead
from schemas.priority import PriorityScoreRead
from schemas.study_block import StudyBlockRead


class PlanCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("title cannot be blank")
        return title


class PlanUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("title cannot be blank")
        return title


class PlanUploadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    status: str
    created_at: DateTime


class PlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    created_at: DateTime
    uploads: list[PlanUploadRead] = Field(default_factory=list)


class PlanCoursesResponse(BaseModel):
    plan_id: int = Field(gt=0)
    courses: list[CourseRead] = Field(default_factory=list)


class PlanPriorityScoresResponse(BaseModel):
    plan_id: int = Field(gt=0)
    preference_id: int | None = None
    scores: list[PriorityScoreRead] = Field(default_factory=list)


class PlanConflictsResponse(BaseModel):
    plan_id: int = Field(gt=0)
    conflicts: list[ConflictRead] = Field(default_factory=list)


class PlanScheduleResponse(BaseModel):
    plan_id: int = Field(gt=0)
    preference_id: int | None = None
    study_blocks: list[StudyBlockRead] = Field(default_factory=list)

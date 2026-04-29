from datetime import datetime as DateTime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StudyBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    upload_id: int
    course_id: int
    event_id: int
    title: str
    start_time: DateTime
    end_time: DateTime
    reason: str | None
    priority_score: float
    created_at: DateTime


class StudyBlockCreate(BaseModel):
    upload_id: int = Field(gt=0)
    course_id: int = Field(gt=0)
    event_id: int = Field(gt=0)
    title: str = Field(min_length=1)
    start_time: DateTime
    end_time: DateTime
    reason: str | None = None
    priority_score: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def validate_time_order(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class UploadScheduleResponse(BaseModel):
    upload_id: int = Field(gt=0)
    preference_id: int | None = None
    study_blocks: list[StudyBlockRead] = Field(default_factory=list)

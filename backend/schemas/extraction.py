from datetime import date as Date
from datetime import datetime as DateTime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EventType(str, Enum):
    assignment = "assignment"
    exam = "exam"
    quiz = "quiz"
    lab = "lab"
    project = "project"
    other = "other"


class ExtractedEvent(BaseModel):
    title: str = Field(min_length=1)
    type: EventType = EventType.other
    date: Date | None = None
    weight: float | None = Field(default=None, ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    source_text: str | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("title cannot be blank")
        return title

    @field_validator("source_text")
    @classmethod
    def normalize_source_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        source_text = value.strip()
        return source_text or None


class ExtractedCourse(BaseModel):
    course_code: str = Field(min_length=1)
    course_name: str | None = None
    semester: str | None = None
    events: list[ExtractedEvent] = Field(default_factory=list)

    @field_validator("course_code")
    @classmethod
    def normalize_course_code(cls, value: str) -> str:
        course_code = value.strip()
        if not course_code:
            raise ValueError("course_code cannot be blank")
        return course_code

    @field_validator("course_name", "semester")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ExtractionResult(BaseModel):
    course: ExtractedCourse


class CourseEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    type: EventType
    date: Date | None
    weight: float | None
    confidence: float | None
    source_text: str | None
    is_user_edited: bool
    created_at: DateTime


class CourseEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    type: EventType | None = None
    date: Date | None = None
    weight: float | None = Field(default=None, ge=0, le=100)
    confidence: float | None = Field(default=None, ge=0, le=1)
    source_text: str | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        title = value.strip()
        if not title:
            raise ValueError("title cannot be blank")
        return title

    @field_validator("source_text")
    @classmethod
    def normalize_source_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        source_text = value.strip()
        return source_text or None

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("At least one event field must be provided")
        return self


class CourseEventCreate(BaseModel):
    title: str = Field(min_length=1)
    type: EventType = EventType.other
    date: Date | None = None
    weight: float | None = Field(default=None, ge=0, le=100)
    confidence: float | None = Field(default=1, ge=0, le=1)
    source_text: str | None = "Manually added by user"

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("title cannot be blank")
        return title

    @field_validator("source_text")
    @classmethod
    def normalize_source_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        source_text = value.strip()
        return source_text or None


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    upload_id: int
    course_code: str
    course_name: str | None
    semester: str | None
    priority_rank: int | None
    difficulty: int | None
    created_at: DateTime
    events: list[CourseEventRead] = Field(default_factory=list)


class UploadCoursesResponse(BaseModel):
    upload_id: int = Field(gt=0)
    courses: list[CourseRead] = Field(default_factory=list)

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CleanTextRequest(BaseModel):
    preserve_line_structure: bool = True
    collapse_blank_lines: bool = True
    remove_repeated_headers: bool = True
    remove_repeated_footers: bool = True
    remove_page_numbers: bool = True


class CleanTextStats(BaseModel):
    original_char_count: int = Field(ge=0)
    cleaned_char_count: int = Field(ge=0)
    original_line_count: int = Field(ge=0)
    cleaned_line_count: int = Field(ge=0)
    removed_blank_lines: int = Field(ge=0)
    removed_page_number_lines: int = Field(ge=0)
    removed_header_lines: int = Field(ge=0)
    removed_footer_lines: int = Field(ge=0)
    normalized_whitespace_lines: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_counts(self):
        if self.cleaned_char_count > self.original_char_count:
            raise ValueError("cleaned_char_count cannot exceed original_char_count")
        if self.cleaned_line_count > self.original_line_count:
            raise ValueError("cleaned_line_count cannot exceed original_line_count")
        return self


class CleanTextWarning(BaseModel):
    code: str
    message: str
    severity: Literal["low", "medium", "high"]
    line_number: int | None = None
    snippet: str | None = None


class CleanTextResponse(BaseModel):
    upload_id: int = Field(gt=0)
    clean_text: str
    stats: CleanTextStats
    warnings: list[CleanTextWarning] = Field(default_factory=list)


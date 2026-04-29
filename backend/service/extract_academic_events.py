import json
import os
import re

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError
from pydantic import ValidationError

from schemas.extraction import EventType, ExtractedEvent, ExtractionResult
from utils.prompts import EXTRACTION_SYSTEM_PROMPT


DEFAULT_EXTRACTION_MODEL = "gpt-4o-mini"
MAX_INPUT_CHARS = 60000


class ExtractionServiceError(Exception):
    pass


def extract_academic_events(
    clean_text: str,
    *,
    model: str | None = None,
    client: OpenAI | None = None,
) -> ExtractionResult:
    syllabus_text = clean_text.strip()
    if not syllabus_text:
        raise ExtractionServiceError("Cannot extract events from empty text.")

    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if client is None and not api_key:
        raise ExtractionServiceError("OPENAI_API_KEY is not configured.")

    openai_client = client or OpenAI(api_key=api_key)
    selected_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_EXTRACTION_MODEL
    truncated_text = syllabus_text[:MAX_INPUT_CHARS]

    try:
        response = openai_client.chat.completions.create(
            model=selected_model,
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_extraction_user_prompt(truncated_text),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
    except OpenAIError as exc:
        raise ExtractionServiceError(f"OpenAI extraction failed: {exc}") from exc

    if not response.choices:
        raise ExtractionServiceError("OpenAI returned no extraction choices.")

    content = response.choices[0].message.content
    if not content:
        raise ExtractionServiceError("OpenAI returned an empty extraction response.")

    try:
        payload = json.loads(_strip_json_fences(content))
    except json.JSONDecodeError as exc:
        raise ExtractionServiceError("OpenAI returned invalid JSON.") from exc

    try:
        extraction = ExtractionResult.model_validate(payload)
    except ValidationError as exc:
        raise ExtractionServiceError(f"OpenAI JSON failed validation: {exc}") from exc

    return _apply_assessment_hints(truncated_text, extraction)


def _build_extraction_user_prompt(clean_text: str) -> str:
    return (
        "Extract academic course and deadline data from this cleaned syllabus text.\n\n"
        "Syllabus text:\n"
        f"{clean_text}"
    )


def _strip_json_fences(content: str) -> str:
    stripped = content.strip()
    if not stripped.startswith("```"):
        return stripped

    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


ASSESSMENT_HEADING_PATTERN = re.compile(
    r"^(?P<title>[A-Za-z][A-Za-z0-9 #*/&.,:'-]{2,80})\s*\((?P<weight>\d+(?:\.\d+)?)%\)\s*$",
    re.MULTILINE,
)


def _apply_assessment_hints(clean_text: str, extraction: ExtractionResult) -> ExtractionResult:
    weight_hints = _extract_assessment_weight_hints(clean_text)
    if not weight_hints:
        return extraction

    events = list(extraction.course.events)
    existing_titles = {_normalize_title(event.title) for event in events}

    for event in events:
        if event.weight is not None:
            continue

        event_key = _best_weight_hint_key(event.title, weight_hints)
        if event_key is None:
            continue

        event.weight = weight_hints[event_key]["weight"]
        if event.source_text:
            event.source_text = f"{event.source_text}; {weight_hints[event_key]['source_text']}"
        else:
            event.source_text = weight_hints[event_key]["source_text"]

    for title_key, hint in weight_hints.items():
        if title_key in existing_titles:
            continue
        if not _should_add_undated_assessment(title_key):
            continue

        events.append(
            ExtractedEvent(
                title=hint["title"],
                type=_infer_event_type(hint["title"]),
                date=None,
                weight=hint["weight"],
                confidence=0.75,
                source_text=hint["source_text"],
            )
        )

    extraction.course.events = events
    return extraction


def _extract_assessment_weight_hints(clean_text: str) -> dict[str, dict[str, str | float]]:
    hints: dict[str, dict[str, str | float]] = {}
    for match in ASSESSMENT_HEADING_PATTERN.finditer(clean_text):
        title = match.group("title").strip()
        key = _normalize_title(title)
        if key in {"total", "date", "learning outcome"}:
            continue
        hints[key] = {
            "title": title,
            "weight": float(match.group("weight")),
            "source_text": match.group(0).strip(),
        }
    return hints


def _best_weight_hint_key(title: str, hints: dict[str, dict[str, str | float]]) -> str | None:
    normalized_title = _normalize_title(title)
    if normalized_title in hints:
        return normalized_title

    for hint_key in hints:
        if hint_key in normalized_title or normalized_title in hint_key:
            return hint_key
    return None


def _should_add_undated_assessment(title_key: str) -> bool:
    return title_key not in {"quizzes", "final exam"}


def _infer_event_type(title: str) -> EventType:
    normalized_title = _normalize_title(title)
    if "quiz" in normalized_title:
        return EventType.quiz
    if "exam" in normalized_title or "test" in normalized_title:
        return EventType.exam
    if "lab" in normalized_title:
        return EventType.lab
    if "project" in normalized_title:
        return EventType.project
    if "assignment" in normalized_title or "practice problem" in normalized_title:
        return EventType.assignment
    return EventType.other


def _normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()

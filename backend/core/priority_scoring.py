from __future__ import annotations

from datetime import date
from typing import Any

from db.models import Course, CourseEvent, UserPreference


TYPE_BOOSTS = {
    "exam": 10,
    "project": 8,
    "assignment": 5,
    "quiz": 4,
    "lab": 3,
    "other": 2,
}

INTENSITY_MULTIPLIERS = {
    "light": 0.9,
    "balanced": 1.0,
    "intense": 1.1,
}


def score_upload_events(
    courses: list[Course],
    preference: UserPreference | None = None,
    *,
    today: date | None = None,
) -> list[dict[str, Any]]:
    current_date = today or date.today()
    scores = []

    for course in courses:
        for event in course.events:
            scores.append(
                score_event(
                    event=event,
                    course=course,
                    preference=preference,
                    today=current_date,
                )
            )

    return sorted(
        scores,
        key=lambda item: (
            item["priority_score"],
            item["date"] or "",
            item["event_id"],
        ),
        reverse=True,
    )


def score_event(
    *,
    event: CourseEvent,
    course: Course,
    preference: UserPreference | None,
    today: date,
) -> dict[str, Any]:
    reasons: list[str] = []
    warnings: list[str] = []

    urgency_score = _urgency_score(event, today, reasons, warnings)
    course_priority_score = _course_priority_score(course, reasons)
    difficulty_score = _difficulty_score(course, reasons)
    weight_score = _weight_score(event, reasons, warnings)
    type_score = _type_score(event, reasons)
    confidence_adjustment = _confidence_adjustment(event, reasons, warnings)
    reminder_score = _reminder_score(event, preference, today, reasons)

    raw_score = (
        urgency_score
        + course_priority_score
        + difficulty_score
        + weight_score
        + type_score
        + confidence_adjustment
        + reminder_score
    )

    multiplier = _intensity_multiplier(preference, reasons)
    priority_score = max(0, min(100, raw_score * multiplier))
    priority_score = _apply_actionability_caps(priority_score, event, today, warnings)
    priority_score = round(priority_score, 2)

    return {
        "event_id": event.id,
        "course_id": course.id,
        "course_code": course.course_code,
        "title": event.title,
        "type": event.type,
        "date": event.date,
        "days_until_due": _days_until(event, today),
        "weight": event.weight,
        "confidence": event.confidence,
        "priority_score": priority_score,
        "components": {
            "urgency": urgency_score,
            "course_priority": course_priority_score,
            "difficulty": difficulty_score,
            "weight": weight_score,
            "event_type": type_score,
            "confidence_adjustment": confidence_adjustment,
            "reminder_window": reminder_score,
            "intensity_multiplier": multiplier,
        },
        "reasons": reasons,
        "warnings": warnings,
    }


def _urgency_score(
    event: CourseEvent,
    today: date,
    reasons: list[str],
    warnings: list[str],
) -> float:
    days_until = _days_until(event, today)
    if days_until is None:
        warnings.append("No due date is available, so urgency is estimated conservatively")
        return 4

    if days_until < 0:
        warnings.append("Due date is in the past")
        return 0
    if days_until == 0:
        reasons.append("Due today")
        return 35
    if days_until <= 3:
        reasons.append(f"Due in {days_until} days")
        return 32
    if days_until <= 7:
        reasons.append(f"Due within a week ({days_until} days)")
        return 26
    if days_until <= 14:
        reasons.append(f"Due within two weeks ({days_until} days)")
        return 18
    if days_until <= 30:
        reasons.append(f"Due within a month ({days_until} days)")
        return 10
    if days_until <= 60:
        return 5
    return 2


def _course_priority_score(course: Course, reasons: list[str]) -> float:
    if course.priority_rank is None:
        return 8

    if course.priority_rank == 1:
        reasons.append("Course is ranked highest priority")
        return 20
    if course.priority_rank == 2:
        reasons.append("Course is ranked second priority")
        return 16
    if course.priority_rank == 3:
        return 12
    return max(2, 12 - (course.priority_rank - 3) * 2)


def _difficulty_score(course: Course, reasons: list[str]) -> float:
    if course.difficulty is None:
        return 6
    if course.difficulty >= 3:
        reasons.append("Course difficulty is marked hard")
        return 12
    if course.difficulty == 2:
        return 8
    return 4


def _weight_score(
    event: CourseEvent,
    reasons: list[str],
    warnings: list[str],
) -> float:
    if event.weight is None:
        warnings.append("No grade weight is available")
        return 4

    if event.weight >= 40:
        reasons.append(f"Worth {event.weight:g}% of the final grade")
        return 25
    if event.weight >= 25:
        reasons.append(f"High weight assessment ({event.weight:g}%)")
        return 20
    if event.weight >= 15:
        reasons.append(f"Meaningful grade weight ({event.weight:g}%)")
        return 14
    if event.weight >= 5:
        return 8
    if event.weight > 0:
        return 4
    warnings.append("Grade weight is 0%")
    return 0


def _type_score(event: CourseEvent, reasons: list[str]) -> float:
    event_type = (event.type or "other").lower()
    boost = TYPE_BOOSTS.get(event_type, TYPE_BOOSTS["other"])
    if event_type == "exam":
        reasons.append("Exam events receive extra priority")
    elif event_type == "project":
        reasons.append("Project events receive extra priority")
    return boost


def _confidence_adjustment(
    event: CourseEvent,
    reasons: list[str],
    warnings: list[str],
) -> float:
    if event.confidence is None:
        warnings.append("No extraction confidence is available")
        return -2
    if event.confidence < 0.5:
        warnings.append("Low extraction confidence, review this event")
        return -10
    if event.confidence < 0.7:
        warnings.append("Medium-low extraction confidence, review recommended")
        return -5
    if event.confidence >= 0.9:
        reasons.append("High extraction confidence")
    return 0


def _reminder_score(
    event: CourseEvent,
    preference: UserPreference | None,
    today: date,
    reasons: list[str],
) -> float:
    if preference is None or event.date is None:
        return 0

    days_until = _days_until(event, today)
    if days_until is None or days_until < 0:
        return 0

    if days_until <= preference.minimum_reminder_days:
        reasons.append("Inside the preferred reminder window")
        return 8
    return 0


def _intensity_multiplier(
    preference: UserPreference | None,
    reasons: list[str],
) -> float:
    if preference is None:
        return 1.0

    intensity = (preference.intensity or "balanced").lower()
    multiplier = INTENSITY_MULTIPLIERS.get(intensity, 1.0)
    if intensity == "intense":
        reasons.append("Intense plan preference increases priority")
    elif intensity == "light":
        reasons.append("Light plan preference softens priority")
    return multiplier


def _days_until(event: CourseEvent, today: date) -> int | None:
    if event.date is None:
        return None
    return (event.date - today).days


def _apply_actionability_caps(
    priority_score: float,
    event: CourseEvent,
    today: date,
    warnings: list[str],
) -> float:
    days_until = _days_until(event, today)
    if days_until is not None and days_until < 0:
        warnings.append("Past events are marked as historical data")
        return min(priority_score, 45)

    if days_until is None:
        warnings.append("Undated events are capped until reviewed")
        return min(priority_score, 65)
    return priority_score

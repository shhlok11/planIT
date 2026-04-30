from __future__ import annotations

from datetime import date, datetime, time, timedelta
from math import ceil
from typing import Any

from db.models import Course, CourseEvent, UserPreference
from schemas.study_block import StudyBlockCreate


DEFAULT_DAILY_STUDY_HOURS = 2.0
DEFAULT_MINIMUM_REMINDER_DAYS = 3

PREFERRED_START_TIMES = {
    "morning": time(9, 0),
    "afternoon": time(14, 0),
    "evening": time(18, 0),
    "night": time(20, 0),
    "flexible": time(18, 0),
}

INTENSITY_HOUR_MULTIPLIERS = {
    "light": 0.75,
    "balanced": 1.0,
    "intense": 1.35,
}


def generate_study_blocks(
    *,
    courses: list[Course],
    preference: UserPreference | None,
    priority_scores: list[dict[str, Any]],
    conflicts: list[dict[str, Any]],
    today: date | None = None,
) -> list[StudyBlockCreate]:
    current_date = today or date.today()
    score_by_event_id = {score["event_id"]: score for score in priority_scores}
    conflict_event_ids = {
        event_id
        for conflict in conflicts
        for event_id in conflict["event_ids"]
    }

    candidates = []
    for course in courses:
        for event in course.events:
            if not _is_schedulable(event, current_date):
                continue
            score = score_by_event_id.get(event.id)
            if score is None:
                continue
            candidates.append((course, event, score))

    candidates.sort(key=lambda item: item[2]["priority_score"], reverse=True)

    scheduled_by_day: dict[date, float] = {}
    occupied_starts: set[datetime] = set()
    blocks: list[StudyBlockCreate] = []

    for course, event, score in candidates:
        event_blocks = _build_blocks_for_event(
            course=course,
            event=event,
            score=score,
            preference=preference,
            conflict_event_ids=conflict_event_ids,
            today=current_date,
            scheduled_by_day=scheduled_by_day,
            occupied_starts=occupied_starts,
        )
        blocks.extend(event_blocks)

    return sorted(blocks, key=lambda block: (block.start_time, -block.priority_score))


def _build_blocks_for_event(
    *,
    course: Course,
    event: CourseEvent,
    score: dict[str, Any],
    preference: UserPreference | None,
    conflict_event_ids: set[int],
    today: date,
    scheduled_by_day: dict[date, float],
    occupied_starts: set[datetime],
) -> list[StudyBlockCreate]:
    daily_hours = _daily_study_hours(preference)
    target_hours = _target_hours(event, course, score, preference, event.id in conflict_event_ids)
    session_hours = min(2.0, max(0.5, daily_hours))
    sessions_needed = max(1, ceil(target_hours / session_hours))

    start_date = max(today, event.date - timedelta(days=_planning_window_days(event, score, preference)))
    candidate_days = _available_days(
        start_date=start_date,
        end_date=event.date - timedelta(days=1),
        weekends_available=_weekends_available(preference),
    )
    if not candidate_days:
        candidate_days = _available_days(
            start_date=today,
            end_date=event.date,
            weekends_available=True,
        )

    if not candidate_days:
        return []

    selected_days = _spread_days(candidate_days, sessions_needed)
    blocks = []
    for block_date in selected_days:
        if scheduled_by_day.get(block_date, 0) + session_hours > daily_hours:
            continue

        start_time = _next_available_start(
            block_date=block_date,
            preference=preference,
            occupied_starts=occupied_starts,
        )
        end_time = start_time + timedelta(hours=session_hours)
        occupied_starts.add(start_time)
        scheduled_by_day[block_date] = scheduled_by_day.get(block_date, 0) + session_hours

        blocks.append(
            StudyBlockCreate(
                upload_id=course.upload_id,
                course_id=course.id,
                event_id=event.id,
                title=f"Study {course.course_code}: {event.title}",
                start_time=start_time,
                end_time=end_time,
                reason=_build_reason(event, score, event.id in conflict_event_ids),
                priority_score=score["priority_score"],
            )
        )

    return blocks


def _is_schedulable(event: CourseEvent, today: date) -> bool:
    return event.date is not None and event.date >= today


def _daily_study_hours(preference: UserPreference | None) -> float:
    if preference is None:
        return DEFAULT_DAILY_STUDY_HOURS
    return max(0.5, min(12.0, preference.study_hours_per_day))


def _weekends_available(preference: UserPreference | None) -> bool:
    return True if preference is None else preference.weekends_available


def _target_hours(
    event: CourseEvent,
    course: Course,
    score: dict[str, Any],
    preference: UserPreference | None,
    has_conflict: bool,
) -> float:
    base_hours = 1.0
    if event.weight:
        base_hours += min(5.0, event.weight / 10)
    if (event.type or "").lower() == "exam":
        base_hours += 2.0
    if (event.type or "").lower() == "project":
        base_hours += 1.5
    if course.difficulty:
        base_hours += max(0, course.difficulty - 1) * 0.75
    if has_conflict:
        base_hours += 1.0

    priority_multiplier = 0.75 + (score["priority_score"] / 100)
    intensity = (preference.intensity if preference else "balanced").lower()
    intensity_multiplier = INTENSITY_HOUR_MULTIPLIERS.get(intensity, 1.0)
    return max(0.5, min(12.0, base_hours * priority_multiplier * intensity_multiplier))


def _planning_window_days(
    event: CourseEvent,
    score: dict[str, Any],
    preference: UserPreference | None,
) -> int:
    minimum_days = (
        preference.minimum_reminder_days
        if preference is not None
        else DEFAULT_MINIMUM_REMINDER_DAYS
    )
    weight_days = int((event.weight or 0) / 5)
    priority_days = int(score["priority_score"] / 20)
    return max(minimum_days, min(21, minimum_days + weight_days + priority_days))


def _available_days(
    *,
    start_date: date,
    end_date: date,
    weekends_available: bool,
) -> list[date]:
    if end_date < start_date:
        return []

    days = []
    current = start_date
    while current <= end_date:
        if weekends_available or current.weekday() < 5:
            days.append(current)
        current += timedelta(days=1)
    return days


def _spread_days(days: list[date], count: int) -> list[date]:
    if count >= len(days):
        return days
    if count <= 1:
        return [days[-1]]

    step = (len(days) - 1) / (count - 1)
    indexes = sorted({round(index * step) for index in range(count)})
    return [days[index] for index in indexes]


def _next_available_start(
    *,
    block_date: date,
    preference: UserPreference | None,
    occupied_starts: set[datetime],
) -> datetime:
    preferred_time = (preference.preferred_study_time if preference else "flexible").lower()
    start = datetime.combine(
        block_date,
        PREFERRED_START_TIMES.get(preferred_time, PREFERRED_START_TIMES["flexible"]),
    )
    while start in occupied_starts:
        start += timedelta(minutes=30)
    return start


def _build_reason(
    event: CourseEvent,
    score: dict[str, Any],
    has_conflict: bool,
) -> str:
    reasons = []
    if event.weight is not None:
        reasons.append(f"{event.weight:g}% weight")
    reasons.append(f"priority score {score['priority_score']:g}")
    if has_conflict:
        reasons.append("nearby workload conflict")
    return ", ".join(reasons)

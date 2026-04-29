from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from db.models import CourseEvent


HIGH_WEIGHT_THRESHOLD = 15.0


def detect_conflicts(events: list[CourseEvent]) -> list[dict[str, Any]]:
    dated_events = sorted(
        [event for event in events if event.date is not None],
        key=lambda event: (event.date, event.id),
    )
    if len(dated_events) < 2:
        return []

    conflicts: list[dict[str, Any]] = []
    conflicts.extend(_detect_48_hour_conflicts(dated_events))
    conflicts.extend(_detect_same_week_conflicts(dated_events))
    conflicts.extend(_detect_high_weight_conflicts(dated_events))

    return _dedupe_conflicts(conflicts)


def _detect_48_hour_conflicts(events: list[CourseEvent]) -> list[dict[str, Any]]:
    conflicts = []

    for start_index, start_event in enumerate(events):
        window_end = start_event.date + timedelta(days=2)
        window_events = [
            event
            for event in events[start_index:]
            if start_event.date <= event.date <= window_end
        ]

        if len(window_events) < 2:
            continue

        severity = "high" if len(window_events) >= 3 else _pair_severity(window_events)
        conflicts.append(
            _build_conflict(
                rule="48_hour_window",
                severity=severity,
                events=window_events,
                message=f"{len(window_events)} deadlines within 48 hours",
            )
        )

    return conflicts


def _detect_same_week_conflicts(events: list[CourseEvent]) -> list[dict[str, Any]]:
    events_by_week: dict[tuple[int, int], list[CourseEvent]] = defaultdict(list)
    for event in events:
        iso_year, iso_week, _ = event.date.isocalendar()
        events_by_week[(iso_year, iso_week)].append(event)

    conflicts = []
    for week_events in events_by_week.values():
        if len(week_events) < 3:
            continue

        conflicts.append(
            _build_conflict(
                rule="same_week",
                severity="medium" if len(week_events) < 3 else "high",
                events=week_events,
                message=f"{len(week_events)} deadlines in the same week",
            )
        )

    return conflicts


def _detect_high_weight_conflicts(events: list[CourseEvent]) -> list[dict[str, Any]]:
    high_weight_events = [
        event for event in events if (event.weight or 0) >= HIGH_WEIGHT_THRESHOLD
    ]
    conflicts = []

    for start_index, start_event in enumerate(high_weight_events):
        window_end = start_event.date + timedelta(days=7)
        window_events = [
            event
            for event in high_weight_events[start_index:]
            if start_event.date <= event.date <= window_end
        ]

        if len(window_events) < 2:
            continue

        conflicts.append(
            _build_conflict(
                rule="high_weight_window",
                severity="medium" if len(window_events) == 2 else "high",
                events=window_events,
                message=(
                    f"{len(window_events)} high-weight deadlines "
                    f"within 7 days"
                ),
            )
        )

    return conflicts


def _build_conflict(
    *,
    rule: str,
    severity: str,
    events: list[CourseEvent],
    message: str,
) -> dict[str, Any]:
    sorted_events = sorted(events, key=lambda event: (event.date, event.id))
    return {
        "rule": rule,
        "severity": severity,
        "window_start": sorted_events[0].date,
        "window_end": sorted_events[-1].date,
        "event_ids": [event.id for event in sorted_events],
        "message": message,
    }


def _pair_severity(events: list[CourseEvent]) -> str:
    high_weight_count = sum(
        1 for event in events if (event.weight or 0) >= HIGH_WEIGHT_THRESHOLD
    )
    return "medium" if high_weight_count >= 2 else "low"


def _dedupe_conflicts(conflicts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[tuple[str, tuple[int, ...]], dict[str, Any]] = {}
    for conflict in conflicts:
        key = (conflict["rule"], tuple(sorted(conflict["event_ids"])))
        existing = deduped.get(key)
        if existing is None or _severity_rank(conflict["severity"]) > _severity_rank(existing["severity"]):
            deduped[key] = conflict

    filtered = _remove_same_rule_subsets(list(deduped.values()))
    return sorted(
        filtered,
        key=lambda conflict: (
            _severity_rank(conflict["severity"]),
            len(conflict["event_ids"]),
            _reverse_date_ordinal(conflict["window_start"]),
        ),
        reverse=True,
    )


def _remove_same_rule_subsets(conflicts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    filtered = []
    for conflict in conflicts:
        event_ids = set(conflict["event_ids"])
        is_redundant_subset = any(
            conflict["rule"] == other["rule"]
            and conflict is not other
            and event_ids < set(other["event_ids"])
            and _severity_rank(conflict["severity"]) <= _severity_rank(other["severity"])
            for other in conflicts
        )
        if not is_redundant_subset:
            filtered.append(conflict)
    return filtered


def _severity_rank(severity: str) -> int:
    return {"low": 1, "medium": 2, "high": 3}.get(severity, 0)


def _reverse_date_ordinal(value: date) -> int:
    return -value.toordinal()

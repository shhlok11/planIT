from __future__ import annotations

from calendar import month_name
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from io import BytesIO

import fitz

from db.models import Plan, StudyBlock, Upload, UserPreference


PAGE_WIDTH = 842
PAGE_HEIGHT = 595
MARGIN = 28
HEADER_H = 86
MONTH_BAND_H = 52
DAY_HEADER_H = 22
CELL_PADDING = 6


Color = tuple[float, float, float]


@dataclass(frozen=True, slots=True)
class PdfTheme:
    name: str
    bg: Color
    surface: Color
    surface_alt: Color
    border: Color
    text: Color
    muted: Color
    cyan: Color
    violet: Color
    rose: Color
    amber: Color
    green: Color
    chip_text: Color


DARK_THEME = PdfTheme(
    name="dark",
    bg=(5 / 255, 6 / 255, 15 / 255),
    surface=(14 / 255, 17 / 255, 30 / 255),
    surface_alt=(10 / 255, 14 / 255, 26 / 255),
    border=(42 / 255, 48 / 255, 72 / 255),
    text=(232 / 255, 234 / 255, 240 / 255),
    muted=(142 / 255, 149 / 255, 171 / 255),
    cyan=(6 / 255, 182 / 255, 212 / 255),
    violet=(124 / 255, 58 / 255, 237 / 255),
    rose=(239 / 255, 68 / 255, 68 / 255),
    amber=(245 / 255, 158 / 255, 11 / 255),
    green=(16 / 255, 185 / 255, 129 / 255),
    chip_text=(246 / 255, 248 / 255, 252 / 255),
)

LIGHT_THEME = PdfTheme(
    name="light",
    bg=(248 / 255, 250 / 255, 252 / 255),
    surface=(255 / 255, 255 / 255, 255 / 255),
    surface_alt=(241 / 255, 245 / 255, 249 / 255),
    border=(203 / 255, 213 / 255, 225 / 255),
    text=(15 / 255, 23 / 255, 42 / 255),
    muted=(71 / 255, 85 / 255, 105 / 255),
    cyan=(8 / 255, 145 / 255, 178 / 255),
    violet=(109 / 255, 40 / 255, 217 / 255),
    rose=(225 / 255, 29 / 255, 72 / 255),
    amber=(217 / 255, 119 / 255, 6 / 255),
    green=(5 / 255, 150 / 255, 105 / 255),
    chip_text=(15 / 255, 23 / 255, 42 / 255),
)


@dataclass(slots=True)
class CalendarEntry:
    when: datetime
    date_value: date
    title: str
    sublabel: str
    detail: str | None
    score: float | None
    tone: str
    kind: str
    course_code: str | None
    color: Color


def build_upload_summary_pdf(
    *,
    upload: Upload,
    preference: UserPreference | None,
    priority_scores: list[dict],
    conflicts: list[dict],
    theme: str = "dark",
) -> bytes:
    return _build_calendar_pdf(
        title="planIT Calendar",
        subtitle_lines=[
            upload.original_filename,
            "Syllabus deadline export",
        ],
        courses=upload.courses,
        study_blocks=sorted(upload.study_blocks, key=lambda block: (block.start_time, block.id)),
        preference=preference,
        priority_scores=priority_scores,
        conflicts=conflicts,
        theme=_select_theme(theme),
    )


def build_plan_summary_pdf(
    *,
    plan: Plan,
    courses: list,
    study_blocks: list[StudyBlock],
    preference: UserPreference | None,
    priority_scores: list[dict],
    conflicts: list[dict],
    theme: str = "dark",
) -> bytes:
    return _build_calendar_pdf(
        title="planIT Calendar",
        subtitle_lines=[
            plan.title,
            f"{len(plan.uploads)} uploaded syllabus{'es' if len(plan.uploads) != 1 else ''}",
        ],
        courses=courses,
        study_blocks=study_blocks,
        preference=preference,
        priority_scores=priority_scores,
        conflicts=conflicts,
        theme=_select_theme(theme),
    )


def _build_calendar_pdf(
    *,
    title: str,
    subtitle_lines: list[str],
    courses: list,
    study_blocks: list[StudyBlock],
    preference: UserPreference | None,
    priority_scores: list[dict],
    conflicts: list[dict],
    theme: PdfTheme,
) -> bytes:
    document = fitz.open()
    course_colors = _course_color_map(courses, theme)
    entries = _collect_entries(courses, study_blocks, priority_scores, course_colors, theme)
    months = _collect_month_anchors(entries)

    _draw_cover_page(document, title, subtitle_lines, courses, study_blocks, preference, priority_scores, conflicts, course_colors, theme)

    if not months:
        page = _new_page(document, theme)
        _draw_month_shell(page, title, subtitle_lines, datetime.utcnow(), theme)
        _draw_empty_calendar(page, theme)
    else:
        for month_anchor in months:
            month_entries = [
                entry
                for entry in entries
                if entry.date_value.year == month_anchor.year and entry.date_value.month == month_anchor.month
            ]
            page = _new_page(document, theme)
            _draw_month_shell(page, title, subtitle_lines, month_anchor, theme)
            _draw_month_watchouts(page, month_anchor, month_entries, conflicts, course_colors, theme)
            _draw_month_calendar(page, month_anchor, month_entries, theme)

    buffer = BytesIO()
    document.save(buffer)
    document.close()
    return buffer.getvalue()


def _collect_entries(
    courses: list,
    study_blocks: list[StudyBlock],
    priority_scores: list[dict],
    course_colors: dict[str, Color],
    theme: PdfTheme,
) -> list[CalendarEntry]:
    score_by_event_id = {score["event_id"]: score for score in priority_scores if score.get("event_id") is not None}
    entries: list[CalendarEntry] = []

    for course in courses:
        course_color = course_colors.get(course.course_code, theme.rose)
        for event in course.events:
            if event.date is None:
                continue
            score = score_by_event_id.get(event.id)
            tone = "exam" if event.type == "exam" else "deadline"
            detail_parts = []
            if event.weight is not None:
                detail_parts.append(_weight_label(event.weight))
            if event.source_text:
                detail_parts.append(f"From syllabus: {event.source_text}")
            entries.append(
                CalendarEntry(
                    when=datetime.combine(event.date, datetime.min.time()),
                    date_value=event.date,
                    title=event.title,
                    sublabel=course.course_code,
                    detail=" | ".join(detail_parts) if detail_parts else None,
                    score=score["priority_score"] if score else None,
                    tone=tone,
                    kind="event",
                    course_code=course.course_code,
                    color=course_color,
                )
            )

    for block in study_blocks:
        entries.append(
            CalendarEntry(
                when=block.start_time,
                date_value=block.start_time.date(),
                title=block.title,
                sublabel=block.start_time.strftime("%H:%M"),
                detail=block.reason,
                score=block.priority_score,
                tone="study",
                kind="study",
                course_code=None,
                color=theme.green,
            )
        )

    entries.sort(key=lambda item: (item.when, item.title.lower()))
    return entries


def _collect_month_anchors(entries: list[CalendarEntry]) -> list[date]:
    seen: set[tuple[int, int]] = set()
    months: list[date] = []
    for entry in entries:
        key = (entry.date_value.year, entry.date_value.month)
        if key in seen:
            continue
        seen.add(key)
        months.append(date(entry.date_value.year, entry.date_value.month, 1))
    return months


def _new_page(document: fitz.Document, theme: PdfTheme) -> fitz.Page:
    page = document.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.draw_rect(fitz.Rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT), color=theme.bg, fill=theme.bg)
    return page


def _draw_cover_page(
    document: fitz.Document,
    title: str,
    subtitle_lines: list[str],
    courses: list,
    study_blocks: list[StudyBlock],
    preference: UserPreference | None,
    priority_scores: list[dict],
    conflicts: list[dict],
    course_colors: dict[str, Color],
    theme: PdfTheme,
) -> None:
    page = _new_page(document, theme)
    if theme.name == "dark":
        _draw_glow(page, 70, 60, 180, theme.cyan, theme, opacity=0.12)
        _draw_glow(page, PAGE_WIDTH - 120, PAGE_HEIGHT - 90, 220, theme.violet, theme, opacity=0.12)

    page.insert_text((MARGIN, 56), "planIT calendar export", fontsize=10, fontname="helv", color=theme.cyan)
    page.insert_text((MARGIN, 110), title, fontsize=30, fontname="helv", color=theme.text)

    subtitle_y = 142
    for line in subtitle_lines:
        page.insert_text((MARGIN, subtitle_y), line, fontsize=13, fontname="helv", color=theme.muted)
        subtitle_y += 18

    stats = [
        ("Course map", _load_label(len(courses), "course"), theme.cyan),
        ("Deadlines", _load_label(sum(len(course.events) for course in courses), "deadline"), theme.rose),
        ("Calendar", "Study blocks included" if study_blocks else "Deadlines only", theme.green),
        ("Watchouts", "Clear" if not conflicts else "Needs review", theme.amber),
    ]
    card_y = 218
    card_w = (PAGE_WIDTH - 2 * MARGIN - 24) / 4
    for index, (label, value, color) in enumerate(stats):
        x0 = MARGIN + index * (card_w + 8)
        _draw_panel(page, fitz.Rect(x0, card_y, x0 + card_w, card_y + 92), theme, glow=color)
        page.insert_text((x0 + 14, card_y + 24), label.upper(), fontsize=8, fontname="helv", color=theme.muted)
        _insert_wrapped(page, fitz.Rect(x0 + 14, card_y + 42, x0 + card_w - 14, card_y + 80), value, 15, color)

    left_rect = fitz.Rect(MARGIN, 344, PAGE_WIDTH - MARGIN - 280, PAGE_HEIGHT - 40)
    right_rect = fitz.Rect(PAGE_WIDTH - MARGIN - 260, 344, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 40)
    _draw_panel(page, left_rect, theme)
    _draw_panel(page, right_rect, theme)

    page.insert_text((left_rect.x0 + 16, left_rect.y0 + 24), "WHAT THIS PDF SHOWS", fontsize=11, fontname="helv", color=theme.cyan)
    cover_copy = (
        "Each page is a monthly calendar. Deadlines are color coded by course, and the top band "
        "summarizes the month feel plus any workload watchouts. Calendar cells stay compact so "
        "long syllabus text does not spill out of the grid."
    )
    _insert_wrapped(page, fitz.Rect(left_rect.x0 + 16, left_rect.y0 + 42, left_rect.x1 - 16, left_rect.y1 - 16), cover_copy, 12, theme.text)

    page.insert_text((right_rect.x0 + 16, right_rect.y0 + 24), "COURSE COLORS", fontsize=11, fontname="helv", color=theme.cyan)
    cursor = right_rect.y0 + 48
    for course in courses[:7]:
        color = course_colors.get(course.course_code, theme.cyan)
        page.draw_circle((right_rect.x0 + 20, cursor - 3), 4, color=color, fill=color)
        _insert_wrapped(
            page,
            fitz.Rect(right_rect.x0 + 32, cursor - 12, right_rect.x1 - 12, cursor + 6),
            f"{course.course_code} - {course.course_name or 'Untitled course'}",
            8,
            theme.text,
        )
        cursor += 20
    if len(courses) > 7:
        page.insert_text((right_rect.x0 + 16, cursor), f"+{len(courses) - 7} more courses", fontsize=8, fontname="helv", color=theme.muted)


def _draw_month_shell(
    page: fitz.Page,
    title: str,
    subtitle_lines: list[str],
    month_anchor: date,
    theme: PdfTheme,
) -> None:
    if theme.name == "dark":
        _draw_glow(page, 80, 40, 140, theme.cyan, theme, opacity=0.08)
        _draw_glow(page, PAGE_WIDTH - 110, 65, 170, theme.violet, theme, opacity=0.08)
    page.insert_text((MARGIN, 34), "planIT calendar", fontsize=9, fontname="helv", color=theme.cyan)
    page.insert_text(
        (MARGIN, 64),
        f"{month_name[month_anchor.month]} {month_anchor.year}",
        fontsize=24,
        fontname="helv",
        color=theme.text,
    )
    page.insert_text((MARGIN, 86), title, fontsize=10, fontname="helv", color=theme.muted)
    page.insert_text((PAGE_WIDTH - MARGIN - 190, 34), "EXPORT VIEW", fontsize=8, fontname="helv", color=theme.muted)
    for offset, line in enumerate(subtitle_lines[:2]):
        page.insert_text((PAGE_WIDTH - MARGIN - 190, 52 + offset * 14), _fit_text(line, 32), fontsize=9, fontname="helv", color=theme.text)


def _draw_empty_calendar(page: fitz.Page, theme: PdfTheme) -> None:
    grid_rect = _calendar_rect()
    _draw_panel(page, grid_rect, theme)
    page.insert_text((grid_rect.x0 + 18, grid_rect.y0 + 30), "No dated events are available yet.", fontsize=14, fontname="helv", color=theme.muted)


def _draw_month_watchouts(
    page: fitz.Page,
    month_anchor: date,
    month_entries: list[CalendarEntry],
    conflicts: list[dict],
    course_colors: dict[str, Color],
    theme: PdfTheme,
) -> None:
    band_rect = fitz.Rect(MARGIN, HEADER_H + 4, PAGE_WIDTH - MARGIN, HEADER_H + MONTH_BAND_H)
    _draw_panel(page, band_rect, theme)

    month_feel = _month_feel(month_entries, theme)
    page.insert_text((band_rect.x0 + 14, band_rect.y0 + 18), "MONTH FEEL", fontsize=7, fontname="helv", color=theme.muted)
    page.insert_text((band_rect.x0 + 14, band_rect.y0 + 38), month_feel[0], fontsize=13, fontname="helv", color=month_feel[2])
    _insert_wrapped(page, fitz.Rect(band_rect.x0 + 118, band_rect.y0 + 12, band_rect.x0 + 330, band_rect.y1 - 8), month_feel[1], 8, theme.muted)

    watchouts = _month_watchouts(month_anchor, conflicts, month_entries)
    watch_x = band_rect.x0 + 350
    page.insert_text((watch_x, band_rect.y0 + 18), "WATCHOUTS", fontsize=7, fontname="helv", color=theme.muted)
    if watchouts:
        for index, text in enumerate(watchouts[:2]):
            page.insert_text((watch_x, band_rect.y0 + 36 + index * 12), _fit_text(text, 52), fontsize=8, fontname="helv", color=theme.text)
    else:
        page.insert_text((watch_x, band_rect.y0 + 36), "No major calendar pressure detected.", fontsize=8, fontname="helv", color=theme.muted)

    legend_x = PAGE_WIDTH - MARGIN - 180
    page.insert_text((legend_x, band_rect.y0 + 18), "COURSES", fontsize=7, fontname="helv", color=theme.muted)
    legend_courses = list(course_colors.items())[:4]
    for index, (course_code, color) in enumerate(legend_courses):
        y = band_rect.y0 + 35 + (index // 2) * 13
        x = legend_x + (index % 2) * 85
        page.draw_circle((x + 4, y - 3), 3.5, color=color, fill=color)
        page.insert_text((x + 12, y), _fit_text(course_code, 12), fontsize=7, fontname="helv", color=theme.text)


def _draw_month_calendar(page: fitz.Page, month_anchor: date, entries: list[CalendarEntry], theme: PdfTheme) -> None:
    grid_rect = _calendar_rect()
    _draw_panel(page, grid_rect, theme)

    weekday_labels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    cell_w = grid_rect.width / 7
    cell_h = (grid_rect.height - DAY_HEADER_H) / 6
    chip_font_size = 6.2 if theme.name == "dark" else 5.8
    chip_font_size_compact = 5.8 if theme.name == "dark" else 5.3
    overflow_font_size = 5.8 if theme.name == "dark" else 5.4

    for index, label in enumerate(weekday_labels):
        x0 = grid_rect.x0 + index * cell_w
        page.insert_text((x0 + 8, grid_rect.y0 + 15), label, fontsize=8, fontname="helv", color=theme.muted)

    first_of_month = datetime(month_anchor.year, month_anchor.month, 1)
    start_day = first_of_month - timedelta(days=(first_of_month.weekday() + 1) % 7)
    entries_by_day: dict[str, list[CalendarEntry]] = {}
    for entry in entries:
        entries_by_day.setdefault(entry.date_value.isoformat(), []).append(entry)

    for idx in range(42):
        current_day = start_day + timedelta(days=idx)
        row = idx // 7
        col = idx % 7
        x0 = grid_rect.x0 + col * cell_w
        y0 = grid_rect.y0 + DAY_HEADER_H + row * cell_h
        rect = fitz.Rect(x0, y0, x0 + cell_w, y0 + cell_h)
        in_month = current_day.month == month_anchor.month
        fill = theme.surface if in_month else theme.surface_alt
        page.draw_rect(rect, color=theme.border, fill=fill, width=0.7)
        page.insert_text((x0 + CELL_PADDING, y0 + 13), str(current_day.day), fontsize=8, fontname="helv", color=theme.text if in_month else theme.muted)

        day_entries = entries_by_day.get(current_day.date().isoformat(), [])
        visible_entries = day_entries[:2]
        chip_y = y0 + 19
        for entry in visible_entries:
            chip_color = entry.color
            chip_rect = fitz.Rect(x0 + CELL_PADDING, chip_y, x0 + cell_w - CELL_PADDING, chip_y + 16)
            page.draw_rect(chip_rect, color=chip_color, fill=_soften(chip_color, 0.72, theme), width=0.7)
            chip_label = _event_chip_label(entry)
            chip_text_rect = fitz.Rect(chip_rect.x0 + 4, chip_rect.y0 + 2, chip_rect.x1 - 4, chip_rect.y1 - 2)
            if fitz.get_text_length(chip_label, fontname="helv", fontsize=chip_font_size) <= chip_text_rect.width:
                page.insert_text(
                    (chip_rect.x0 + 4, chip_rect.y0 + 11),
                    chip_label,
                    fontsize=chip_font_size,
                    fontname="helv",
                    color=theme.chip_text,
                )
            else:
                split_label = _responsive_chip_label(chip_label)
                chip_rect = fitz.Rect(chip_rect.x0, chip_rect.y0, chip_rect.x1, chip_rect.y0 + 24)
                page.draw_rect(chip_rect, color=chip_color, fill=_soften(chip_color, 0.72, theme), width=0.7)
                chip_text_rect = fitz.Rect(chip_rect.x0 + 4, chip_rect.y0 + 2, chip_rect.x1 - 4, chip_rect.y1 - 2)
                _insert_wrapped(page, chip_text_rect, split_label, chip_font_size_compact, theme.chip_text)
            chip_y += chip_rect.height + 2

        overflow_entries = day_entries[len(visible_entries):]
        if overflow_entries:
            overflow_rect = fitz.Rect(
                x0 + CELL_PADDING,
                chip_y + 1,
                x0 + cell_w - CELL_PADDING,
                rect.y1 - 4,
            )
            _draw_overflow_entries(page, overflow_rect, overflow_entries, overflow_font_size, theme)


def _calendar_rect() -> fitz.Rect:
    return fitz.Rect(MARGIN, HEADER_H + MONTH_BAND_H + 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN)


def _draw_panel(page: fitz.Page, rect: fitz.Rect, theme: PdfTheme, glow: Color | None = None) -> None:
    page.draw_rect(rect, color=theme.border, fill=theme.surface, width=0.8)
    if glow:
        page.draw_rect(
            fitz.Rect(rect.x0 + 1, rect.y0 + 1, rect.x1 - 1, rect.y0 + 5),
            color=glow,
            fill=_soften(glow, 0.18, theme),
            width=0,
        )


def _draw_glow(page: fitz.Page, x: float, y: float, radius: float, color: Color, theme: PdfTheme, *, opacity: float) -> None:
    for scale, alpha in ((1.0, opacity), (0.72, opacity * 0.6), (0.48, opacity * 0.3)):
        r = radius * scale
        rect = fitz.Rect(x - r, y - r, x + r, y + r)
        page.draw_oval(rect, color=None, fill=_soften(color, alpha, theme))


def _insert_wrapped(page: fitz.Page, rect: fitz.Rect, text: str, size: int, color: Color) -> None:
    page.insert_textbox(rect, text, fontsize=size, fontname="helv", color=color, lineheight=1.18)


def _course_color_map(courses: list, theme: PdfTheme) -> dict[str, Color]:
    palette = [
        theme.cyan,
        theme.rose,
        theme.amber,
        theme.green,
        theme.violet,
        (37 / 255, 99 / 255, 235 / 255),
        (14 / 255, 165 / 255, 233 / 255),
        (219 / 255, 39 / 255, 119 / 255),
    ]
    colors: dict[str, Color] = {}
    for index, course in enumerate(courses):
        colors[course.course_code] = palette[index % len(palette)]
    return colors


def _event_chip_label(entry: CalendarEntry) -> str:
    if entry.kind == "study":
        return f"Study - {entry.sublabel}"
    if entry.course_code:
        return f"{entry.course_code}: {entry.title}"
    return entry.title


def _responsive_chip_label(text: str) -> str:
    cleaned = " ".join(str(text).split())
    if ": " in cleaned:
        course_code, title = cleaned.split(": ", 1)
        return f"{course_code}\n{title}"
    if " - " in cleaned:
        left, right = cleaned.split(" - ", 1)
        return f"{left}\n{right}"
    return cleaned


def _draw_overflow_entries(
    page: fitz.Page,
    rect: fitz.Rect,
    entries: list[CalendarEntry],
    font_size: float,
    theme: PdfTheme,
) -> None:
    if rect.width <= 0 or rect.height <= 0:
        return

    line_step = font_size + 1.3
    max_lines = max(1, int(rect.height // line_step))
    current_y = rect.y0 + font_size
    text_x = rect.x0 + 8

    for entry in entries[:max_lines]:
        label = _fit_text_to_width(_overflow_entry_label(entry), rect.width - 10, font_size)
        if not label:
            continue
        page.draw_circle((rect.x0 + 3, current_y - 3), 1.8, color=entry.color, fill=entry.color)
        page.insert_text((text_x, current_y), label, fontsize=font_size, fontname="helv", color=theme.muted)
        current_y += line_step


def _overflow_entry_label(entry: CalendarEntry) -> str:
    if entry.kind == "study":
        return f"Study · {entry.sublabel}"
    if entry.course_code:
        return f"{entry.course_code} · {entry.title}"
    return entry.title


def _fit_text(text: str, max_chars: int) -> str:
    cleaned = " ".join(str(text).split())
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max(0, max_chars - 3)].rstrip() + "..."


def _fit_text_to_width(text: str, max_width: float, font_size: float) -> str:
    cleaned = " ".join(str(text).split())
    if not cleaned or max_width <= 0:
        return ""

    if fitz.get_text_length(cleaned, fontname="helv", fontsize=font_size) <= max_width:
        return cleaned

    trimmed = cleaned
    while trimmed and fitz.get_text_length(f"{trimmed}...", fontname="helv", fontsize=font_size) > max_width:
        trimmed = trimmed[:-1].rstrip()

    if not trimmed:
        return ""
    return f"{trimmed}..."


def _load_label(count: int, singular: str) -> str:
    if count <= 0:
        return "None yet"
    if count == 1:
        return f"1 {singular}"
    return f"{count} {singular}s"


def _weight_label(weight: float) -> str:
    if weight >= 30:
        return "Major grade item"
    if weight >= 15:
        return "Important graded work"
    if weight > 0:
        return "Graded checkpoint"
    return "No grade weight listed"


def _month_watchouts(month_anchor: date, conflicts: list[dict], entries: list[CalendarEntry]) -> list[str]:
    watchouts: list[str] = []
    month_conflicts = [
        conflict
        for conflict in conflicts
        if str(conflict["window_start"]).startswith(f"{month_anchor.year:04d}-{month_anchor.month:02d}")
    ]
    if month_conflicts:
        watchouts.append(_fit_text(month_conflicts[0]["message"], 72))

    exam_count = sum(1 for entry in entries if entry.tone == "exam")
    deadline_count = sum(1 for entry in entries if entry.kind == "event")
    if exam_count >= 2:
        watchouts.append("Multiple exams land in this month.")
    elif exam_count == 1:
        watchouts.append("Exam month. Keep review time protected.")
    elif deadline_count >= 6:
        watchouts.append("Several deadlines are clustered this month.")

    return watchouts[:2]


def _month_feel(entries: list[CalendarEntry], theme: PdfTheme) -> tuple[str, str, Color]:
    deadlines = sum(1 for entry in entries if entry.kind == "event")
    exams = sum(1 for entry in entries if entry.tone == "exam")
    study_blocks = sum(1 for entry in entries if entry.kind == "study")

    if exams >= 2 or deadlines >= 8:
        return ("Heavy month", "Clustered work. Review dates early.", theme.rose)
    if exams >= 1 or deadlines >= 4:
        return ("Busy month", "Enough activity to plan ahead.", theme.amber)
    if deadlines or study_blocks:
        return ("Manageable month", "Workload is spread out.", theme.green)
    return ("Quiet month", "No major dated work appears here.", theme.muted)


def _select_theme(theme: str) -> PdfTheme:
    normalized = theme.strip().lower()
    if normalized in {"white", "light"}:
        return LIGHT_THEME
    return DARK_THEME


def _soften(color: Color, alpha: float, theme: PdfTheme) -> Color:
    return tuple(min(1.0, channel * alpha + theme.bg[index] * (1 - alpha)) for index, channel in enumerate(color))
    return ("Busy month", "Enough activity to plan ahead.", theme.amber)
    if deadlines or study_blocks:
        return ("Manageable month", "Workload is spread out.", theme.green)
    return ("Quiet month", "No major dated work appears here.", theme.muted)


def _select_theme(theme: str) -> PdfTheme:
    normalized = theme.strip().lower()
    if normalized in {"white", "light"}:
        return LIGHT_THEME
    return DARK_THEME


def _soften(color: Color, alpha: float, theme: PdfTheme) -> Color:
    return tuple(min(1.0, channel * alpha + theme.bg[index] * (1 - alpha)) for index, channel in enumerate(color))

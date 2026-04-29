import re


SECTION_KEYWORDS = {
    "course_info_chunk": (
        "course info",
        "course details",
        "course description",
        "calendar description",
        "instructor",
        "instructional support",
        "overview",
        "timetable",
        "final exam",
    ),
    "grading_chunk": (
        "grading",
        "marking",
        "marking schemes",
        "assessment details",
        "assessments",
        "evaluation",
        "grade",
        "weight",
        "weights",
        "course requirements",
    ),
    "schedule_chunk": (
        "schedule",
        "lecture plan",
        "weekly",
        "calendar",
        "important dates",
        "other important dates",
        "timetable",
    ),
    "assignment_chunk": (
        "assignment",
        "assignments",
        "homework",
        "project",
        "projects",
        "dropbox",
        "submission",
    ),
    "exam_chunk": (
        "midterm",
        "midterms",
        "test",
        "tests",
        "exam",
        "exams",
        "final exam",
        "quiz",
        "quizzes",
    ),
    "policy_chunk": (
        "policy",
        "policies",
        "academic integrity",
        "late submission",
        "attendance",
        "missed",
        "accessibility",
        "misconduct",
        "accommodation",
        "university statements",
    ),
}

EXTRACTION_CHUNK_ORDER = (
    "course_info_chunk",
    "grading_chunk",
    "schedule_chunk",
    "assignment_chunk",
    "exam_chunk",
)

HEADING_PATTERN = re.compile(r"^\s*\d+(?:\.\d+)*\s+\S+")
WHITESPACE_PATTERN = re.compile(r"[ \t]+")


def chunk_outline(clean_text: str) -> dict[str, str]:
    chunks = {section: [] for section in SECTION_KEYWORDS}
    current_section = "course_info_chunk"

    for raw_line in clean_text.splitlines():
        line = WHITESPACE_PATTERN.sub(" ", raw_line).strip()
        if not line:
            continue

        if _is_heading(line):
            current_section = _classify_heading(line) or current_section

        chunks[current_section].append(line)

    return {
        section: "\n".join(lines).strip()
        for section, lines in chunks.items()
        if lines
    }


def build_extraction_text_from_chunks(
    chunks: dict[str, str],
    *,
    max_chars: int = 60000,
) -> str:
    selected_sections = []

    for section in EXTRACTION_CHUNK_ORDER:
        text = chunks.get(section)
        if text:
            selected_sections.append(f"## {section}\n{text}")

    if not selected_sections:
        selected_sections = [
            f"## {section}\n{text}"
            for section, text in chunks.items()
            if section != "policy_chunk" and text
        ]

    extraction_text = "\n\n".join(selected_sections).strip()
    return extraction_text[:max_chars]


def _is_heading(line: str) -> bool:
    if HEADING_PATTERN.match(line):
        return True
    if len(line) > 90:
        return False
    if line.endswith(":") and len(line.split()) <= 8:
        return True
    if line.isupper() and any(char.isalpha() for char in line):
        return True

    words = [word.strip("()[],:;") for word in line.split()]
    if not words or len(words) > 10:
        return False

    title_like_words = sum(
        1 for word in words if word[:1].isupper() or word.isupper()
    )
    return title_like_words >= max(1, int(len(words) * 0.6))


def _classify_heading(line: str) -> str | None:
    normalized = line.lower()
    scores = {
        section: sum(1 for keyword in keywords if keyword in normalized)
        for section, keywords in SECTION_KEYWORDS.items()
    }
    if scores["policy_chunk"] > 0 and _looks_like_policy_section(normalized):
        return "policy_chunk"

    best_section = max(scores, key=scores.get)
    if scores[best_section] == 0:
        return None
    return best_section


def _looks_like_policy_section(normalized_heading: str) -> bool:
    return any(
        keyword in normalized_heading
        for keyword in (
            "policy",
            "policies",
            "academic integrity",
            "accessibility",
            "misconduct",
            "accommodation",
            "university statements",
            "illness",
            "recording",
            "resources",
            "disclaimer",
            "covid",
        )
    )

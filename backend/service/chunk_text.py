import re

def chunk_outline(clean_text: str) -> dict:

    SECTION_KEYWORDS = {
        "course_info_chunk": ["course info", "course description", "instructor", "overview", "timetable"],
        "grading_chunk":     ["grading", "course grading", "assessment details", "marks", "course requirements"],
        "schedule_chunk":    ["schedule", "lecture plan", "weekly", "calendar", "important dates", "timetable"],
        "assignment_chunk":  ["assignment", "homework", "project"],
        "exam_chunk":        ["midterm", "final exam", "quiz", "quizzes", "assessments", "assessment details"],
        "policy_chunk":      ["policy", "policies", "academic integrity", "late submission", "attendance",
                              "missed", "accessibility", "misconduct", "accommodation"],
    }

    def is_header(line: str) -> bool:
        """
        A header is a SHORT line (under ~60 chars) that looks like a section title.
        It may start with a number (e.g. '6 Assessments', '6.1 Assessment Details')
        or be in title case / all caps.
        """
        stripped = line.strip()
        if not stripped or len(stripped) > 70:
            return False
        # Numbered section heading: "6 Assessments", "6.1 Assessment Details"
        if re.match(r'^\d+(\.\d+)*\s+\w+', stripped):
            return True
        # Short title-case or ALL CAPS line
        if stripped.istitle() or stripped.isupper():
            return True
        return False

    lines = clean_text.split("\n")
    chunks = {key: [] for key in SECTION_KEYWORDS}
    current_section = "course_info_chunk"  # default bucket

    for line in lines:
        stripped_lower = line.strip().lower()

        if is_header(line):
            # Only re-assign section on header lines
            for section, keywords in SECTION_KEYWORDS.items():
                if any(kw in stripped_lower for kw in keywords):
                    current_section = section
                    break

        # Always append to the current section (header line included)
        if stripped_lower:
            chunks[current_section].append(line)

    return {k: "\n".join(v).strip() for k, v in chunks.items() if v}
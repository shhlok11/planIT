import re

from schemas.clean_text import (
    CleanTextRequest,
    CleanTextResponse,
    CleanTextStats,
    CleanTextWarning,
)
from service.extract_from_pdf import PAGE_BREAK_TOKEN


PAGE_NUMBER_PATTERNS = (
    re.compile(r"^\s*page\s+\d+(\s+of\s+\d+)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*-\s*\d+\s*-\s*$"),
    re.compile(r"^\s*\d+\s*/\s*\d+\s*$"),
)

BULLET_PATTERN = re.compile(r"^\s*(?:[-*•]|[A-Za-z]\)|\d+[.)])\s+")
ISOLATED_BULLET_PATTERN = re.compile(r"^\s*[•*-]\s*$")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
URL_PATTERN = re.compile(r"^(?:https?://|www\.)", re.IGNORECASE)
PERCENT_PATTERN = re.compile(r"^\d+(?:\.\d+)?%$")
DATE_TIME_PATTERN = re.compile(
    r"^(?:mon|tue|wed|thu|fri|sat|sun|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}:\d{2}|\d{4}[-/]\d{1,2}[-/]\d{1,2})",
    re.IGNORECASE,
)
WEEK_PATTERN = re.compile(r"^weeks?\s+\d", re.IGNORECASE)
TOPIC_PATTERN = re.compile(r"^(topic|assignment|test|quiz|final exam|midterm|review)\b", re.IGNORECASE)
BRACKET_VALUE_PATTERN = re.compile(r"^\[(.+)\]$")
WHITESPACE_PATTERN = re.compile(r"[ \t]+")


def clean_extracted_text(
    *,
    upload_id: int,
    raw_text: str,
    options: CleanTextRequest,
) -> CleanTextResponse:
    normalized_text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    pages = _split_pages(normalized_text)
    original_lines = normalized_text.split("\n")

    normalized_whitespace_lines = 0
    removed_blank_lines = 0
    removed_page_number_lines = 0
    removed_header_lines = 0
    removed_footer_lines = 0

    page_lines: list[list[str]] = []
    for page in pages:
        lines = page.split("\n")
        normalized_lines = []
        for line in lines:
            cleaned_line = WHITESPACE_PATTERN.sub(" ", line).strip()
            if cleaned_line != line.strip():
                normalized_whitespace_lines += 1
            normalized_lines.append(cleaned_line)
        page_lines.append(normalized_lines)

    header_candidates = set()
    footer_candidates = set()
    if options.remove_repeated_headers:
        header_candidates = _find_repeated_edge_lines(page_lines, from_top=True)
    if options.remove_repeated_footers:
        footer_candidates = _find_repeated_edge_lines(page_lines, from_top=False)

    cleaned_pages: list[str] = []
    for lines in page_lines:
        working_lines = list(lines)

        if options.remove_repeated_headers:
            removed, working_lines = _strip_edge_lines(working_lines, header_candidates, from_top=True)
            removed_header_lines += removed

        if options.remove_repeated_footers:
            removed, working_lines = _strip_edge_lines(working_lines, footer_candidates, from_top=False)
            removed_footer_lines += removed

        filtered_lines = []
        blank_streak = 0
        for line in working_lines:
            if options.remove_page_numbers and _is_page_number_line(line):
                removed_page_number_lines += 1
                continue

            if not line:
                blank_streak += 1
                if options.collapse_blank_lines:
                    if blank_streak == 1:
                        filtered_lines.append("")
                    else:
                        removed_blank_lines += 1
                else:
                    filtered_lines.append("")
                continue

            blank_streak = 0
            filtered_lines.append(line)

        cleaned_page = _normalize_clean_lines(
            _trim_edge_blanks(filtered_lines),
            preserve_line_structure=options.preserve_line_structure,
        )

        if cleaned_page:
            cleaned_pages.append(cleaned_page)

    clean_text = "\n\n".join(page for page in cleaned_pages if page.strip()).strip()
    clean_text = _merge_orphaned_label_paragraphs(clean_text)
    warnings = _build_warnings(raw_text=normalized_text, clean_text=clean_text)

    response = CleanTextResponse(
        upload_id=upload_id,
        clean_text=clean_text,
        stats=CleanTextStats(
            original_char_count=len(normalized_text),
            cleaned_char_count=len(clean_text),
            original_line_count=len(original_lines),
            cleaned_line_count=len(clean_text.splitlines()) if clean_text else 0,
            removed_blank_lines=removed_blank_lines,
            removed_page_number_lines=removed_page_number_lines,
            removed_header_lines=removed_header_lines,
            removed_footer_lines=removed_footer_lines,
            normalized_whitespace_lines=normalized_whitespace_lines,
        ),
        warnings=warnings,
    )
    return response


def _split_pages(raw_text: str) -> list[str]:
    if PAGE_BREAK_TOKEN in raw_text:
        return [page for page in raw_text.split(PAGE_BREAK_TOKEN)]
    return [raw_text]


def _find_repeated_edge_lines(page_lines: list[list[str]], *, from_top: bool) -> set[str]:
    counts: dict[str, int] = {}
    for lines in page_lines:
        non_empty = [line for line in lines if line]
        edge_lines = non_empty[:3] if from_top else non_empty[-3:]
        for line in edge_lines:
            if _is_header_footer_candidate(line):
                counts[line] = counts.get(line, 0) + 1
    return {line for line, count in counts.items() if count >= 2}


def _is_header_footer_candidate(line: str) -> bool:
    if not line:
        return False
    if len(line) > 120:
        return False
    if _is_page_number_line(line):
        return True
    words = line.split()
    if len(words) > 12:
        return False
    if line.lower().startswith(("page ", "university of", "courselink", "course outline")):
        return True
    if any(char.isdigit() for char in line) and len(words) <= 6:
        return True
    return True


def _strip_edge_lines(lines: list[str], candidates: set[str], *, from_top: bool) -> tuple[int, list[str]]:
    if not candidates:
        return 0, lines

    working_lines = list(lines)
    removed = 0

    if from_top:
        while working_lines and working_lines[0] in candidates:
            working_lines.pop(0)
            removed += 1
    else:
        while working_lines and working_lines[-1] in candidates:
            working_lines.pop()
            removed += 1

    return removed, working_lines


def _is_page_number_line(line: str) -> bool:
    normalized = line.strip()
    if not normalized:
        return False
    return any(pattern.match(normalized) for pattern in PAGE_NUMBER_PATTERNS)


def _trim_edge_blanks(lines: list[str]) -> list[str]:
    start = 0
    end = len(lines)
    while start < end and not lines[start]:
        start += 1
    while end > start and not lines[end - 1]:
        end -= 1
    return lines[start:end]


def _normalize_clean_lines(lines: list[str], *, preserve_line_structure: bool) -> str:
    paragraphs: list[str] = []
    current_block: list[str] = []

    for line in lines:
        if not line:
            if current_block:
                paragraphs.append(
                    _collapse_block(
                        current_block,
                        preserve_line_structure=preserve_line_structure,
                    )
                )
                current_block = []
            continue
        current_block.append(line)

    if current_block:
        paragraphs.append(_collapse_block(current_block, preserve_line_structure=preserve_line_structure))

    separator = "\n\n" if preserve_line_structure else " "
    return separator.join(paragraphs).strip()


def _collapse_block(lines: list[str], *, preserve_line_structure: bool) -> str:
    normalized_lines = _prepare_block_lines(lines)
    logical_lines = _build_logical_lines(normalized_lines)

    if preserve_line_structure:
        return "\n".join(logical_lines)
    return " ".join(logical_lines)


def _prepare_block_lines(lines: list[str]) -> list[str]:
    prepared: list[str] = []
    index = 0

    while index < len(lines):
        line = _normalize_special_line(lines[index])

        if ISOLATED_BULLET_PATTERN.match(line) and index + 1 < len(lines):
            next_line = _normalize_special_line(lines[index + 1])
            if next_line:
                prepared.append(f"• {next_line}")
                index += 2
                continue

        prepared.append(line)
        index += 1

    return [line for line in prepared if line]


def _normalize_special_line(line: str) -> str:
    line = line.strip()
    bracket_match = BRACKET_VALUE_PATTERN.match(line)
    if bracket_match:
        return bracket_match.group(1).strip()
    return line


def _build_logical_lines(lines: list[str]) -> list[str]:
    logical_lines: list[str] = []
    current = ""
    index = 0

    while index < len(lines):
        line = lines[index]
        next_line = lines[index + 1] if index + 1 < len(lines) else None

        if _should_merge_label_with_next(line, next_line):
            merged_line = f"{line} {next_line}"
            if current:
                logical_lines.append(current)
                current = ""
            logical_lines.append(merged_line)
            index += 2
            continue

        if _is_standalone_line(line):
            if current:
                logical_lines.append(current)
                current = ""
            logical_lines.append(line)
            index += 1
            continue

        if not current:
            current = line
        elif _should_join_lines(current, line):
            current = f"{current} {line}"
        else:
            logical_lines.append(current)
            current = line

        index += 1

    if current:
        logical_lines.append(current)

    return logical_lines


def _should_merge_label_with_next(line: str, next_line: str | None) -> bool:
    if not next_line:
        return False
    if not line.endswith(":"):
        return False
    if len(next_line) > 100:
        return False
    if BULLET_PATTERN.match(next_line):
        return False
    if next_line.endswith(":"):
        return False
    if _looks_like_heading(next_line):
        return False
    return True


def _is_standalone_line(line: str) -> bool:
    if not line:
        return False
    if BULLET_PATTERN.match(line):
        return True
    if EMAIL_PATTERN.match(line) or URL_PATTERN.match(line):
        return True
    if line.endswith(":"):
        return True
    if PERCENT_PATTERN.match(line):
        return True
    if DATE_TIME_PATTERN.match(line):
        return True
    if WEEK_PATTERN.match(line):
        return True
    if _looks_like_heading(line):
        return True
    if TOPIC_PATTERN.match(line) and len(line.split()) <= 6:
        return True
    return False


def _looks_like_heading(line: str) -> bool:
    if len(line) > 80:
        return False
    if any(char in line for char in ".!?"):
        return False
    if EMAIL_PATTERN.match(line) or URL_PATTERN.match(line):
        return False

    words = line.split()
    if not words or len(words) > 10:
        return False

    alphabetic_words = [word for word in words if any(char.isalpha() for char in word)]
    if not alphabetic_words:
        return False

    title_like_words = 0
    for word in alphabetic_words:
        cleaned = word.strip("()[],:;")
        if not cleaned:
            continue
        if cleaned[:1].isupper() or cleaned.isupper():
            title_like_words += 1

    return title_like_words >= max(1, int(len(alphabetic_words) * 0.6))


def _should_join_lines(current: str, new_line: str) -> bool:
    if _is_standalone_line(new_line):
        return False
    if current.endswith(":"):
        return True
    if BULLET_PATTERN.match(current):
        return True
    if len(current) < 50:
        return True
    return not current.endswith((".", "?", "!", ";"))


def _build_warnings(*, raw_text: str, clean_text: str) -> list[CleanTextWarning]:
    warnings: list[CleanTextWarning] = []

    if not clean_text.strip():
        warnings.append(
            CleanTextWarning(
                code="empty_clean_text",
                message="Cleaning removed all readable content.",
                severity="high",
            )
        )
        return warnings

    if len(clean_text) < 500:
        warnings.append(
            CleanTextWarning(
                code="short_clean_text",
                message="Cleaned text is very short; extraction quality may be poor.",
                severity="medium",
                snippet=clean_text[:120],
            )
        )

    if raw_text and (1 - (len(clean_text) / max(len(raw_text), 1))) > 0.85:
        warnings.append(
            CleanTextWarning(
                code="high_reduction_ratio",
                message="A large amount of text was removed during cleaning. Review output for over-cleaning.",
                severity="medium",
            )
        )

    return warnings


def _merge_orphaned_label_paragraphs(clean_text: str) -> str:
    paragraphs = [paragraph.strip() for paragraph in clean_text.split("\n\n") if paragraph.strip()]
    merged: list[str] = []
    index = 0

    while index < len(paragraphs):
        current = paragraphs[index]
        next_paragraph = paragraphs[index + 1] if index + 1 < len(paragraphs) else None

        if _should_merge_label_paragraph(current, next_paragraph):
            merged.append(f"{current} {next_paragraph}")
            index += 2
            continue

        merged.append(current)
        index += 1

    return "\n\n".join(merged).strip()


def _should_merge_label_paragraph(current: str, next_paragraph: str | None) -> bool:
    if not next_paragraph:
        return False
    if "\n" in current or "\n" in next_paragraph:
        return False
    if not current.endswith(":"):
        return False
    if len(next_paragraph) > 100:
        return False
    if next_paragraph.endswith(":"):
        return False
    if _looks_like_heading(next_paragraph):
        return False
    return True

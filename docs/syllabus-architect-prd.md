# Syllabus Architect — PRD & System Design
### Hackathon Edition · Senior Dev Guide

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Scope & Constraints](#2-scope--constraints)
3. [System Architecture](#3-system-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Backend Design](#5-backend-design)
   - 5.1 [Data Models](#51-data-models)
   - 5.2 [API Routes](#52-api-routes)
   - 5.3 [Agent Pipeline](#53-agent-pipeline)
   - 5.4 [ICS Generation](#54-ics-generation)
   - 5.5 [Conflict Detection](#55-conflict-detection)
   - 5.6 [Error Handling](#56-error-handling)
6. [Frontend Design](#6-frontend-design)
   - 6.1 [Pages & Components](#61-pages--components)
   - 6.2 [API Integration](#62-api-integration)
   - 6.3 [ICS Preview & Download](#63-ics-preview--download)
7. [Environment Variables](#7-environment-variables)
8. [Local Dev Setup](#8-local-dev-setup)
9. [Deployment](#9-deployment)
10. [Hackathon Execution Plan](#10-hackathon-execution-plan)

---

## 1. Product Overview

**Syllabus Architect** ingests university syllabus PDFs and produces a clean, unified `.ics` calendar file the user can preview in-browser and download in one click — importable into any calendar app (Google Calendar, Apple Calendar, Outlook, Notion, etc.).

### Problem

University portals like CourseLink scatter deadlines across 5 different PDFs in 5 different formats. Students miss assignments because there is no single view of what is due when.

### Solution

Upload all your syllabi → get one `.ics` file with every deadline and conflict warnings — importable into any calendar app.

### User journey

```
Upload PDFs → View unified deadline timeline → See conflict warnings → Download .ics → Import to any calendar
```

### Core value props

- Zero account needed — works with every calendar app via `.ics`
- Conflict detection flags "hell weeks" automatically
- One download, done

---

## 2. Scope & Constraints

### In scope (hackathon MVP)

- Multi-PDF upload (up to 5 files, 20MB each)
- LLM-powered deadline extraction
- Unified `.ics` file generation
- In-browser deadline preview (table + timeline)
- Conflict detection and visual warnings
- One-click `.ics` download

### Out of scope (post-hackathon)

- User accounts / auth
- Direct Google Calendar or Outlook API sync
- Database persistence
- Mobile app
- Real-time collaboration

### Tech constraints

- Backend must be Python (PDF + LLM libraries)
- No database for MVP — all processing is stateless, in-memory per request
- `.ics` is the only calendar output format
- Processing must complete within 30 seconds (Anthropic API latency + PDF parsing)

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        BROWSER                          │
│                  Next.js — Vercel                       │
│                                                         │
│   [Upload Zone] → [Processing State] → [Dashboard]      │
│                                    ↓                    │
│              [Deadline Table] [Conflict Cards]           │
│                                    ↓                    │
│                     [Download .ics button]               │
└──────────────────────────┬──────────────────────────────┘
                           │  POST /api/v1/syllabus/process
                           │  multipart/form-data (PDFs)
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   FASTAPI BACKEND                       │
│                Railway (~$5/mo)                         │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 PIPELINE (sequential)            │   │
│  │                                                  │   │
│  │  1. Ingestion Agent                              │   │
│  │     pdfplumber → raw text per file               │   │
│  │              ↓                                   │   │
│  │  2. Extraction Agent                             │   │
│  │     Anthropic API → structured JSON deadlines    │   │
│  │              ↓                                   │   │
│  │  3. Conflict Engine                              │   │
│  │     48hr sliding window → ConflictGroups         │   │
│  │              ↓                                   │   │
│  │  4. ICS Builder                                  │   │
│  │     icalendar lib → .ics bytes                   │   │
│  └──────────────────────────────────────────────────┘   │
│                           ↓                             │
│              Single JSON response containing:           │
│              - deadlines[]                              │
│              - conflicts[]                              │
│              - ics_content (base64 string)              │
└─────────────────────────────────────────────────────────┘
                           │
                  Anthropic API (external)
```

### Key architectural decision: one endpoint, one response

Rather than multiple round trips, the frontend sends all PDFs in one request and gets back everything — deadlines, conflicts, and the `.ics` content — in a single JSON response. This keeps the frontend simple and avoids state management complexity during the hackathon.

---

## 4. Directory Structure

```
syllabus-architect/
│
├── .gitignore                    # ignore local env files, caches, builds
│
├── backend/
│   ├── main.py                      # FastAPI app, route registration, CORS
│   ├── Procfile                     # Railway: uvicorn main:app ...
│   ├── requirements.txt
│   ├── .env                         # local secrets — never commit
│   │
│   ├── routers/
│   │   └── syllabus.py              # all routes (single router for MVP)
│   │
│   ├── agents/
│   │   ├── ingestion_agent.py       # PDF bytes → raw text string
│   │   └── extraction_agent.py      # raw text → list[Deadline] via Anthropic
│   │
│   ├── core/
│   │   ├── conflict_engine.py       # list[Deadline] → list[ConflictGroup]
│   │   └── ics_builder.py           # list[Deadline] → .ics bytes
│   │
│   ├── models/
│   │   ├── deadline.py              # Deadline, DeadlineType
│   │   └── conflict.py              # ConflictGroup, ConflictSeverity
│   │
│   └── utils/
│       ├── prompts.py               # EXTRACTION_SYSTEM_PROMPT constant
│       └── date_utils.py            # timezone helpers
│
├── frontend/
│   ├── .env.local                   # NEXT_PUBLIC_API_URL
│   ├── next.config.js
│   ├── package.json
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Upload page (step 1)
│   │   └── dashboard/
│   │       └── page.tsx             # Results page (step 2)
│   │
│   ├── components/
│   │   ├── UploadZone.tsx           # Drag-and-drop multi-PDF upload
│   │   ├── ProcessingState.tsx      # Loading animation while API runs
│   │   ├── DeadlineTable.tsx        # Sortable, filterable deadline list
│   │   ├── ConflictCard.tsx         # Warning card per conflict group
│   │   ├── TimelineView.tsx         # Visual week-by-week timeline
│   │   └── DownloadButton.tsx       # Triggers .ics file download
│   │
│   ├── lib/
│   │   ├── api.ts                   # uploadSyllabi() — single fetch call
│   │   └── types.ts                 # mirrors all Pydantic models exactly
│   │
│   └── hooks/
│       └── useSyllabus.ts           # state: idle | loading | success | error
│
└── docs/
    └── syllabus-architect-prd.md    # this file
```

---

## 5. Backend Design

### 5.1 Data Models

All models live in `backend/models/`. Every field is typed. Pydantic v2 handles validation automatically.

```python
# models/deadline.py
from pydantic import BaseModel, field_validator
from datetime import date
from typing import Optional
from enum import Enum

class DeadlineType(str, Enum):
    exam       = "exam"
    assignment = "assignment"
    quiz       = "quiz"
    lab        = "lab"
    project    = "project"
    other      = "other"

class Deadline(BaseModel):
    id:          str           # generated: f"{course_slug}_{index}"
    title:       str
    date:        Optional[date]  # null if LLM can't determine it
    type:        DeadlineType
    weight:      Optional[float] # % of final grade, null if not stated
    course:      str
    description: Optional[str] = None

    @field_validator("weight")
    @classmethod
    def clamp_weight(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError("weight must be 0–100")
        return v
```

```python
# models/conflict.py
from pydantic import BaseModel
from datetime import date
from enum import Enum

class ConflictSeverity(str, Enum):
    high   = "high"    # 3+ deadlines within 48hrs
    medium = "medium"  # 2 deadlines within 48hrs, both >15% weight
    low    = "low"     # 2 deadlines within 48hrs

class ConflictGroup(BaseModel):
    severity:     ConflictSeverity
    window_start: date
    window_end:   date
    deadlines:    list[Deadline]
    message:      str  # human-readable e.g. "3 deadlines within 48 hours"
```

```python
# models/response.py — the single API response shape
from pydantic import BaseModel

class ProcessResponse(BaseModel):
    deadlines:    list[Deadline]
    conflicts:    list[ConflictGroup]
    ics_b64:      str   # base64-encoded .ics file content
    stats: dict         # {"total": 12, "courses": 3, "conflicts": 2}
```

---

### 5.2 API Routes

The MVP has **two routes**. That's it.

```
POST   /api/v1/syllabus/process    ← main pipeline
GET    /api/v1/health              ← uptime check for Railway
```

#### POST /api/v1/syllabus/process

This is the only route that matters. It runs the entire pipeline and returns everything.

**Request** — `multipart/form-data`:

```
files[]        File[]    Required. One or more PDF files. Max 5 files, 20MB each.
timezone       string    Optional. Canadian IANA timezone. Default: "America/Toronto"
```

Accepted timezone values:

| Label | IANA string |
|---|---|
| Eastern (ON, QC) | `America/Toronto` |
| Central (MB, SK) | `America/Winnipeg` |
| Mountain (AB) | `America/Edmonton` |
| Pacific (BC) | `America/Vancouver` |
| Atlantic (NS, NB) | `America/Halifax` |
| Newfoundland | `America/St_Johns` |

**Response** — `application/json`:

```json
{
  "deadlines": [
    {
      "id": "cs3500_0",
      "title": "Midterm 1",
      "date": "2025-10-14",
      "type": "exam",
      "weight": 25,
      "course": "CS3500",
      "description": null
    }
  ],
  "conflicts": [
    {
      "severity": "high",
      "window_start": "2025-10-14",
      "window_end": "2025-10-15",
      "deadlines": [...],
      "message": "3 deadlines within 48 hours"
    }
  ],
  "ics_b64": "QkVHSU46VkNBTEVOREFSCk...",
  "stats": {
    "total_deadlines": 12,
    "courses": 3,
    "conflicts_found": 2
  }
}
```

**Error responses:**

| Status | When | Body |
|--------|------|------|
| `400` | No files attached, or wrong file type | `{"detail": "Only PDF files are accepted"}` |
| `413` | File exceeds 20MB | `{"detail": "File too large: max 20MB per file"}` |
| `422` | PDF text extraction failed on all pages | `{"detail": "Could not extract text from filename.pdf"}` |
| `429` | Anthropic rate limit hit after retries | `{"detail": "AI service temporarily unavailable, try again in 60s"}` |
| `500` | Unexpected error | `{"detail": "Internal server error"}` |

#### GET /api/v1/health

```json
{ "status": "ok" }
```

---

### 5.3 Agent Pipeline

#### main.py — entry point and route wiring

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.syllabus import router
import os

app = FastAPI(title="Syllabus Architect API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
```

#### routers/syllabus.py — route handler

```python
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import base64

from agents.ingestion_agent import extract_text
from agents.extraction_agent import extract_deadlines
from core.conflict_engine import detect_conflicts
from core.ics_builder import build_ics
from models.response import ProcessResponse

router = APIRouter()

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

CANADIAN_TIMEZONES = {
    "America/Toronto", "America/Winnipeg", "America/Edmonton",
    "America/Vancouver", "America/Halifax", "America/St_Johns",
}

@router.post("/syllabus/process", response_model=ProcessResponse)
async def process_syllabi(
    files: List[UploadFile] = File(...),
    timezone: str = Form(default="America/Toronto"),
):
    if not files:
        raise HTTPException(400, "At least one PDF file is required")
    if timezone not in CANADIAN_TIMEZONES:
        raise HTTPException(400, f"Unsupported timezone. Must be one of: {', '.join(sorted(CANADIAN_TIMEZONES))}")

    all_deadlines = []

    for file in files[:5]:  # hard cap at 5 files
        if not file.filename.endswith(".pdf"):
            raise HTTPException(400, f"Only PDF files accepted, got: {file.filename}")

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, f"File too large: {file.filename}")

        # Step 1: PDF → raw text
        raw_text = extract_text(content, file.filename)

        # Step 2: raw text → structured deadlines
        course_name = file.filename.replace(".pdf", "").replace("_", " ").upper()
        deadlines = extract_deadlines(raw_text, course_name)
        all_deadlines.extend(deadlines)

    # Step 3: detect conflict weeks
    conflicts = detect_conflicts(all_deadlines)

    # Step 4: build .ics file
    ics_bytes = build_ics(all_deadlines, timezone)
    ics_b64 = base64.b64encode(ics_bytes).decode("utf-8")

    return ProcessResponse(
        deadlines=all_deadlines,
        conflicts=conflicts,
        ics_b64=ics_b64,
        stats={
            "total_deadlines": len(all_deadlines),
            "courses": len(set(d.course for d in all_deadlines)),
            "conflicts_found": len(conflicts),
        }
    )

@router.get("/health")
def health():
    return {"status": "ok"}
```

#### agents/ingestion_agent.py

```python
import pdfplumber
import fitz  # PyMuPDF
import io
from fastapi import HTTPException

def extract_text(pdf_bytes: bytes, filename: str) -> str:
    text = _try_pdfplumber(pdf_bytes)
    if not text.strip():
        text = _try_pymupdf(pdf_bytes)
    if not text.strip():
        raise HTTPException(422, f"Could not extract text from {filename}")
    return text

def _try_pdfplumber(pdf_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        return ""

def _try_pymupdf(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except Exception:
        return ""
```

#### agents/extraction_agent.py

```python
import anthropic
import json
import time
import uuid
from fastapi import HTTPException
from models.deadline import Deadline, DeadlineType
from utils.prompts import EXTRACTION_SYSTEM_PROMPT

client = anthropic.Anthropic()

def extract_deadlines(raw_text: str, course: str) -> list[Deadline]:
    raw_json = _call_llm_with_retry(raw_text)
    return _validate(raw_json, course)

def _call_llm_with_retry(text: str, max_retries: int = 3) -> list[dict]:
    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                system=EXTRACTION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text}],
            )
            raw = response.content[0].text.strip()
            # Strip markdown fences defensively
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw.strip())
        except json.JSONDecodeError:
            if attempt == max_retries - 1:
                return []  # fail gracefully, not hard crash
            time.sleep(2 ** attempt)
        except anthropic.RateLimitError:
            if attempt == max_retries - 1:
                raise HTTPException(429, "AI service temporarily unavailable, try again in 60s")
            time.sleep(60)
    return []

def _validate(raw_list: list[dict], course: str) -> list[Deadline]:
    validated = []
    for i, item in enumerate(raw_list):
        try:
            item["id"] = f"{course.lower().replace(' ', '_')}_{i}"
            item["course"] = course
            validated.append(Deadline(**item))
        except Exception as e:
            print(f"[WARN] Skipping invalid deadline: {item.get('title')} — {e}")
    return validated
```

#### utils/prompts.py

```python
EXTRACTION_SYSTEM_PROMPT = """
You are a university syllabus parser. Extract every graded assessment and deadline from the text.

Return ONLY a valid JSON array. No explanation, no markdown fences, no preamble. Raw JSON only.

Each item must follow this exact schema:
{
  "title": "Name of the assessment exactly as written",
  "date": "YYYY-MM-DD or null if the date is ambiguous or not given",
  "type": "exam | assignment | quiz | lab | project | other",
  "weight": 25.0,
  "description": "any additional context about the deadline, or null"
}

Rules:
- weight is the percentage of the final grade as a number (e.g. 25.0), or null if not stated
- If only a week number is given (e.g. "Week 8"), set date to null
- Include every graded item — do not skip low-weight items
- If there are no deadlines, return an empty array: []
"""
```

---

### 5.4 ICS Generation

#### core/ics_builder.py

```python
from icalendar import Calendar, Event, Alarm
from datetime import timedelta
import pytz
import uuid

from models.deadline import Deadline

def build_ics(
    deadlines: list[Deadline],
    timezone: str = "America/Toronto",
) -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//Syllabus Architect//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", "Syllabus Architect")

    # Add deadline events
    for dl in deadlines:
        if dl.date is None:
            continue  # skip undated deadlines
        event = Event()
        event.add("uid", str(uuid.uuid4()))
        event.add("summary", f"[{dl.course}] {dl.title}")
        event.add("dtstart", dl.date)
        event.add("dtend", dl.date + timedelta(days=1))
        event.add("description", _build_description(dl))
        event.add("categories", [dl.type.value.upper()])

        # 1-week reminder
        alarm_week = Alarm()
        alarm_week.add("action", "DISPLAY")
        alarm_week.add("description", f"1 week until: {dl.title}")
        alarm_week.add("trigger", timedelta(days=-7))
        event.add_component(alarm_week)

        # 1-day reminder
        alarm_day = Alarm()
        alarm_day.add("action", "DISPLAY")
        alarm_day.add("description", f"Tomorrow: {dl.title}")
        alarm_day.add("trigger", timedelta(days=-1))
        event.add_component(alarm_day)

        cal.add_component(event)

    return cal.to_ical()

def _build_description(dl: Deadline) -> str:
    parts = [f"Course: {dl.course}", f"Type: {dl.type.value}"]
    if dl.weight:
        parts.append(f"Weight: {dl.weight}% of final grade")
    if dl.description:
        parts.append(f"Notes: {dl.description}")
    return "\n".join(parts)
```

---

### 5.5 Conflict Detection

#### core/conflict_engine.py

```python
from datetime import timedelta
from models.deadline import Deadline
from models.conflict import ConflictGroup, ConflictSeverity

def detect_conflicts(deadlines: list[Deadline]) -> list[ConflictGroup]:
    # Only process deadlines with known dates
    dated = sorted(
        [d for d in deadlines if d.date is not None],
        key=lambda x: x.date
    )

    groups: list[ConflictGroup] = []
    visited = set()

    for i, anchor in enumerate(dated):
        if i in visited:
            continue

        cluster = [anchor]
        for j in range(i + 1, len(dated)):
            delta = (dated[j].date - anchor.date).days
            if delta <= 2:
                cluster.append(dated[j])
                visited.add(j)
            else:
                break  # sorted, so no point continuing

        if len(cluster) < 2:
            continue

        severity = _get_severity(cluster)
        groups.append(ConflictGroup(
            severity=severity,
            window_start=cluster[0].date,
            window_end=cluster[-1].date,
            deadlines=cluster,
            message=_build_message(cluster, severity),
        ))
        visited.add(i)

    return groups

def _get_severity(cluster: list[Deadline]) -> ConflictSeverity:
    if len(cluster) >= 3:
        return ConflictSeverity.high
    # 2 deadlines — check weights
    weights = [d.weight for d in cluster if d.weight is not None]
    if len(weights) == 2 and all(w > 15 for w in weights):
        return ConflictSeverity.medium
    return ConflictSeverity.low

def _build_message(cluster: list[Deadline], severity: ConflictSeverity) -> str:
    n = len(cluster)
    courses = list(set(d.course for d in cluster))
    return f"{n} deadlines across {', '.join(courses)} within 48 hours — {severity.value} conflict"
```

#### Severity rules

| Condition | Severity | Suggested UI |
|---|---|---|
| 3+ deadlines within 48hrs | `high` | Red warning card |
| 2 deadlines within 48hrs, both weighted >15% | `medium` | Orange warning card |
| 2 deadlines within 48hrs | `low` | Yellow info card |

---

### 5.6 Error Handling

Follow this hierarchy — never let the pipeline crash silently and never return a 500 for a user-fixable issue.

| Layer | Strategy |
|---|---|
| File validation | Check extension and size before any processing. Return `400` or `413` immediately. |
| PDF extraction | Try pdfplumber first, fallback to PyMuPDF. Only raise `422` if both fail. |
| LLM JSON decode | Retry up to 3 times with exponential backoff. Return empty list on final failure — don't crash the whole request. |
| LLM rate limit | Wait 60s, retry once. Return `429` with a user-friendly message on second failure. |
| Pydantic validation | Catch per-item, log warning, skip bad items. Never fail the whole extraction for one bad item. |
| ICS generation | Skip deadlines with `date: null`. Never crash on missing data. |
| Uncaught exceptions | FastAPI's default `500` handler is fine. Log the error. |

```python
# requirements.txt
fastapi==0.111.0
uvicorn==0.30.0
python-multipart==0.0.9
anthropic==0.28.0
pdfplumber==0.11.0
PyMuPDF==1.24.0
pydantic==2.7.0
python-dotenv==1.0.0
icalendar==5.0.13
pytz==2024.1
```

---

## 6. Frontend Design

### 6.1 Pages & Components

The frontend has exactly **two pages**. Keep it simple for the hackathon.

#### Page 1: `/` — Upload

State: `idle | loading | error`

```
┌─────────────────────────────────────────┐
│         Syllabus Architect              │
│   Drop your syllabi. Get one calendar. │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │   Drag & drop PDFs here          │   │
│  │   or click to browse             │   │
│  │                                  │   │
│  │   [cs3500.pdf ✓] [math.pdf ✓]   │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Timezone: [Eastern — Toronto ▼]        │
│                                         │
│          [Process Syllabi →]            │
└─────────────────────────────────────────┘
```

**Components on this page:**
- `UploadZone.tsx` — drag-and-drop, file list, remove files
- `ProcessingState.tsx` — spinner + step-by-step status ("Parsing PDFs… Extracting deadlines… Building calendar…")

#### Page 2: `/dashboard` — Results

State: populated from API response, stored in `sessionStorage` (no DB needed)

```
┌─────────────────────────────────────────────────────┐
│  Syllabus Architect          [↓ Download .ics]      │
├──────────────────┬──────────────────────────────────┤
│                  │                                  │
│  ⚠ CONFLICTS     │   ALL DEADLINES                 │
│                  │                                  │
│  🔴 Oct 14-15    │   Oct 14 📝 Midterm 1 — CS3500  │
│  3 deadlines     │   Oct 15 📋 Assign 2 — MATH     │
│  across 3 courses│   Oct 15 🔬 Lab Report — PHYS   │
│                  │   ...                           │
│  🟡 Nov 20-21    │                                  │
│  2 deadlines     │   Filter: [All ▼] [All ▼]       │
│                  │   Sort: [Date ▼]                 │
└──────────────────┴──────────────────────────────────┘
│                  TIMELINE (week view)               │
│  [Oct W1][Oct W2][Oct W3][Oct W4][Nov W1]...        │
│       ████████████                                  │
└─────────────────────────────────────────────────────┘
```

**Components on this page:**

| Component | Props | Responsibility |
|---|---|---|
| `DeadlineTable` | `deadlines[]` | Sortable by date/course/type, filterable by course and type |
| `ConflictCard` | `conflict` | Severity badge, deadline list, "this is a tough week" message |
| `TimelineView` | `deadlines[]`, `conflicts[]` | Visual week grid, color-coded by course, conflict weeks highlighted |
| `DownloadButton` | `ics_b64: string` | Decodes base64, triggers browser file download |

---

### 6.2 API Integration

#### lib/types.ts — mirrors Pydantic models exactly

```typescript
export type DeadlineType = "exam" | "assignment" | "quiz" | "lab" | "project" | "other";
export type ConflictSeverity = "high" | "medium" | "low";

export interface Deadline {
  id: string;
  title: string;
  date: string | null;  // "YYYY-MM-DD"
  type: DeadlineType;
  weight: number | null;
  course: string;
  description: string | null;
}

export interface ConflictGroup {
  severity: ConflictSeverity;
  window_start: string;
  window_end: string;
  deadlines: Deadline[];
  message: string;
}

export interface ProcessResponse {
  deadlines: Deadline[];
  conflicts: ConflictGroup[];
  ics_b64: string;
  stats: {
    total_deadlines: number;
    courses: number;
    conflicts_found: number;
  };
}
```

#### lib/api.ts

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function uploadSyllabi(
  files: File[],
  timezone: string = "America/Toronto"
): Promise<ProcessResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("timezone", timezone);

  const res = await fetch(`${API_URL}/api/v1/syllabus/process`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? "Something went wrong");
  }

  return res.json();
}
```

#### hooks/useSyllabus.ts

```typescript
import { useState } from "react";
import { uploadSyllabi } from "@/lib/api";
import { ProcessResponse } from "@/lib/types";

type State = "idle" | "loading" | "success" | "error";

export function useSyllabus() {
  const [state, setState] = useState<State>("idle");
  const [data, setData] = useState<ProcessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function process(files: File[], timezone: string) {
    setState("loading");
    setError(null);
    try {
      const result = await uploadSyllabi(files, timezone);
      setData(result);
      setState("success");
      // Store in sessionStorage so dashboard page can access it
      sessionStorage.setItem("syllabusData", JSON.stringify(result));
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  }

  return { state, data, error, process };
}
```

---

### 6.3 ICS Preview & Download

The `.ics` file content comes back as a base64 string in `ics_b64`. The download button decodes it and triggers a browser download — no server needed for the download step.

#### components/DownloadButton.tsx

```typescript
interface Props {
  ics_b64: string;
  filename?: string;
}

export function DownloadButton({ ics_b64, filename = "my-semester.ics" }: Props) {
  function handleDownload() {
    // Decode base64 → binary string → Blob
    const binary = atob(ics_b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={handleDownload}>
      ↓ Download .ics
    </button>
  );
}
```

**What happens after download:**

The user opens the `.ics` file and their OS asks which calendar app to use. Google Calendar, Apple Calendar, and Outlook all import `.ics` natively. This is the zero-integration approach — no OAuth, no API keys for the user, it just works.

---

## 7. Environment Variables

### Backend — `.env` (never commit)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# CORS — your Vercel URL
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend — `.env.local` (never commit)

```bash
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

For local development:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 8. Local Dev Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Anthropic API key

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

FastAPI docs auto-available at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                        # runs on localhost:3000
```

---

## 9. Deployment

### Backend → Railway

1. Push `backend/` to GitHub
2. New project at [railway.app](https://railway.app) → connect repo → select `backend/` as root
3. Railway detects Python and runs `Procfile` automatically
4. Add environment variables in Railway dashboard:
   - `ANTHROPIC_API_KEY`
   - `FRONTEND_URL` (your Vercel URL — add this after deploying frontend)
5. Copy the Railway public URL (e.g. `https://syllabus-api.up.railway.app`)

**Procfile:**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Import at [vercel.com](https://vercel.com) → auto-detects Next.js
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Railway URL
4. Deploy — Vercel gives you a `.vercel.app` URL

Go back to Railway and update `FRONTEND_URL` with your Vercel URL, then redeploy.

---

## 10. Hackathon Execution Plan

Work in this order. Do not skip ahead.

### Hour 0–1: Foundation

- [ ] Create monorepo with `backend/` and `frontend/` folders
- [ ] Set up FastAPI with health route, confirm it runs
- [ ] Set up Next.js, confirm it runs
- [ ] Install all Python dependencies
- [ ] Test Anthropic API key with a raw `curl`

### Hour 1–3: Backend pipeline

- [ ] `ingestion_agent.py` — test with a real syllabus PDF, print raw text
- [ ] `extraction_agent.py` — test with raw text, print returned JSON
- [ ] `models/` — define all Pydantic models
- [ ] `conflict_engine.py` — unit test with hardcoded dates
- [ ] `ics_builder.py` — generate a test `.ics`, import to Apple Calendar manually
- [ ] Wire everything into the `/syllabus/process` route
- [ ] Test the full route with Postman or `curl`

### Hour 3–5: Frontend

- [ ] `UploadZone.tsx` — drag-and-drop works, files listed
- [ ] `useSyllabus.ts` hook — calls API, handles loading/error
- [ ] `DeadlineTable.tsx` — renders deadlines from API response
- [ ] `DownloadButton.tsx` — download works, `.ics` imports to calendar
- [ ] `ConflictCard.tsx` — conflict warnings render correctly

### Hour 5–6: Polish & deploy

- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Vercel
- [ ] End-to-end test on production URLs
- [ ] `TimelineView.tsx` — if time allows
- [ ] Demo prep: have 2–3 real syllabus PDFs ready to upload live

### If you run out of time, cut in this order

1. Cut `TimelineView.tsx` — table is enough for the demo
2. Cut multi-file support — single PDF upload still demonstrates the core value
3. Never cut the download button — that's the whole point

# planIT — Full Stitch UI Prompt
# Backend: https://github.com/shhlok11/planIT/tree/main/backend
# Every field, enum, URL, and response shape below is pulled directly from the source code.

---

Design a full-stack web application called **planIT** — a semester study planner that transforms uploaded university syllabi into AI-generated, priority-scored study schedules. The GitHub backend lives at https://github.com/shhlok11/planIT/tree/main/backend and runs as a FastAPI server at http://localhost:8000. Every UI element must map to a real API field — no placeholder data.

---

## DESIGN SYSTEM

**Typography**
- Display/headings: Syne weight 800, letter-spacing -0.03em
- All data values (IDs, scores, percentages, dates, enum tags, code): JetBrains Mono weight 400–500
- UI labels, buttons, nav: Syne weight 500–600, letter-spacing 0.01em
- Never use Inter, Roboto, or system-ui

**Color palette — exact hex values**
- Page background: `#05060F`
- Panel surface: `rgba(255,255,255,0.03)`, border: `rgba(255,255,255,0.07)`
- Violet primary: `#7C3AED` | glow: `rgba(124,58,237,0.25)`
- Cyan secondary: `#06B6D4` | glow: `rgba(6,182,212,0.2)`
- Cobalt tertiary: `#2563EB`
- Danger/conflict red: `#EF4444`
- Warning amber: `#F59E0B`
- Success emerald: `#10B981`
- Muted text: `rgba(232,234,240,0.45)`
- Foreground: `#E8EAF0`

**Score color mapping** (used on every priority_score number):
- ≥ 90 → `#fca5a5` (red)
- 75–89 → `#fcd34d` (amber)
- 60–74 → `#6ee7b7` (emerald)
- < 60 → `#94a3b8` (slate)

**EventType color mapping** (used on every type badge/chip):
- `exam` → amber `#fcd34d` on `rgba(245,158,11,0.15)` border `rgba(245,158,11,0.25)`
- `assignment` → cyan `#67e8f9` on `rgba(6,182,212,0.15)`
- `project` → violet `#a78bfa` on `rgba(124,58,237,0.15)`
- `quiz` → cobalt `#93c5fd` on `rgba(37,99,235,0.15)`
- `lab` → emerald `#6ee7b7` on `rgba(16,185,129,0.15)`
- `other` → slate `#94a3b8` on `rgba(148,163,184,0.1)`

**Severity color mapping** (ConflictSeverity enum):
- `high` → red `#ef4444`
- `medium` → amber `#f59e0b`
- `low` → cyan `#06b6d4`

**Upload status color mapping** (status state machine):
- `UPLOADED` → slate
- `PROCESSING` → amber pulsing
- `CLEANED` → cyan
- `EXTRACTED` → emerald
- `NEEDS_REVIEW` → red

**Atmosphere**
- Two aurora blobs fixed behind all content: violet ellipse top-left 12% opacity, cyan ellipse bottom-right 10% opacity
- Noise texture SVG overlay at 4% opacity full-viewport
- All panels: dark semi-transparent bg + backdrop-blur-md + 1px border-top highlight (linear-gradient transparent → accent-color 50% opacity → transparent)
- Animated scan-line: thin shimmer stripe sweeps left-to-right across panels every 7s

**Layout constants**
- Page padding: 32px | Panel padding: 20–24px | Grid gap: 16px | Base unit: 4px
- Radii: 14px panels, 10px cards, 6px tags, 4px micro

---

## NEXT.JS WIRING

In `next.config.js`:
```js
rewrites: async () => [
  { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }
]
```

All frontend fetches use `/api/v1/...` — Next.js proxies to FastAPI. Zero CORS issues.

**TanStack Query keys** (exact, used for invalidation):
```ts
['upload-status', uploadId]          → GET /api/v1/uploads/upload-status/{uploadId}
['courses', uploadId]                → GET /api/v1/uploads/{uploadId}/courses
['priority-scores', uploadId]        → GET /api/v1/uploads/{uploadId}/priority-scores
['conflicts', uploadId]              → GET /api/v1/uploads/{uploadId}/conflicts
['study-blocks', uploadId]           → GET /api/v1/uploads/{uploadId}/study-blocks
['preferences']                      → GET /api/v1/preferences/latest
```

---

## COMPLETE TYPESCRIPT TYPES
(Derived exactly from /backend/schemas/)

```ts
// Enums — exact string values from Pydantic
type EventType = 'assignment' | 'exam' | 'quiz' | 'lab' | 'project' | 'other'
type ConflictRule = '48_hour_window' | 'same_week' | 'high_weight_window'
type ConflictSeverity = 'low' | 'medium' | 'high'
type PreferredStudyTime = 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible'
type PlanIntensity = 'light' | 'balanced' | 'intense'
type UploadStatus = 'UPLOADED' | 'PROCESSING' | 'CLEANED' | 'EXTRACTED' | 'NEEDS_REVIEW'

// Upload status (GET /uploads/upload-status/{id})
interface UploadStatus {
  upload_id: number
  original_filename: string
  saved_filename: string
  status: UploadStatus
  file_size_bytes: number
  storage_path: string
  created_at: string         // ISO datetime
  has_extracted_text: boolean
  has_clean_text: boolean
}

// Course event (nested in CourseRead)
interface CourseEventRead {
  id: number
  course_id: number
  title: string
  type: EventType
  date: string | null        // "YYYY-MM-DD"
  weight: number | null      // 0–100 (grade percentage)
  confidence: number | null  // 0–1 (AI extraction confidence)
  source_text: string | null
  is_user_edited: boolean    // true after PATCH /events/{id}
  created_at: string
}

// Course (GET /uploads/{id}/courses → courses[])
interface CourseRead {
  id: number
  upload_id: number
  course_code: string        // e.g. "CIS*3110"
  course_name: string | null
  semester: string | null
  priority_rank: number | null   // 1 = highest, user-draggable
  difficulty: number | null      // 1–3, user-editable stars
  created_at: string
  events: CourseEventRead[]
}

// Priority score components — each maps to a visual bar segment
interface PriorityScoreComponents {
  urgency: number              // 0–35 (days-until-due)
  course_priority: number      // 0–20 (priority_rank)
  difficulty: number           // 0–12 (course.difficulty)
  weight: number               // 0–25 (event.weight)
  event_type: number           // exam=10, project=8, assignment=5, quiz=4, lab=3, other=2
  confidence_adjustment: number  // -10 to 0 (penalises low confidence)
  reminder_window: number      // 0 or +8 (within minimum_reminder_days)
  intensity_multiplier: number // 0.9 light / 1.0 balanced / 1.1 intense
}

// Priority score (GET /uploads/{id}/priority-scores → scores[])
interface PriorityScoreRead {
  event_id: number
  course_id: number
  course_code: string
  title: string
  type: string
  date: string | null
  days_until_due: number | null
  weight: number | null
  confidence: number | null
  priority_score: number       // 0–100 (final score, past events capped at 15, undated at 65)
  components: PriorityScoreComponents
  reasons: string[]            // human-readable reason strings, show on hover
  warnings: string[]           // show ⚠ icon if non-empty
}

// Conflict (GET /uploads/{id}/conflicts → conflicts[])
interface ConflictRead {
  rule: ConflictRule
  severity: ConflictSeverity
  window_start: string         // "YYYY-MM-DD"
  window_end: string
  event_ids: number[]          // sorted, deduplicated
  message: string              // e.g. "3 deadlines within 48 hours"
}

// Study block (GET /uploads/{id}/study-blocks → study_blocks[])
interface StudyBlockRead {
  id: number
  upload_id: number
  course_id: number
  event_id: number
  title: string
  start_time: string           // ISO datetime
  end_time: string
  reason: string | null        // explanation for why this block was scheduled
  priority_score: number       // 0–100
  created_at: string
}

// User preferences (GET /preferences/latest)
interface UserPreferenceRead {
  id: number
  study_hours_per_day: number  // 0–12
  preferred_study_time: PreferredStudyTime
  intensity: PlanIntensity
  weekends_available: boolean
  minimum_reminder_days: number  // 0–30
  created_at: string
  updated_at: string | null
}
```

---

## COMPLETE API ROUTE MAP
(Source: /backend/routers/ — all prefixed `/api/v1`)

### /uploads

| Method | Path | Frontend trigger |
|--------|------|-----------------|
| POST | /uploads/upload-file | File drop in UploadZone. multipart/form-data, field: "file" |
| GET | /uploads/upload-status/{id} | Poll every 2s on processing page |
| POST | /uploads/parse-upload/{id} | Internal — called by extract pipeline |
| POST | /uploads/clean-upload/{id} | Internal — called by extract pipeline |
| POST | /uploads/{id}/extract | Immediately after upload success. One-shot full pipeline. |
| GET | /uploads/{id}/courses | Dashboard load, after extract |
| GET | /uploads/{id}/priority-scores | Dashboard load |
| GET | /uploads/{id}/conflicts | Dashboard load |
| POST | /uploads/{id}/schedule | "Regenerate Schedule" button |
| GET | /uploads/{id}/study-blocks | Dashboard load, after schedule |
| GET | /uploads/{id}/export.ics | window.location.href = this URL → browser auto-downloads |

### /courses

| Method | Path | Request body | Frontend trigger |
|--------|------|-------------|-----------------|
| PATCH | /courses/{id}/preferences | `{ priority_rank?: int≥1, difficulty?: int 1–3 }` | Drag-drop reorder OR star click. Returns CourseRead. 409 if rank taken. |
| POST | /courses/{id}/events | `{ title, type, date?, weight?, confidence?, source_text? }` | "Add Event" form. 409 if total weights exceed 100%. |

### /events

| Method | Path | Request body | Frontend trigger |
|--------|------|-------------|-----------------|
| PATCH | /events/{id} | `{ title?, type?, date?, weight?, confidence?, source_text? }` | Weight slider save in popover. At least one field required. 409 if weight exceeds 100%. |
| DELETE | /events/{id} | — | Delete button in event popover. Returns `{ deleted: true, event_id }` |

### /preferences

| Method | Path | Request body | Frontend trigger |
|--------|------|-------------|-----------------|
| POST | /preferences | `{ study_hours_per_day, preferred_study_time, intensity, weekends_available, minimum_reminder_days }` | "Save & Regenerate" in preferences panel |
| GET | /preferences/latest | — | Preferences panel load. 404 if none set yet. |

### /health
GET /api/v1/health → `{ status: "ok" }` — ping on app start.

---

## SCREEN 1 — UPLOAD PAGE (route: /)

Full viewport, no sidebar, centered vertically and horizontally.

**Top-left:** Logo — 32×32px rounded square with violet-to-cyan gradient background, ◈ symbol white, "planIT" Syne 800 22px next to it.

**Center content:**
- Headline line 1: "Drop your syllabus." — Syne 800 52px white, letter-spacing -1.5px
- Headline line 2: "Own your semester." — same size, violet-to-cyan gradient text fill
- Sub: "AI extracts every deadline, scores by priority, builds your study schedule." — JetBrains Mono 16px muted
- 40px gap
- **Upload dropzone** (480×200px, 14px radius, 2px dashed border rgba(255,255,255,0.12)):
  - Animated border: a glowing violet light traces the dashed border clockwise, one full revolution every 3s (CSS conic-gradient mask animation)
  - Inside: ☁ icon 32px violet, "Drag your PDF here" Syne 600 16px, "or click to browse · max 20MB" JetBrains Mono 12px muted
  - On hover: bg lifts to rgba(124,58,237,0.06), border brightens to rgba(124,58,237,0.4)
  - On file select: POST /uploads/upload-file (multipart/form-data, field "file")
  - On success response: store upload_id from response, navigate to /processing/[upload_id], immediately fire POST /uploads/[upload_id]/extract
  - On error (file > 20MB or non-PDF): shake animation on dropzone, red border flash, toast "⚠ Invalid file"
- 3 horizontal pill chips: "⚡ AI Priority Scoring" / "📅 Study Block Generator" / "📥 Export to .ICS"
  - Chip style: surface bg, subtle border, 12px JetBrains Mono muted text

---

## SCREEN 2 — PROCESSING PAGE (route: /processing/[uploadId])

Full viewport, no sidebar. Polls GET /uploads/upload-status/{uploadId} every 2 seconds.

**Center vertical stack:**

1. **Orbital spinner** — 3 concentric rings, each rotating at different speeds and directions:
   - Outer ring: 80px diameter, violet, rotates clockwise 4s
   - Middle ring: 55px, cyan, rotates counter-clockwise 2.5s
   - Inner ring: 30px, cobalt, rotates clockwise 1.5s
   Not a generic CSS spinner — these are SVG circles with stroke-dasharray creating a partial-arc look. Evokes a gyroscope.

2. **Status typewriter** — cycles through these messages in order, each with a blinking | cursor:
   - "Parsing PDF structure..." (shown when status = PROCESSING or UPLOADED)
   - "Extracting text content..." (shown briefly during PROCESSING)
   - "Identifying assessment dates..." (shown when status = CLEANED)
   - "Scoring deadlines by urgency..." (shown when has_extracted_text = true)
   - "Building your study schedule..." (shown when status = EXTRACTED or near end)
   JetBrains Mono 14px muted. Cursor blinks at 1s interval.

3. **Progress bar** (3px height, rounded, violet-to-cyan gradient fill):
   - Maps status to percentage: UPLOADED=10%, PROCESSING=30%, CLEANED=60%, EXTRACTED=100%
   - Smooth CSS transition on width change (800ms ease)
   - Subtle glow on the fill: box-shadow with cyan

4. **Metadata row:** "{original_filename} · {(file_size_bytes/1024/1024).toFixed(1)}MB · gpt-4o-mini"
   JetBrains Mono 11px muted

**State handlers:**
- status === "EXTRACTED": navigate to /dashboard/[uploadId] after 500ms delay
- status === "NEEDS_REVIEW": replace spinner with a red ⚠ icon. Show "Extraction needs review" Syne 700 18px red. Show "Try Again" button → POST /uploads/{uploadId}/extract again.
- Network error: show "Could not reach server" with retry button.

---

## SCREEN 3 — DASHBOARD (route: /dashboard/[uploadId])

Fixed left sidebar 220px + scrollable main content area.

### SIDEBAR

**Top (28px padding):**
- Logo (same as upload page)
- Vertical nav (14px Syne 600, 8px gap between items):
  - ◈ Dashboard
  - ⠿ Courses
  - ◷ Calendar
  - ⚡ Conflicts — right-aligned red badge showing `conflicts.length` from GET /conflicts. If 0, hide badge.
  - ↗ Export

Active nav item: violet-tinted bg rgba(124,58,237,0.12), violet left border accent 3px (partial height, rounded right), violet text #a78bfa.
Inactive: muted text, transparent bg. Hover: border rgba(255,255,255,0.07), bg rgba(255,255,255,0.02).

**Sidebar bottom:**
- Small text: "W26 · WEEK 9 OF 14" JetBrains Mono 11px muted (hardcoded for now)
- 3px progress bar: violet-to-cyan gradient, 63% fill representing semester week. Pulsing glow animation.

### MAIN HEADER

Left column:
- H1: "Mission Control" (Syne 800 28px letter-spacing -0.5px) + " — {course.semester ?? 'Semester'}" where semester uses violet-to-cyan gradient text
- Floating sparkles around "Mission Control": 3 tiny 4px dots (violet, cyan, pink) that float upward and fade, spawning from random positions every 400ms
- Metadata row: `upload_id: {uploadId} · {courses.length} courses · {totalEvents} deadlines extracted · gpt-4o-mini`
  JetBrains Mono 12px muted. totalEvents = sum of courses[n].events.length across all courses.

Right column (flex gap-3):
- "⚙ Preferences" ghost button → opens PreferencesPanel slide-in
- "📄 Export PDF" ghost button → triggers @react-pdf/renderer download
- "✦ Regenerate Schedule" violet primary button → POST /uploads/{uploadId}/schedule, on success: invalidate ['study-blocks', uploadId] and ['priority-scores', uploadId], animate calendar chips re-fill staggered, toast after 800ms: "✦ {study_blocks.length} study blocks scheduled"

### STAT ROW (4 equal cards, 14px gap)

All data is live from API. No hardcoding.

**Card 1 — Deadlines Tracked** (accent: violet #a78bfa)
- Value: sum of all `events.length` across all `courses[]` from GET /courses
- Label: "DEADLINES TRACKED"

**Card 2 — Study Blocks** (accent: cyan #67e8f9)
- Value: `study_blocks.length` from GET /study-blocks
- Label: "STUDY BLOCKS"

**Card 3 — Conflicts Found** (accent: red #fca5a5)
- Value: `conflicts.length` from GET /conflicts
- Label: "CONFLICTS FOUND"

**Card 4 — Avg Priority Score** (accent: emerald #6ee7b7)
- Value: `Math.round(scores.reduce((sum, s) => sum + s.priority_score, 0) / scores.length)` from GET /priority-scores. Show "—" if scores empty.
- Label: "AVG PRIORITY SCORE"

Each card:
- Dark surface bg, 1px border, 12px radius
- 1px top highlight: linear-gradient(90deg, transparent, {accent}80, transparent)
- Large number: JetBrains Mono 800 32px in accent color. Animate from 0 to final value on load (count-up, 1s ease-out).
- Label: 12px uppercase JetBrains Mono muted
- Hover: translateY(-2px), border brightens

### BENTO GRID

2-column CSS grid (1.2fr 1fr), 16px gap. Third row spans full width.

---

#### PANEL 1 (left column): COURSE PRIORITY BOARD

**Data source:** GET /uploads/{uploadId}/courses → `courses[]`

Panel header: "COURSE PRIORITY BOARD" 12px uppercase JetBrains Mono muted + 6px pulsing violet dot. Right: "Save Ranks" cyan link (manual save for all ranks at once).

**Sortable list using @dnd-kit/sortable.** Each course card:

Layout: `[drag-handle] [rank-badge] [course-info] [difficulty-stars] [score]`

- **Drag handle** ⋮⋮: muted color, `cursor: grab`, left-most
- **Rank badge** (22×22px rounded square):
  - rank 1: bg rgba(245,158,11,0.2) text #f59e0b border rgba(245,158,11,0.3)
  - rank 2: bg rgba(156,163,175,0.15) text #9ca3af border rgba(156,163,175,0.2)
  - rank 3: bg rgba(180,120,60,0.15) text #b07442 border rgba(180,120,60,0.2)
  - null or rank 4+: surface bg muted text
  - Shows `course.priority_rank ?? '—'`
- **Course info:**
  - `course.course_code` JetBrains Mono 13px bold
  - `course.course_name ?? 'Unnamed Course'` 11px muted below
- **Difficulty stars:** 3 star icons. `filled` (amber #f59e0b) for stars ≤ `course.difficulty`, `empty` (border color) for stars > difficulty. Null difficulty = all empty.
  - Click star index N → PATCH /courses/{course.id}/preferences `{ difficulty: N }` (N = 1, 2, or 3)
  - On success: invalidate ['courses', uploadId] and ['priority-scores', uploadId]
- **Priority score** (rightmost): find the max priority_score across all events for this course from GET /priority-scores, filter by course_id. Use score color mapping. JetBrains Mono 18px 800. Show "—" if no scores yet.

**Drag and drop behaviour:**
- Dragged card: `scale(1.03)`, elevated shadow, opacity 0.9
- Other cards animate with Framer Motion `layout` prop (spring physics)
- Drop → rebuild `priority_rank` for each course as its new 1-based index
- Fire PATCH /courses/{id}/preferences `{ priority_rank: newRank }` for every repositioned course
- 409 response (rank conflict): toast "⚠ Rank conflict — retry" and revert local state
- Success: toast "⠿ Priority order saved"

**Scan-line** shimmer sweeps this panel every 7s.

---

#### PANEL 2 (top right): CONFLICT RADAR

**Data sources:**
- GET /uploads/{uploadId}/conflicts → `conflicts[]`
- GET /uploads/{uploadId}/courses → all events (to resolve event_ids to titles)

Panel header: "CONFLICT RADAR" + pulsing red dot (1s pulse) + right-aligned badge showing count of `severity === 'high'` conflicts in red, `severity === 'medium'` in amber.

**200×200px SVG visualization (centered in panel):**

Geometry:
- 3 concentric ring guides at 30%, 55%, 80% radius: `stroke: rgba(255,255,255,0.04)` 1px
- 270° dashed arc representing semester timeline (Jan → Apr):
  `stroke: rgba(124,58,237,0.2)` 2px, `stroke-dasharray: 4 3`
  Start: 225° (top-left), sweep 270° clockwise to end at 315° (bottom-left)
- Axis guide lines through center: `rgba(255,255,255,0.04)` 1px

Event dot placement:
- For each event in all courses that has a date, calculate arc position:
  `position = (event.date - semesterStart) / (semesterEnd - semesterStart)`
  `angle = 225 + position * 270` (degrees)
  `x = cx + r * cos(angle * π/180)`, `y = cy + r * sin(angle * π/180)` where r=76, cx=cy=100
- Normal events (not in any conflict): 5px green dots (#10b981 opacity 0.8)
- Events referenced in `conflict.event_ids`:
  - severity "high" → 7px red dot (#ef4444)
  - severity "medium" → 6px amber dot (#f59e0b)
  - severity "low" → 6px cyan dot (#06b6d4)
- Conflict cluster backdrop: for each unique cluster of conflict event_ids, draw a circle centered at their average position:
  - r=18, `fill: rgba(239,68,68,0.06)`, `stroke: rgba(239,68,68,0.2)` 1px
  - Pulse animation: opacity 1→0.5→1 over 1.8s infinite, scale 1→1.15→1 over 2s infinite

"NOW" marker at today's position on the arc:
- Open circle r=4 `stroke: #a78bfa` `stroke-width: 1.5` no fill
- Solid inner dot r=2 fill #a78bfa
- "NOW" label 7px JetBrains Mono #a78bfa

Month labels at arc endpoints: "JAN" at 225°, "APR" at 135° (end of 270° sweep). 8px JetBrains Mono rgba(255,255,255,0.2).

**Hover interaction:**
- Any dot hover → glassmorphism tooltip (dark bg, blur, border rgba(255,255,255,0.15), 8px radius, 10–14px padding):
  - Title: event.title (looked up from courses data via event_id)
  - Conflict message: `conflict.message` (e.g. "3 deadlines within 48 hours")
  - Rule badge: `conflict.rule` (48_hour_window / same_week / high_weight_window) in JetBrains Mono 10px
  - Severity badge: colored per severity mapping
  - Date: `conflict.window_start` to `conflict.window_end`

**Legend row below SVG:**
`● Normal` (#10b981) / `● Conflict` (#ef4444) / `● High Weight` (#f59e0b) — 11px JetBrains Mono muted

---

#### PANEL 3 (bottom right): TOP PRIORITY EVENTS

**Data source:** GET /uploads/{uploadId}/priority-scores → `scores[]` sorted by priority_score desc, show top 4.

Panel header: "TOP PRIORITY EVENTS" + pulsing cyan dot.

Each row (clickable → opens EventEditPopover):

```
[event title + course tag]          [type badge] [score]
[────────────── stacked bar ──────────────────────────]
```

- **Left:** `score.title` 13px Syne 600 + `score.course_code` 10px JetBrains Mono muted tag inline.
  Date: `score.date` formatted "MMM D" on the right of the title row in 11px muted.
- **Right:** EventType badge (color per EventType mapping) + `score.priority_score` number (13px JetBrains Mono 800, color per score color mapping).
- **Warning icon:** if `score.warnings.length > 0`, show small amber ⚠ between badge and score. On hover, tooltip lists all warning strings.
- **Stacked bar** (5px height, 3px radius, full width):
  Segment widths derived from `score.components` — exact proportions from backend scoring:
  - Red segment: `(components.urgency / 35) * totalBarWidth` — max urgency is 35
  - Violet segment: `(components.course_priority / 20) * totalBarWidth` — max is 20
  - Cobalt segment: `(components.event_type / 10) * totalBarWidth` — max is 10
  - Amber segment: `(components.weight / 25) * totalBarWidth` — max is 25
  - If `components.confidence_adjustment < 0`, show a thin red-tinted negative segment on the right
  Bars animate left-to-right on load: start `width: 0`, transition to final width, `cubic-bezier(0.4,0,0.2,1)` 800ms. Stagger: 0ms, 100ms, 200ms, 300ms per row.
- **Reasons tooltip:** hover over score number → tooltip listing all `score.reasons` strings (e.g. "Due in 3 days", "Course is ranked highest priority", "Exam events receive extra priority")

---

#### PANEL 4 (full-width, bottom): STUDY CALENDAR

**Data sources:**
- GET /uploads/{uploadId}/study-blocks → `study_blocks[]`
- GET /uploads/{uploadId}/courses → all `events[]` for deadline chips

Panel header: "STUDY CALENDAR" + pulsing indigo dot. Right: legend chips — "📖 Study Block" cyan-tinted / "💀 Deadline" red-tinted / "📝 Exam" amber-tinted.

**Month navigation:** ← `{MonthName YYYY}` → (arrows change displayed month, no API call needed).

**7-column day grid:**
- Day headers: SUN MON TUE WED THU FRI SAT — 10px uppercase JetBrains Mono muted
- Day cells: min-height 64px. `border-top: 1px solid rgba(255,255,255,0.07)`. Date number top-left: 11px JetBrains Mono muted.
- Today cell: `background: rgba(124,58,237,0.05)`, date number bold violet #a78bfa.
- Other-month cells: date number at 25% opacity.

**Event chips per cell** (9px bold text, 3px radius, 2px left border):

Study blocks (from `study_blocks[]` where `start_time` date matches cell):
- `bg: rgba(37,99,235,0.25)`, text `#93c5fd`, left border `#2563eb`
- Text: `block.title` (already named by scheduler engine)
- Hover tooltip: `block.reason ?? 'Scheduled study session'` + `course_code` (look up via block.course_id) + `Priority: ${block.priority_score.toFixed(0)}`
- `start_time` and `end_time` are ISO datetimes — show time range "9:00 AM – 11:00 AM" in tooltip

Course event deadlines (from all `courses[].events[]` where `event.date` matches cell):
- `type === 'exam'`: bg `rgba(245,158,11,0.2)` text `#fcd34d` border `#f59e0b` prefix "📝"
- `type === 'assignment' | 'quiz' | 'lab' | 'other'`: bg `rgba(239,68,68,0.2)` text `#fca5a5` border `#ef4444` prefix "💀"
- `type === 'project'`: bg `rgba(124,58,237,0.2)` text `#a78bfa` border `#7c3aed` prefix "🎯"
- `event.is_user_edited === true`: append small "✏" icon after title
- `event.confidence !== null && event.confidence < 0.7`: append small amber "?" icon (low AI confidence)
- Click chip → open EventEditPopover for that event

**Conflict date wash:** for each ConflictRead, all cells between `conflict.window_start` and `conflict.window_end` get `background: rgba(239,68,68,0.04)` tint.

**Overflow:** max 2 chips visible per cell. If more, show `+{n} more` 9px muted below. Click → expand cell (all chips visible).

---

### EVENT EDIT POPOVER (modal)

**Trigger:** clicking a calendar chip or a priority score row.

**Backdrop:** `rgba(5,6,15,0.7)` + 8px backdrop blur. Click outside → close.

**Panel animation:** Framer Motion `scale: 0.9 → 1.0`, `y: 20 → 0`, `opacity: 0 → 1`, `cubic-bezier(0.34, 1.56, 0.64, 1)` 300ms.

**Panel** (380px wide, auto height, 16px radius, dark glassmorphism):

- **Top-right:** ✕ close button (28×28px surface style)
- **Type badge** (pill): EventType color mapping — shows `event.type.toUpperCase()`
- **Title:** `event.title` Syne 800 20px letter-spacing -0.3px
- **Sub-info:** `{course_code} · Due {event.date formatted as "MMM D, YYYY"}` OR `{course_code} · No date set` — JetBrains Mono 12px muted
- **Confidence warning:** if `event.confidence !== null && event.confidence < 0.7`:
  - `< 0.5`: show red "⚠ Very low AI confidence ({(confidence*100).toFixed(0)}%) — verify manually"
  - `0.5–0.7`: show amber "⚠ Medium-low confidence ({(confidence*100).toFixed(0)}%) — review recommended"
  JetBrains Mono 11px. From `_confidence_adjustment` in priority_scoring.py: <0.5 = -10pts, <0.7 = -5pts, so worth flagging.
- **"Grade Weight" label** (11px uppercase muted)
- **Weight display:** `{weight ?? '—'}%` JetBrains Mono 36px 800. Updates live as slider moves.
- **Range slider** (min=0, max=100, step=1, defaultValue=`event.weight ?? 0`):
  Custom styled: 4px track `rgba(255,255,255,0.08)`, 18px thumb with violet-to-cyan gradient + glow. Thumb `scale(1.2)` on hover.
  onChange → update weight display + recalculate live score below.
- **Live score estimate:**
  Client-side approximation of how the backend scores it:
  ```ts
  const weightComponent = newWeight >= 40 ? 25 : newWeight >= 25 ? 20 : newWeight >= 15 ? 14 : newWeight >= 5 ? 8 : newWeight > 0 ? 4 : 0
  const baseScore = (urgency + course_priority + difficulty + event_type + confidence_adjustment + reminder_window)
  const estimated = Math.min(100, Math.max(0, (baseScore + weightComponent) * intensity_multiplier))
  ```
  Where the other components come from `score.components` (passed into popover from priority scores data). This gives a real-time preview that matches backend logic.
  Display: "LIVE PRIORITY SCORE" label 11px uppercase muted. Score value: JetBrains Mono 28px 800, violet-to-cyan gradient text. Animate on change.
- **Actions (full width, side-by-side):**
  - "Cancel" ghost button → close popover, no API call
  - "Save Changes" violet primary → PATCH /events/{event.id} `{ weight: newWeight }`
    - 409 response: toast "⚠ Total weights would exceed 100% for {course_code}"
    - Success: close popover, invalidate ['courses', uploadId] + ['priority-scores', uploadId], toast "✓ Event updated · Scores recalculated"
- **"Delete Event" link** (small, red, bottom of popover): DELETE /events/{event.id}
  - Show confirm inline ("Are you sure?") before firing
  - On success: close popover, invalidate ['courses', uploadId] + ['priority-scores', uploadId] + ['conflicts', uploadId], toast "🗑 Event deleted"

---

### STUDY PREFERENCES PANEL (slide-in from right)

Triggered by "⚙ Preferences" button in header.
Framer Motion: `x: '100%' → 0`, spring 300ms. Semi-transparent overlay behind it.

On open: GET /preferences/latest to pre-fill form. If 404, use defaults from backend:
- study_hours_per_day: 2.0
- preferred_study_time: "flexible"
- intensity: "balanced"
- weekends_available: true
- minimum_reminder_days: 3

**Panel** (400px wide, full viewport height, right side, dark glassmorphism, 14px left radius only):

- Title: "Study Preferences" Syne 700 18px
- Sub: "Affects priority scoring and schedule generation" 12px muted

**Field 1 — Study hours per day**
Segmented control with options: 1h / 2h / 3h / 4h / 6h / 8h
Sends: `study_hours_per_day` as float. Active segment: violet tinted.
Note below: "Scheduler caps each session at 2h (or your daily limit, whichever is lower)" — from scheduler_engine.py `session_hours = min(2.0, max(0.5, daily_hours))`

**Field 2 — Preferred study time**
Segmented control — exactly these 5 options (enum values from PreferredStudyTime):
"Morning" (→ "morning") / "Afternoon" (→ "afternoon") / "Evening" (→ "evening") / "Night" (→ "night") / "Flexible" (→ "flexible")
Note below in 10px muted JetBrains Mono: "Morning = 9:00 AM start · Afternoon = 2:00 PM · Evening = 6:00 PM · Night = 8:00 PM"
(These are the exact PREFERRED_START_TIMES from scheduler_engine.py)

**Field 3 — Plan intensity**
3 options: "Light" / "Balanced" / "Intense"
Show multiplier annotation per option:
- Light → "0.9× score · 0.75× study hours" (from INTENSITY_MULTIPLIERS + INTENSITY_HOUR_MULTIPLIERS in scheduler)
- Balanced → "1.0× score · 1.0× study hours"
- Intense → "1.1× score · 1.35× study hours"

**Field 4 — Include weekends?**
Toggle switch. Label: "Include weekends in schedule"
If off: scheduler skips Saturday and Sunday when placing study blocks.

**Field 5 — Reminder window (days)**
Horizontal slider, min=0, max=30, step=1. Value shown as "{n} days before deadline"
Note in 10px muted: "Events within this window get +8 bonus score points" (from _reminder_score in priority_scoring.py: `return 8` when within window)

**Actions (at bottom, stacked):**
- "Save & Regenerate" violet primary (full width):
  1. POST /preferences with all values
  2. On success: POST /uploads/{uploadId}/schedule
  3. On schedule success: invalidate ['study-blocks', uploadId] + ['priority-scores', uploadId]
  4. Close panel. Toast: "✓ Preferences saved · Schedule regenerated"
- "Close" ghost button (full width below)

---

### EXPORT STRIP (below bento grid)

Full-width horizontal bar, surface bg, 12px radius, 20px padding.

Left: 📦 + text column:
- "Ready to export your schedule" Syne 700 14px
- "{study_blocks.length} study blocks · {totalEvents} deadlines · {course.semester ?? 'Semester'}" 12px muted

Right — two buttons:
**"📅 Export .ICS" cyan-tinted button:**
onClick: `window.location.href = '/api/v1/uploads/{uploadId}/export.ics'`
The backend returns `Content-Disposition: attachment; filename="planit-upload-{id}.ics"` — the browser handles the download automatically. Zero JS libraries needed.
Toast: "📅 Calendar exported" on click (toast fires immediately, download happens in background).

**"📄 Print PDF" red-tinted button:**
Uses @react-pdf/renderer PDFDownloadLink. PDF document structure:
- Cover page: planIT logo, course list (code + name), semester, export date
- Page per course: course header, table of events (title / type / date / weight / priority_score)
- Final page: week-by-week table of study blocks (start_time / end_time / title / reason)
All data sourced from live query cache (courses + study_blocks + priority-scores).

---

## FULL INTERACTION SPEC

**Page load stagger (Framer Motion, animation-delay):**
1. Sidebar: 0ms
2. Header: 50ms
3. Stat row: 120ms
4. Bento Panel 1 (Course Board): 190ms
5. Bento Panel 2 (Conflict Radar): 260ms
6. Bento Panel 3 (Priority Scores): 330ms
7. Bento Panel 4 (Calendar): 400ms
8. Export strip: 470ms

After panels: score bar segments animate in staggered. Stat numbers count up from 0 using number ticker.

**Boot toast:** 500ms after dashboard load: "🛸 planIT loaded · {uploadId} · {courses.length} courses" violet-tinted.

**Drag and drop (course board):**
- `@dnd-kit/sortable` with `verticalListSortingStrategy`
- Framer Motion `layout` prop on each card for spring-physics reflow
- Dragging: `scale(1.03)` + `box-shadow: 0 20px 60px rgba(0,0,0,0.5)`
- Target drop slot: violet border + rgba(124,58,237,0.08) bg
- On drop: optimistically update local order, fire PATCH for each moved card sequentially

**Score bars:**
- Initial: `width: 0`
- On mount: transition to computed width, `cubic-bezier(0.4,0,0.2,1)` 800ms
- Row stagger: 0/100/200/300ms

**Conflict radar:**
- Conflict cluster pulse: opacity 1→0.5→1 infinite 1.8s, scale 1→1.15→1 infinite 2s
- Red/amber dot hover: `r` attribute grows from 5→8 on hover via CSS transition
- Tooltip: Framer Motion `scale: 0.9→1, opacity: 0→1` spring on appear

**Regenerate schedule:**
- Button click: inner content swaps to spinner for 300ms while request fires
- Calendar chips: all existing chips fade out (opacity 0, stagger 20ms)
- New chips fade in one by one (opacity 0→1, stagger 40ms per chip)
- Toast after 800ms: "✦ {n} study blocks scheduled" emerald

**Toast system (bottom-right corner, stacked, max 3 visible):**
- Appear: `scale(0.9) + translateY(20px) → scale(1) + translateY(0)`, spring cubic-bezier(0.34,1.56,0.64,1) 350ms
- Auto-dismiss: after 2.8s, fade + `translateY(10px)` exit
- Gap between toasts: 8px
- Border accent: success=emerald, error=red, info=violet, warning=amber
- Icon + message in Syne 600 13px

---

## ERROR STATES

Every panel that hits an API error shows a minimal inline error state (not a full-page error):
- Small red text: "Could not load {data name}" 12px muted
- "Retry" link in cyan that re-fires the query
- Never crash the whole dashboard — panels are independent.

Weight validation errors (409 from PATCH /events or POST /courses/{id}/events):
- Toast: "⚠ Total weights for {course_code} would reach {projected_total}% — exceeds 100%"
- Popover stays open, slider reverts to previous value

Priority rank conflicts (409 from PATCH /courses/{id}/preferences):
- Toast: "⚠ Priority rank {N} is already taken — reorder and try again"
- Drag reverts to previous order via optimistic rollback

---

## RESPONSIVE

**≤ 1200px:** bento collapses to single column. Sidebar stays.
**≤ 768px:** sidebar becomes bottom tab bar (icons only). Stat cards horizontal scroll. Calendar → weekly list view. Bento panels stack vertically.
**≤ 480px:** popover becomes bottom sheet (slides up from bottom). Header collapses to icon buttons only.

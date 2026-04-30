"use client";

import { useMemo, useState } from "react";

import type { CourseRead, PriorityScoreRead, StudyBlockRead } from "@/lib/types";

interface TimelineViewProps {
  courses: CourseRead[];
  studyBlocks: StudyBlockRead[];
  priorityScores?: PriorityScoreRead[];
}

type CalendarEntry = {
  dateKey: string;
  label: string;
  tone: "study" | "deadline" | "exam";
  headline: string;
  sublabel: string;
  meta: string[];
  detail?: string | null;
  priorityScore?: number | null;
  priorityReasons?: string[];
  kind: "event" | "study";
};

function buildMonthMatrix(anchor: Date) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstDay = new Date(monthStart);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    return day;
  });
}

export function TimelineView({ courses, studyBlocks, priorityScores = [] }: TimelineViewProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEntry | null>(null);

  const eventEntries = useMemo<CalendarEntry[]>(() => {
    const scoreByEventId = new Map(priorityScores.map((score) => [score.event_id, score]));
    const entries: CalendarEntry[] = [];

    for (const course of courses) {
      for (const event of course.events) {
        if (!event.date) continue;
        const score = scoreByEventId.get(event.id);
        entries.push({
          dateKey: event.date,
          label: `${course.course_code}: ${event.title}`,
          tone: event.type === "exam" ? "exam" : "deadline",
          headline: event.title,
          sublabel: course.course_code,
          meta: [
            event.type.toUpperCase(),
            event.weight != null ? `${event.weight}% weight` : "Weight n/a",
            event.confidence != null ? `${Math.round(event.confidence * 100)}% confidence` : "Confidence n/a",
            score ? `Priority ${score.priority_score.toFixed(1)}` : "Priority pending",
          ],
          detail: event.source_text,
          priorityScore: score?.priority_score ?? null,
          priorityReasons: score?.reasons ?? [],
          kind: "event",
        });
      }
    }

    for (const block of studyBlocks) {
      const start = new Date(block.start_time);
      entries.push({
        dateKey: start.toISOString().slice(0, 10),
        label: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} · ${block.title}`,
        tone: "study",
        headline: block.title,
        sublabel: "Study block",
        meta: [
          `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(block.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          `Priority ${block.priority_score.toFixed(1)}`,
        ],
        detail: block.reason,
        priorityScore: block.priority_score,
        priorityReasons: block.reason ? [block.reason] : [],
        kind: "study",
      });
    }

    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.label.localeCompare(b.label));
    return entries;
  }, [courses, priorityScores, studyBlocks]);

  const anchorDate = useMemo(() => {
    const base = eventEntries[0]?.dateKey ? new Date(`${eventEntries[0].dateKey}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth() + monthOffset, 1, 12);
  }, [eventEntries, monthOffset]);
  const days = buildMonthMatrix(anchorDate);
  const selectedEntries = selectedDateKey ? eventEntries.filter((entry) => entry.dateKey === selectedDateKey) : [];
  const selectedDateLabel = selectedDateKey
    ? new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const palette = {
    study: { background: "rgba(6,182,212,0.14)", color: "#67e8f9", border: "rgba(6,182,212,0.4)" },
    deadline: { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "rgba(239,68,68,0.4)" },
    exam: { background: "rgba(245,158,11,0.15)", color: "#fcd34d", border: "rgba(245,158,11,0.4)" },
  } as const;

  return (
    <div className="panel section-panel">
      {selectedEvent ? (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-card calendar-modal glass-card" onClick={(event) => event.stopPropagation()}>
            <div className="calendar-detail-header">
              <div>
                <div className="mono muted" style={{ fontSize: "0.74rem" }}>
                  {selectedEvent.kind === "study" ? "Study block detail" : "Deadline detail"}
                </div>
                <div className="calendar-detail-title" style={{ marginTop: "0.45rem" }}>
                  {selectedEvent.headline}
                </div>
                <div className="mono muted" style={{ marginTop: "0.35rem", fontSize: "0.75rem" }}>
                  {selectedEvent.sublabel} · {new Date(`${selectedEvent.dateKey}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
              <button className="icon-button mono" type="button" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>

            <div className="calendar-detail-meta" style={{ marginTop: "1rem" }}>
              {selectedEvent.meta.map((item) => (
                <span key={item} className="calendar-detail-meta-item">{item}</span>
              ))}
            </div>

            {selectedEvent.priorityReasons?.length ? (
              <div style={{ marginTop: "1rem" }}>
                <div className="mono muted" style={{ fontSize: "0.72rem", marginBottom: "0.55rem" }}>
                  Priority reasoning
                </div>
                <div className="stack">
                  {selectedEvent.priorityReasons.map((reason) => (
                    <div key={reason} className="calendar-detail-description" style={{ marginTop: 0 }}>
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedEvent.detail ? (
              <div style={{ marginTop: "1rem" }}>
                <div className="mono muted" style={{ fontSize: "0.72rem", marginBottom: "0.55rem" }}>
                  Source detail
                </div>
                <div className="calendar-detail-description" style={{ marginTop: 0 }}>
                  {selectedEvent.detail}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="section-header">
        <div>
          <h2 className="display" style={{ margin: 0 }}>Mission Calendar</h2>
          <div className="eyebrow" style={{ marginTop: "0.45rem" }}>
            Synchronization online // {anchorDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="action-row">
          <button className="icon-button mono" onClick={() => setMonthOffset((current) => current - 1)}>Prev</button>
          <button className="icon-button mono" onClick={() => setMonthOffset(0)}>Today</button>
          <button className="icon-button mono" onClick={() => setMonthOffset((current) => current + 1)}>Next</button>
        </div>
      </div>

      <div className="legend" style={{ marginBottom: "0.9rem" }}>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#2563eb" }} /> Study</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#fca5a5" }} /> Deadline</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: "#fcd34d" }} /> Exam</span>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div key={weekday} className="calendar-cell" style={{ minHeight: "unset", padding: "0.8rem", color: "var(--muted)" }}>
            <span className="mono">{weekday}</span>
          </div>
        ))}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const entries = eventEntries.filter((entry) => entry.dateKey === key);
          const mutedCell = day.getMonth() !== anchorDate.getMonth();

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              className={`calendar-cell ${mutedCell ? "muted-cell" : ""} ${selectedDateKey === key ? "selected-cell" : ""}`}
              onClick={() => setSelectedDateKey(key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedDateKey(key);
                }
              }}
            >
              <div className="mono" style={{ marginBottom: "0.25rem" }}>{day.getDate()}</div>
              {entries.slice(0, 3).map((entry, index) => (
                <button
                  key={`${entry.label}-${index}`}
                  type="button"
                  className="calendar-chip"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEvent(entry);
                  }}
                  style={{
                    background: palette[entry.tone].background,
                    color: palette[entry.tone].color,
                    border: `1px solid ${palette[entry.tone].border}`,
                  }}
                  title={entry.label}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="glass-card" style={{ marginTop: "1rem", padding: "1rem" }}>
        <div className="calendar-detail-header">
          <div>
            <div className="mono muted" style={{ fontSize: "0.74rem" }}>
              {selectedDateKey ? "Selected mission day" : "Event inspection panel"}
            </div>
            <div className="calendar-detail-title">
              {selectedDateLabel ?? "Select a day to inspect the event stack"}
            </div>
          </div>
          {selectedEntries.length ? (
            <div className="tag">{selectedEntries.length} item{selectedEntries.length === 1 ? "" : "s"}</div>
          ) : null}
        </div>
        <div className="stack" style={{ marginTop: "0.7rem" }}>
          {selectedEntries.length ? selectedEntries.map((entry, index) => (
            <article key={`${entry.label}-${index}`} className={`calendar-detail-card ${entry.tone}`}>
              <div className="calendar-detail-topline">
                <span className={`calendar-detail-pill ${entry.tone}`}>{entry.tone}</span>
                <span className="mono muted" style={{ fontSize: "0.72rem" }}>{entry.sublabel}</span>
              </div>
              <div className="calendar-detail-headline">{entry.headline}</div>
              <div className="calendar-detail-meta">
                {entry.meta.map((item) => (
                  <span key={item} className="calendar-detail-meta-item">{item}</span>
                ))}
              </div>
              {entry.detail ? (
                <div className="calendar-detail-description">{entry.detail}</div>
              ) : null}
            </article>
          )) : (
            <div className="muted">No scheduled items on this date.</div>
          )}
        </div>
      </div>
    </div>
  );
}

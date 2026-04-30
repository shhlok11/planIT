"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import type { CourseEventCreate, CourseRead, EventType, PriorityScoreRead } from "@/lib/types";

interface DeadlineTableProps {
  courses: CourseRead[];
  priorityScores: PriorityScoreRead[];
  onUpdateEvent: (eventId: number, payload: {
    title?: string;
    type?: EventType;
    date?: string | null;
    weight?: number | null;
    source_text?: string | null;
  }) => Promise<void>;
  onDeleteEvent: (eventId: number) => Promise<void>;
  onCreateEvent: (courseId: number, payload: CourseEventCreate) => Promise<void>;
  onUpdateCourse: (courseId: number, payload: { priority_rank?: number; difficulty?: number }) => Promise<void>;
  onSwapCoursePriority: (courseId: number, direction: "up" | "down") => Promise<void>;
}

const eventTypes: EventType[] = ["assignment", "exam", "quiz", "lab", "project", "other"];

const eventTypeColors: Record<EventType, { bg: string; color: string; border: string }> = {
  exam: { bg: "rgba(245,158,11,0.15)", color: "#fcd34d", border: "rgba(245,158,11,0.25)" },
  assignment: { bg: "rgba(6,182,212,0.15)", color: "#67e8f9", border: "rgba(6,182,212,0.25)" },
  project: { bg: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "rgba(124,58,237,0.25)" },
  quiz: { bg: "rgba(37,99,235,0.15)", color: "#93c5fd", border: "rgba(37,99,235,0.25)" },
  lab: { bg: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "rgba(16,185,129,0.25)" },
  other: { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.25)" },
};

export function DeadlineTable({
  courses,
  priorityScores,
  onUpdateEvent,
  onDeleteEvent,
  onCreateEvent,
  onUpdateCourse,
  onSwapCoursePriority,
}: DeadlineTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { title: string; type: EventType; date: string; weight: string; source_text: string }>>({});
  const [newEventCourseId, setNewEventCourseId] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState<CourseEventCreate>({
    title: "",
    type: "assignment",
    date: "",
    weight: null,
    confidence: 1,
    source_text: "Manually added by user",
  });
  const [actionError, setActionError] = useState<string | null>(null);

  const scoreMap = useMemo(
    () => new Map(priorityScores.map((score) => [score.event_id, score])),
    [priorityScores],
  );
  const orderedCourses = useMemo(
    () => [...courses].sort((a, b) => (a.priority_rank ?? Number.MAX_SAFE_INTEGER) - (b.priority_rank ?? Number.MAX_SAFE_INTEGER) || a.id - b.id),
    [courses],
  );

  useEffect(() => {
    if (!newEventCourseId && orderedCourses[0]) {
      setNewEventCourseId(orderedCourses[0].id);
    }
  }, [newEventCourseId, orderedCourses]);

  return (
    <div className="stack">
      <section className="panel section-panel">
        <div className="section-header">
          <div>
            <h3 className="display" style={{ margin: 0, fontSize: "2rem" }}>Add Missing Event</h3>
            <div className="muted">Manual review path for deadlines the extractor missed.</div>
          </div>
        </div>
        {actionError ? <div className="error-banner">{actionError}</div> : null}
        <div className="grid-two">
          <div className="field-group">
            <label>Course</label>
            <select
              className="field"
              value={newEventCourseId ?? ""}
              onChange={(event) => setNewEventCourseId(Number(event.target.value))}
            >
              {orderedCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} · {course.course_name ?? "Untitled"}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Type</label>
            <select
              className="field"
              value={newEvent.type}
              onChange={(event) => setNewEvent((current) => ({ ...current, type: event.target.value as EventType }))}
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Title</label>
            <input
              className="field"
              value={newEvent.title}
              onChange={(event) => setNewEvent((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="field-group">
            <label>Date</label>
            <input
              className="field"
              type="date"
              value={newEvent.date ?? ""}
              onChange={(event) => setNewEvent((current) => ({ ...current, date: event.target.value }))}
            />
          </div>
          <div className="field-group">
            <label>Weight</label>
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              value={newEvent.weight ?? ""}
              onChange={(event) => setNewEvent((current) => ({
                ...current,
                weight: event.target.value ? Number(event.target.value) : null,
              }))}
            />
          </div>
          <div className="field-group">
            <label>Source Text</label>
            <input
              className="field"
              value={newEvent.source_text ?? ""}
              onChange={(event) => setNewEvent((current) => ({ ...current, source_text: event.target.value }))}
            />
          </div>
        </div>
        <div className="action-row" style={{ marginTop: "1rem" }}>
          <button
            className="cta-primary mono"
            onClick={async () => {
              if (!newEventCourseId) return;
              try {
                setActionError(null);
                await onCreateEvent(newEventCourseId, {
                  ...newEvent,
                  date: newEvent.date || null,
                  source_text: newEvent.source_text || null,
                });
                setNewEvent({
                  title: "",
                  type: "assignment",
                  date: "",
                  weight: null,
                  confidence: 1,
                  source_text: "Manually added by user",
                });
              } catch (err) {
                setActionError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to create event");
              }
            }}
          >
            Add Event
          </button>
        </div>
      </section>

      {orderedCourses.map((course, index) => (
        <section key={course.id} className="panel section-panel">
          {actionError ? <div className="error-banner">{actionError}</div> : null}
          <div className="section-header">
            <div>
              <h3 className="display" style={{ margin: 0, fontSize: "2rem" }}>
                {course.course_code}
              </h3>
              <div className="muted">{course.course_name || "Untitled course"} {course.semester ? `· ${course.semester}` : ""}</div>
            </div>
            <div className="inline-grid" style={{ width: "min(360px, 100%)" }}>
              <div className="field-group">
                <label>Priority Rank</label>
                <div className="action-row">
                  <button
                    className="icon-button mono"
                    disabled={index === 0}
                    onClick={async () => {
                      try {
                        setActionError(null);
                        await onSwapCoursePriority(course.id, "up");
                      } catch (err) {
                        setActionError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to update course priority");
                      }
                    }}
                  >
                    Move Up
                  </button>
                  <button
                    className="icon-button mono"
                    disabled={index === orderedCourses.length - 1}
                    onClick={async () => {
                      try {
                        setActionError(null);
                        await onSwapCoursePriority(course.id, "down");
                      } catch (err) {
                        setActionError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to update course priority");
                      }
                    }}
                  >
                    Move Down
                  </button>
                </div>
                <div className="mono muted" style={{ fontSize: "0.78rem" }}>
                  rank {course.priority_rank ?? index + 1}
                </div>
              </div>
              <div className="field-group">
                <label>Difficulty (1-3)</label>
                <select
                  className="field"
                  value={course.difficulty ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    void onUpdateCourse(course.id, {
                      difficulty: value ? Number(value) : undefined,
                    });
                  }}
                >
                  <option value="">Unset</option>
                  <option value="1">1 · Low</option>
                  <option value="2">2 · Medium</option>
                  <option value="3">3 · Hard</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {course.events.map((event) => {
                  const score = scoreMap.get(event.id);
                  const isEditing = editingId === event.id;
                  const draft = drafts[event.id] ?? {
                    title: event.title,
                    type: event.type,
                    date: event.date ?? "",
                    weight: event.weight?.toString() ?? "",
                    source_text: event.source_text ?? "",
                  };
                  const typeStyles = eventTypeColors[isEditing ? draft.type : event.type];

                  return (
                    <tr key={event.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="field"
                            value={draft.title}
                            onChange={(eventTarget) => {
                              setDrafts((current) => ({
                                ...current,
                                [event.id]: { ...draft, title: eventTarget.target.value },
                              }));
                            }}
                          />
                        ) : (
                          <div>
                            <div>{event.title}</div>
                            <div className="mono muted" style={{ fontSize: "0.76rem" }}>
                              #{event.id} {event.is_user_edited ? "· edited" : ""}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="field"
                            value={draft.type}
                            onChange={(eventTarget) => {
                              setDrafts((current) => ({
                                ...current,
                                [event.id]: { ...draft, type: eventTarget.target.value as EventType },
                              }));
                            }}
                          >
                            {eventTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="tag" style={{ background: typeStyles.bg, color: typeStyles.color, borderColor: typeStyles.border }}>
                            {event.type}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="field"
                            type="date"
                            value={draft.date}
                            onChange={(eventTarget) => {
                              setDrafts((current) => ({
                                ...current,
                                [event.id]: { ...draft, date: eventTarget.target.value },
                              }));
                            }}
                          />
                        ) : (
                          <span className="mono">{event.date ?? "TBD"}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="field"
                            type="number"
                            min={0}
                            max={100}
                            value={draft.weight}
                            onChange={(eventTarget) => {
                              setDrafts((current) => ({
                                ...current,
                                [event.id]: { ...draft, weight: eventTarget.target.value },
                              }));
                            }}
                          />
                        ) : (
                          <span className="mono">{event.weight != null ? `${event.weight}%` : "n/a"}</span>
                        )}
                      </td>
                      <td>
                        <div className="mono" style={{ color: score?.priority_score && score.priority_score >= 75 ? "#fcd34d" : "var(--text)" }}>
                          {score ? score.priority_score.toFixed(1) : "—"}
                        </div>
                      </td>
                      <td>
                        <div className="action-row">
                          {isEditing ? (
                            <>
                              <button
                                className="icon-button mono"
                                onClick={async () => {
                                  try {
                                    setActionError(null);
                                    await onUpdateEvent(event.id, {
                                      title: draft.title,
                                      type: draft.type,
                                      date: draft.date || null,
                                      weight: draft.weight ? Number(draft.weight) : null,
                                      source_text: draft.source_text || null,
                                    });
                                    setEditingId(null);
                                  } catch (err) {
                                    setActionError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to update event");
                                  }
                                }}
                              >
                                Save
                              </button>
                              <button className="icon-button mono" onClick={() => setEditingId(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-button mono"
                                onClick={() => {
                                  setActionError(null);
                                  setDrafts((current) => ({
                                    ...current,
                                    [event.id]: {
                                      title: event.title,
                                      type: event.type,
                                      date: event.date ?? "",
                                      weight: event.weight?.toString() ?? "",
                                      source_text: event.source_text ?? "",
                                    },
                                  }));
                                  setEditingId(event.id);
                                }}
                              >
                                Edit
                              </button>
                              <button className="icon-button mono" onClick={async () => {
                                try {
                                  setActionError(null);
                                  await onDeleteEvent(event.id);
                                } catch (err) {
                                  setActionError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to delete event");
                                }
                              }}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

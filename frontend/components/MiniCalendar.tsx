"use client";

import { useMemo } from "react";

import type { CourseRead, StudyBlockRead } from "@/lib/types";

interface MiniCalendarProps {
  courses: CourseRead[];
  studyBlocks: StudyBlockRead[];
}

function monthMatrix(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function MiniCalendar({ courses, studyBlocks }: MiniCalendarProps) {
  const entries = useMemo<Array<{ dateKey: string; tone: "study" | "deadline" | "exam" }>>(() => {
    const deadlineEntries = courses.flatMap((course) =>
      course.events
        .filter((event) => event.date)
        .map((event) => ({
          dateKey: event.date as string,
          tone: (event.type === "exam" ? "exam" : "deadline") as "exam" | "deadline",
        })),
    );
    const studyEntries = studyBlocks.map((block) => ({
      dateKey: new Date(block.start_time).toISOString().slice(0, 10),
      tone: "study" as const,
    }));
    return [...deadlineEntries, ...studyEntries].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [courses, studyBlocks]);

  const anchor = entries[0]?.dateKey ? new Date(`${entries[0].dateKey}T12:00:00`) : new Date();
  const days = monthMatrix(anchor);

  const colorMap = {
    study: "#2563eb",
    deadline: "#fca5a5",
    exam: "#c4b5fd",
  } as const;

  return (
    <div className="calendar-grid" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div key={weekday} className="calendar-cell" style={{ minHeight: "unset", padding: "0.8rem", color: "var(--muted)" }}>
            <span className="mono">{weekday}</span>
          </div>
        ))}
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayEntries = entries.filter((entry) => entry.dateKey === key);
          return (
            <div key={key} className={`calendar-cell ${day.getMonth() !== anchor.getMonth() ? "muted-cell" : ""}`} style={{ minHeight: 112 }}>
              <div className="mono">{day.getDate()}</div>
              <div style={{ display: "grid", gap: "0.38rem", marginTop: "0.5rem" }}>
                {dayEntries.slice(0, 2).map((entry, index) => (
                  <div
                    key={`${key}-${entry.tone}-${index}`}
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: colorMap[entry.tone],
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import type { ConflictRead, CourseRead } from "@/lib/types";

interface ConflictRadarProps {
  courses: CourseRead[];
  conflicts: ConflictRead[];
}

type RadarPoint = {
  id: number;
  courseCode: string;
  title: string;
  date: Date;
  angleDeg: number;
  severity: "high" | "medium" | "low" | null;
};

const severityColor = {
  high: "#fca5a5",
  medium: "#fcd34d",
  low: "#67e8f9",
} as const;

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function ConflictRadar({ courses, conflicts }: ConflictRadarProps) {
  const [hovered, setHovered] = useState<RadarPoint | null>(null);

  const points = useMemo<RadarPoint[]>(() => {
    const events = courses.flatMap((course) =>
      course.events
        .filter((event) => event.date)
        .map((event) => ({
          id: event.id,
          courseCode: course.course_code,
          title: event.title,
          date: new Date(`${event.date}T12:00:00`),
        })),
    );

    if (!events.length) return [];

    const min = Math.min(...events.map((event) => event.date.getTime()));
    const max = Math.max(...events.map((event) => event.date.getTime()));
    const span = Math.max(1, max - min);

    return events.map((event) => {
      const progress = (event.date.getTime() - min) / span;
      const angleDeg = -135 + progress * 270;
      const conflict = conflicts.find((item) => item.event_ids.includes(event.id));
      return {
        ...event,
        angleDeg,
        severity: conflict?.severity ?? null,
      };
    });
  }, [conflicts, courses]);

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 106;
  const arcStart = -135;
  const arcEnd = 135;
  const arcPath = describeArc(cx, cy, radius, arcStart, arcEnd);

  return (
      <div style={{ position: "relative", display: "grid", justifyItems: "center", gap: "0.9rem", minHeight: 360 }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 360, height: "auto" }}>
          {[56, 82, 106, 132].map((ring) => (
            <path
              key={ring}
              d={describeArc(cx, cy, ring, arcStart, arcEnd)}
              fill="none"
              stroke="rgba(6,182,212,0.16)"
              strokeDasharray={ring === 132 ? "6 8" : undefined}
            />
          ))}

          <path d={arcPath} fill="none" stroke="rgba(6,182,212,0.26)" strokeWidth={2} />

          <circle cx={cx} cy={cy} r={34} fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.26)" />

          {points.map((point) => {
            const pos = polar(cx, cy, radius, point.angleDeg);
            const color = point.severity ? severityColor[point.severity] : "#60a5fa";
            return (
              <g
                key={point.id}
                onMouseEnter={() => setHovered(point)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {point.severity ? (
                  <circle cx={pos.x} cy={pos.y} r={13} fill={color} opacity={0.14} />
                ) : null}
                <circle cx={pos.x} cy={pos.y} r={hovered?.id === point.id ? 6 : 4} fill={color} stroke="white" strokeOpacity={hovered?.id === point.id ? 0.8 : 0} />
              </g>
            );
          })}

          <text x={cx} y={18} textAnchor="middle" className="mono" fill="#67e8f9" style={{ fontSize: 10 }}>
            NOW
          </text>
        </svg>

        <div className="glass-card" style={{ width: "min(320px, 100%)", padding: "0.9rem 1rem" }}>
          {hovered ? (
            <>
              <div className="mono muted" style={{ fontSize: "0.7rem" }}>{hovered.courseCode}</div>
              <div style={{ fontSize: "1rem", marginTop: "0.35rem" }}>{hovered.title}</div>
              <div className="mono" style={{ marginTop: "0.45rem", color: hovered.severity ? severityColor[hovered.severity] : "#67e8f9" }}>
                {hovered.date.toLocaleDateString()} {hovered.severity ? `· ${hovered.severity}` : "· stable"}
              </div>
            </>
          ) : (
            <div className="mono muted" style={{ lineHeight: 1.7 }}>
              Hover a deadline signal to inspect severity and date.
            </div>
          )}
        </div>
      </div>
  );
}

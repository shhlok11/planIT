"use client";

import { useMemo, useState } from "react";

import type { CourseRead, PriorityScoreRead } from "@/lib/types";

interface DeadlineGravityFieldProps {
  courses: CourseRead[];
  priorityScores: PriorityScoreRead[];
}

type GravityNode = {
  id: number;
  title: string;
  courseCode: string;
  type: string;
  dateLabel: string;
  x: number;
  y: number;
  radius: number;
  strength: number;
  color: string;
  weightLabel: string;
  priorityLabel: string;
  confidenceLabel: string;
  sourceText: string | null;
};

type PressureSample = {
  x: number;
  y: number;
  label: string;
  intensity: number;
};

const NODE_COLORS = {
  exam: "#fcd34d",
  assignment: "#fca5a5",
  project: "#c4b5fd",
  quiz: "#67e8f9",
  lab: "#6ee7b7",
  other: "#94a3b8",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function DeadlineGravityField({ courses, priorityScores }: DeadlineGravityFieldProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const plotLeft = 118;
  const plotRight = 930;
  const plotBottom = 430;
  const laneGap = courses.length > 4 ? 56 : 68;
  const laneTop = 92;

  const field = useMemo(() => {
    const datedEvents = courses.flatMap((course) =>
      course.events
        .filter((event) => event.date)
        .map((event) => ({
          course,
          event,
          score: priorityScores.find((item) => item.event_id === event.id) ?? null,
          dateValue: new Date(`${event.date}T12:00:00`),
        })),
    );

    if (!datedEvents.length) {
      return {
        nodes: [] as GravityNode[],
        wavePath: "",
        waveAreaPath: "",
        samples: [] as PressureSample[],
        spanLabel: "No dated events",
      };
    }

    const minTime = Math.min(...datedEvents.map((item) => item.dateValue.getTime()));
    const maxTime = Math.max(...datedEvents.map((item) => item.dateValue.getTime()));
    const span = Math.max(1, maxTime - minTime);
    const topY = laneTop;
    const leftX = plotLeft;
    const rightX = plotRight;

    const laneByCourseId = new Map(
      courses.map((course, index) => [course.id, topY + index * laneGap]),
    );

    const nodes: GravityNode[] = datedEvents.map(({ course, event, score }, index) => {
      const progress = (new Date(`${event.date}T12:00:00`).getTime() - minTime) / span;
      const weight = event.weight ?? 6;
      const priority = score?.priority_score ?? 42;
      const strength = clamp(weight * 0.9 + priority * 0.28, 12, 68);
      const radius = clamp(6 + weight / 4.2, 6, 18);
      const baseY = laneByCourseId.get(course.id) ?? topY;
      const wobble = Math.sin((index + 1) * 0.92) * 6;
      const eventType = (event.type ?? "other") as keyof typeof NODE_COLORS;
      return {
        id: event.id,
        title: event.title,
        courseCode: course.course_code,
        type: event.type,
        dateLabel: formatDateLabel(event.date as string),
        x: leftX + progress * (rightX - leftX),
        y: baseY + wobble,
        radius,
        strength,
        color: NODE_COLORS[eventType] ?? NODE_COLORS.other,
        weightLabel: event.weight != null ? `${event.weight}% weight` : "Weight n/a",
        priorityLabel: score ? `Priority ${score.priority_score.toFixed(1)}` : "Priority pending",
        confidenceLabel:
          event.confidence != null ? `${Math.round(event.confidence * 100)}% confidence` : "Confidence n/a",
        sourceText: event.source_text,
      };
    });

    const sampleCount = 9;
    const samples: PressureSample[] = Array.from({ length: sampleCount }, (_, index) => {
      const progress = index / (sampleCount - 1);
      const sampleTime = minTime + progress * span;
      const x = leftX + progress * (rightX - leftX);
      const nearby = nodes.filter((node) => {
        const nodeProgress = (node.x - leftX) / (rightX - leftX);
        const nodeTime = minTime + nodeProgress * span;
        const distanceDays = Math.abs(nodeTime - sampleTime) / 86400000;
        return distanceDays <= 9;
      });
      const intensity = nearby.reduce((sum, node) => sum + node.strength * 0.22, 8);
      const dateLabel = new Date(sampleTime).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      return {
        x,
        y: 398 - clamp(intensity, 8, 112),
        label: dateLabel,
        intensity: clamp(intensity, 8, 112),
      };
    });

    const wavePath = samples
      .map((sample, index) => `${index === 0 ? "M" : "L"} ${sample.x} ${sample.y}`)
      .join(" ");
    const waveAreaPath = `${wavePath} L ${samples.at(-1)?.x ?? rightX} ${plotBottom} L ${samples[0]?.x ?? leftX} ${plotBottom} Z`;

    const minLabel = new Date(minTime).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const maxLabel = new Date(maxTime).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return {
      nodes,
      wavePath,
      waveAreaPath,
      samples,
      spanLabel: `${minLabel} → ${maxLabel}`,
    };
  }, [courses, laneGap, laneTop, priorityScores, plotBottom, plotLeft, plotRight]);

  const hoveredNode = field.nodes.find((node) => node.id === hoveredId) ?? null;

  return (
    <div className="spotlight-card section-panel gravity-panel">
      <div className="section-header">
        <div>
          <div className="eyebrow">Stress Map</div>
          <h2 className="display" style={{ margin: "0.45rem 0 0" }}>
            Deadline Gravity Field + Pressure Wave
          </h2>
        </div>
        <div className="mono muted" style={{ fontSize: "0.78rem" }}>
          {field.spanLabel}
        </div>
      </div>

      <div className="mono muted" style={{ fontSize: "0.74rem", marginBottom: "0.8rem" }}>
        Heavy deadlines bend the field. The lower wave tracks how much academic pressure accumulates across the semester.
      </div>

      <div className="gravity-layout">
        <div className="gravity-stage">
          <svg viewBox="0 0 1020 460" className="gravity-svg" aria-label="Deadline Gravity Field">
            <defs>
              <linearGradient id="pressureStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="50%" stopColor="#c4b5fd" />
                <stop offset="100%" stopColor="#fcd34d" />
              </linearGradient>
              <linearGradient id="pressureArea" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(124,58,237,0.28)" />
                <stop offset="100%" stopColor="rgba(124,58,237,0.02)" />
              </linearGradient>
            </defs>

            {courses.map((course, index) => {
              const y = laneTop + index * laneGap;
              return (
                <g key={course.id}>
                  <line x1={plotLeft} x2={plotRight} y1={y + 14} y2={y + 14} stroke="rgba(255,255,255,0.06)" />
                  <text x="18" y={y + 4} fill="rgba(232,234,240,0.58)" fontSize="11" fontFamily="JetBrains Mono, monospace">
                    {course.course_code}
                  </text>
                </g>
              );
            })}

            <path d={`M ${plotLeft} ${plotBottom} L ${plotRight} ${plotBottom}`} stroke="rgba(255,255,255,0.08)" />
            {field.samples.map((sample) => (
              <text
                key={`${sample.label}-${sample.x}`}
                x={sample.x}
                y="450"
                textAnchor="middle"
                fill="rgba(232,234,240,0.4)"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                {sample.label}
              </text>
            ))}

            {field.waveAreaPath ? (
              <path d={field.waveAreaPath} fill="url(#pressureArea)" opacity="0.9" />
            ) : null}
            {field.wavePath ? (
              <path d={field.wavePath} fill="none" stroke="url(#pressureStroke)" strokeWidth="3" />
            ) : null}

            {field.nodes.map((node) => (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={node.x} cy={node.y} r={node.strength} fill={node.color} opacity="0.03" />
                <circle cx={node.x} cy={node.y} r={node.strength * 0.55} fill={node.color} opacity="0.07" />
                <circle cx={node.x} cy={node.y} r={node.radius} fill={node.color} opacity={0.95} />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={hoveredId === node.id ? node.radius + 3 : node.radius + 1}
                  fill="none"
                  stroke="rgba(255,255,255,0.82)"
                  strokeOpacity={hoveredId === node.id ? 0.82 : 0.24}
                />
              </g>
            ))}

            <text x={plotLeft} y="32" fill="rgba(232,234,240,0.45)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              Launch window
            </text>
            <text x={plotRight - 68} y="32" fill="rgba(232,234,240,0.45)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              Finals
            </text>
          </svg>
        </div>

        <div className="gravity-detail glass-card">
          {hoveredNode ? (
            <>
              <div className="mono muted" style={{ fontSize: "0.72rem" }}>
                {hoveredNode.courseCode} · {hoveredNode.dateLabel}
              </div>
              <div className="display" style={{ fontSize: "1.4rem", marginTop: "0.45rem" }}>
                {hoveredNode.title}
              </div>
              <div className="gravity-chip-row">
                <span className="tag">{hoveredNode.type}</span>
                <span className="tag">Field {hoveredNode.strength.toFixed(0)}</span>
              </div>
              <div className="stack" style={{ marginTop: "0.85rem" }}>
                <div className="mono muted" style={{ fontSize: "0.75rem" }}>{hoveredNode.weightLabel}</div>
                <div className="mono muted" style={{ fontSize: "0.75rem" }}>{hoveredNode.priorityLabel}</div>
                <div className="mono muted" style={{ fontSize: "0.75rem" }}>{hoveredNode.confidenceLabel}</div>
              </div>
              {hoveredNode.sourceText ? (
                <div className="gravity-source">{hoveredNode.sourceText}</div>
              ) : null}
            </>
          ) : (
            <>
              <div className="mono muted" style={{ fontSize: "0.72rem" }}>Signal inspection</div>
              <div className="display" style={{ fontSize: "1.3rem", marginTop: "0.45rem" }}>
                Hover a gravity well
              </div>
              <div className="muted" style={{ marginTop: "0.8rem", lineHeight: 1.75 }}>
                Large high-weight assessments pull harder on the field. The pressure wave below rises where multiple important deadlines begin to cluster.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

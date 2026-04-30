"use client";

import type { ConflictRead } from "@/lib/types";

interface ConflictCardProps {
  conflict: ConflictRead;
  eventLabels?: string[];
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const severityColors = {
  high: "#fca5a5",
  medium: "#fcd34d",
  low: "#67e8f9",
} as const;

export function ConflictCard({ conflict, eventLabels = [], selected = false, compact = false, onClick }: ConflictCardProps) {
  const severityColor = severityColors[conflict.severity];

  return (
    <article
      className={`panel conflict-card ${compact ? "compact" : ""} ${selected ? "selected" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="section-header" style={{ marginBottom: "0.8rem" }}>
        <div className="tag" style={{ color: severityColor, borderColor: `${severityColor}44`, background: `${severityColor}12` }}>
          {conflict.severity}
          <span>{conflict.rule.replaceAll("_", " ")}</span>
        </div>
        <span className="mono muted">{conflict.window_start} → {conflict.window_end}</span>
      </div>
      <h3 className="display" style={{ fontSize: "2.1rem", margin: "0 0 0.9rem" }}>
        {conflict.message}
      </h3>
      {eventLabels.length ? (
        <div className="conflict-events-preview">
          {eventLabels.slice(0, compact ? 2 : 5).map((label) => (
            <span key={label} className="mono">{label}</span>
          ))}
          {eventLabels.length > (compact ? 2 : 5) ? <span className="mono muted">+{eventLabels.length - (compact ? 2 : 5)} more</span> : null}
        </div>
      ) : (
        <p className="muted" style={{ lineHeight: 1.7, margin: 0 }}>
          Event IDs:{" "}
          <span className="mono" style={{ color: severityColor }}>
            {conflict.event_ids.join(", ")}
          </span>
        </p>
      )}
    </article>
  );
}

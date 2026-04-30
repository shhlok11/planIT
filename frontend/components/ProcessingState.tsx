"use client";

import type { UploadPipelineStatus } from "@/lib/types";

const statusProgress: Record<UploadPipelineStatus, number> = {
  UPLOADED: 0.18,
  PROCESSING: 0.45,
  PARSED: 0.6,
  CLEANED: 0.7,
  EXTRACTED: 1,
  NEEDS_REVIEW: 0.88,
  FAILED: 1,
};

const statusLabel: Record<UploadPipelineStatus, string> = {
  UPLOADED: "Receiving mission file...",
  PROCESSING: "Scoring deadlines...",
  PARSED: "Reading syllabus text...",
  CLEANED: "Refining syllabus telemetry...",
  EXTRACTED: "Mission control is ready.",
  NEEDS_REVIEW: "Extraction needs human review.",
  FAILED: "This PDF needs manual review.",
};

interface ProcessingStateProps {
  fileName: string;
  fileSizeLabel: string;
  status: UploadPipelineStatus;
  phaseLabel?: string;
  queueLabel?: string | null;
  note?: string | null;
}

export function ProcessingState({
  fileName,
  fileSizeLabel,
  status,
  phaseLabel,
  queueLabel,
  note,
}: ProcessingStateProps) {
  return (
    <div className="processing-screen">
      <div className="panel processing-card">
        <div className="orbit-mark">
          <div className="orbit-ring" />
          <div className="orbit-ring alt" />
          <div className="orbit-core" />
        </div>
        <div className="tag" style={{ margin: "0 auto 1rem", width: "fit-content", color: "var(--cyan)" }}>
          {status}
        </div>
        <div className="display" style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>
          {phaseLabel ?? statusLabel[status]}
        </div>
        <div className="progress-track" style={{ marginBottom: "1.2rem" }}>
          <div className="progress-bar" style={{ width: `${(statusProgress[status] ?? 0.45) * 100}%` }} />
        </div>
        {queueLabel ? (
          <div className="mono muted" style={{ marginBottom: "1rem", fontSize: "0.8rem", textAlign: "center" }}>
            {queueLabel}
          </div>
        ) : null}
        <div className="glass-card" style={{ padding: "1rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <span className="mono muted">{fileName}</span>
          <span className="mono muted">{fileSizeLabel}</span>
          <span className="mono" style={{ color: "var(--cyan)" }}>GPT-5.4</span>
        </div>
        {note ? (
          <div className="mono muted" style={{ marginTop: "1rem", fontSize: "0.75rem", lineHeight: 1.7, textAlign: "center" }}>
            {note}
          </div>
        ) : null}
      </div>
    </div>
  );
}

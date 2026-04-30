"use client";

import { NumberTicker } from "@/components/NumberTicker";
import type { CourseRead } from "@/lib/types";

interface PlanStatusProps {
  courses: CourseRead[];
  conflictCount: number;
  studyBlockCount: number;
}

function getNeedsReviewCount(courses: CourseRead[]) {
  return courses.flatMap((course) => course.events).filter((event) => {
    if (event.date == null) return true;
    if (event.weight == null) return true;
    if (event.confidence != null && event.confidence < 0.8) return true;
    return false;
  }).length;
}

function getDeadlineCount(courses: CourseRead[]) {
  return courses.flatMap((course) => course.events).filter((event) => event.date != null).length;
}

export function PlanStatus({ courses, conflictCount, studyBlockCount }: PlanStatusProps) {
  const deadlines = getDeadlineCount(courses);
  const needsReview = getNeedsReviewCount(courses);
  const nextAction =
    needsReview > 0
      ? "Open Courses and clean up missing dates, weights, or low-confidence events."
      : conflictCount > 0
      ? "Check Conflicts before regenerating the schedule."
      : studyBlockCount > 0
      ? "Schedule is ready. Export the plan or adjust preferences."
      : "Generate the schedule after reviewing the extracted deadlines.";

  return (
    <div className="plan-status">
      <div className="mono muted" style={{ fontSize: "0.72rem", textTransform: "uppercase" }}>
        Plan Status
      </div>

      <div className="plan-status-grid">
        <div>
          <div className="display plan-status-number">
            <NumberTicker value={courses.length} />
          </div>
          <div className="mono muted">courses</div>
        </div>
        <div>
          <div className="display plan-status-number">{deadlines}</div>
          <div className="mono muted">deadlines</div>
        </div>
        <div>
          <div className="display plan-status-number">{needsReview}</div>
          <div className="mono muted">need review</div>
        </div>
        <div>
          <div className="display plan-status-number">{conflictCount}</div>
          <div className="mono muted">conflicts</div>
        </div>
      </div>

      <div className="plan-status-footer">
        <div className="mono muted" style={{ fontSize: "0.68rem", textTransform: "uppercase" }}>
          Next Action
        </div>
        <div className="mono plan-status-copy">{nextAction}</div>
      </div>

      <div className="plan-status-bar">
        <div
          className="plan-status-fill"
          style={{
            width: `${Math.max(18, Math.min(100, 100 - needsReview * 8 - conflictCount * 14))}%`,
          }}
        />
      </div>

      <div className="mono muted" style={{ marginTop: "0.7rem", fontSize: "0.72rem" }}>
        {studyBlockCount > 0 ? `${studyBlockCount} study blocks generated` : "No schedule generated yet"}
      </div>
    </div>
  );
}

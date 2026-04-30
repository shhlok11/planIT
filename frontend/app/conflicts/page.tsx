"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { ConflictCard } from "@/components/ConflictCard";
import { PlanStatus } from "@/components/PlanStatus";
import { SpotlightCard } from "@/components/SpotlightCard";
import { useAuth } from "@/hooks/useAuth";
import { useSyllabus } from "@/hooks/useSyllabus";
import { getStoredPlanId } from "@/lib/storage";
import type { ConflictRead, ConflictSeverity } from "@/lib/types";

type ConflictFilter = "all" | ConflictSeverity;

function conflictKey(conflict: ConflictRead) {
  return `${conflict.rule}-${conflict.window_start}-${conflict.window_end}-${conflict.event_ids.join("-")}`;
}

function ruleLabel(rule: string) {
  return rule.replaceAll("_", " ");
}

export default function ConflictsPage() {
  const auth = useAuth();
  const router = useRouter();
  const [planId, setPlanId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ConflictFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const syllabus = useSyllabus(planId, auth.token);

  const eventMap = useMemo(() => {
    const map = new Map<number, { label: string; date: string | null; weight: number | null; courseCode: string }>();
    for (const course of syllabus.courses) {
      for (const event of course.events) {
        map.set(event.id, {
          label: `${course.course_code}: ${event.title}`,
          date: event.date,
          weight: event.weight,
          courseCode: course.course_code,
        });
      }
    }
    return map;
  }, [syllabus.courses]);

  const filteredConflicts = useMemo(
    () => syllabus.conflicts.filter((conflict) => filter === "all" || conflict.severity === filter),
    [filter, syllabus.conflicts],
  );

  const selectedConflict = useMemo(() => {
    if (!filteredConflicts.length) return null;
    return filteredConflicts.find((conflict) => conflictKey(conflict) === selectedKey) ?? filteredConflicts[0];
  }, [filteredConflicts, selectedKey]);

  const impact = useMemo(() => {
    const critical = syllabus.conflicts.filter((conflict) => conflict.severity === "high").length;
    const medium = syllabus.conflicts.filter((conflict) => conflict.severity === "medium").length;
    const low = syllabus.conflicts.filter((conflict) => conflict.severity === "low").length;
    const avgPriority = syllabus.priorityScores.length
      ? syllabus.priorityScores.reduce((sum, item) => sum + item.priority_score, 0) / syllabus.priorityScores.length
      : 0;
    const readiness = Math.max(0, 100 - critical * 18 - syllabus.conflicts.length * 9);
    return { critical, medium, low, avgPriority, readiness };
  }, [syllabus.conflicts, syllabus.priorityScores]);

  useEffect(() => {
    if (!auth.loading && !auth.token) {
      router.replace("/");
    }
  }, [auth.loading, auth.token, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = Number(params.get("planId") ?? 0) || null;
    setPlanId(fromQuery ?? getStoredPlanId());
  }, []);

  if (!auth.token) {
    return null;
  }

  return (
    <AppShell
      title="Conflict Resolution Protocol"
      subtitle="risk assessment // overlap telemetry // resolution impact"
      uploadLabel={syllabus.plan ? `${syllabus.plan.uploads.length} uploaded syllabus${syllabus.plan.uploads.length === 1 ? "" : "es"}` : null}
      user={auth.user}
      onLogout={auth.logout}
      sidebarStatus={(
        <PlanStatus
          courses={syllabus.courses}
          conflictCount={syllabus.conflicts.length}
          studyBlockCount={syllabus.studyBlocks.length}
        />
      )}
      actions={(
        <div className="topbar-action-strip">
          <button className="cta-secondary mono" onClick={() => router.push(`/dashboard${planId ? `?planId=${planId}` : ""}`)}>
            Dashboard
          </button>
        </div>
      )}
    >
      <div className="conflict-summary-grid">
        <SpotlightCard accent="rose" className="conflict-stat">
          <div className="mono muted">Critical</div>
          <div className="metric-value">{impact.critical}</div>
        </SpotlightCard>
        <SpotlightCard accent="amber" className="conflict-stat">
          <div className="mono muted">Medium</div>
          <div className="metric-value">{impact.medium}</div>
        </SpotlightCard>
        <SpotlightCard accent="cyan" className="conflict-stat">
          <div className="mono muted">Low</div>
          <div className="metric-value">{impact.low}</div>
        </SpotlightCard>
        <SpotlightCard accent="cyan" className="conflict-stat">
          <div className="mono muted">Readiness</div>
          <div className="metric-value">{impact.readiness}%</div>
        </SpotlightCard>
      </div>

      <div className="conflict-workspace">
        <section className="panel conflict-list-panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Conflict Queue</div>
              <h2 className="display" style={{ margin: "0.35rem 0 0" }}>Review Windows</h2>
            </div>
          </div>
          <div className="conflict-filters">
            {(["all", "high", "medium", "low"] as ConflictFilter[]).map((item) => (
              <button
                key={item}
                className={`conflict-filter mono ${filter === item ? "active" : ""}`}
                onClick={() => {
                  setFilter(item);
                  setSelectedKey(null);
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {filteredConflicts.length ? (
            <div className="conflict-queue">
              {filteredConflicts.map((conflict) => {
                const key = conflictKey(conflict);
                const labels = conflict.event_ids.map((id) => eventMap.get(id)?.label ?? `Event #${id}`);
                return (
                  <ConflictCard
                    key={key}
                    conflict={conflict}
                    eventLabels={labels}
                    compact
                    selected={selectedConflict ? conflictKey(selectedConflict) === key : false}
                    onClick={() => setSelectedKey(key)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact">
              <h3 className="display" style={{ margin: 0 }}>No matches</h3>
              <p className="muted">No conflicts match the selected severity.</p>
            </div>
          )}
        </section>

        <aside className="panel conflict-detail-panel">
          {selectedConflict ? (
            <>
              <div className="section-header">
                <div>
                  <div className="eyebrow">Selected Window</div>
                  <h2 className="display" style={{ margin: "0.35rem 0 0" }}>{selectedConflict.severity} severity</h2>
                </div>
                <span className="tag">{ruleLabel(selectedConflict.rule)}</span>
              </div>
              <div className="conflict-window-band mono">
                {selectedConflict.window_start} to {selectedConflict.window_end}
              </div>
              <p className="conflict-message">{selectedConflict.message}</p>

              <div className="detail-section-title mono">Affected deadlines</div>
              <div className="affected-event-list">
                {selectedConflict.event_ids.map((id) => {
                  const event = eventMap.get(id);
                  return (
                    <div key={id} className="affected-event">
                      <div>
                        <div>{event?.label ?? `Event #${id}`}</div>
                        <div className="mono muted">{event?.date ?? "No date"} {event?.weight != null ? `· ${event.weight}%` : ""}</div>
                      </div>
                      <span className="mono">{event?.courseCode ?? `#${id}`}</span>
                    </div>
                  );
                })}
              </div>

              <div className="detail-section-title mono">Suggested response</div>
              <div className="resolution-steps">
                <div>Move low-weight work earlier where possible.</div>
                <div>Protect review time before exams or high-weight items.</div>
                <div>Regenerate the schedule after editing deadlines or course priority.</div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">
              <h3 className="display" style={{ margin: 0 }}>No conflict signatures</h3>
              <p className="muted">The timeline does not trigger any overlap windows right now.</p>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

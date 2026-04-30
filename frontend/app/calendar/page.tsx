"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { ConflictCard } from "@/components/ConflictCard";
import { DownloadButton } from "@/components/DownloadButton";
import { PlanStatus } from "@/components/PlanStatus";
import { SpotlightCard } from "@/components/SpotlightCard";
import { TimelineView } from "@/components/TimelineView";
import { useAuth } from "@/hooks/useAuth";
import { useSyllabus } from "@/hooks/useSyllabus";
import { api } from "@/lib/api";
import { getStoredPlanId } from "@/lib/storage";

export default function CalendarPage() {
  const auth = useAuth();
  const router = useRouter();
  const [planId, setPlanId] = useState<number | null>(null);
  const syllabus = useSyllabus(planId, auth.token);

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
      title={`Mission Calendar — ${syllabus.plan?.title ?? "No Plan Loaded"}`}
      subtitle="synchronization online // display monthly"
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
          {planId ? (
            <DownloadButton
              pdfHref={api.getPlanPdfUrl(planId)}
              icsHref={api.getPlanIcsUrl(planId)}
              token={auth.token}
            />
          ) : null}
        </div>
      )}
    >
      <div className="dashboard-grid">
        <div className="stack">
          <TimelineView
            courses={syllabus.courses}
            studyBlocks={syllabus.studyBlocks}
            priorityScores={syllabus.priorityScores}
          />
        </div>
        <div className="stack">
          <SpotlightCard accent="cyan" className="section-panel">
            <div className="section-header">
              <h2 className="display">Upcoming Sortie</h2>
            </div>
            <div className="calendar-side-list">
              {syllabus.studyBlocks.slice(0, 4).map((block) => (
                <article key={block.id} className="calendar-side-card">
                  <span className="tag" style={{ color: "#67e8f9", borderColor: "rgba(6,182,212,0.25)" }}>Study Block</span>
                  <div className="display" style={{ fontSize: "1.7rem", marginTop: "0.85rem" }}>{block.title}</div>
                  <div className="mono muted" style={{ marginTop: "0.65rem" }}>
                    {new Date(block.start_time).toLocaleString()} → {new Date(block.end_time).toLocaleTimeString()}
                  </div>
                </article>
              ))}
              {!syllabus.studyBlocks.length ? (
                <div className="list-card">
                  <div className="muted">No study blocks yet. Regenerate the schedule after saving preferences.</div>
                </div>
              ) : null}
            </div>
          </SpotlightCard>

          <SpotlightCard accent="rose" className="section-panel">
            <div className="section-header">
              <h2 className="display">Conflict Log</h2>
            </div>
            <div className="stack">
              {syllabus.conflicts.slice(0, 2).map((conflict) => (
                <ConflictCard key={`${conflict.rule}-${conflict.window_start}`} conflict={conflict} />
              ))}
              {!syllabus.conflicts.length ? (
                <div className="success-banner" style={{ margin: 0 }}>
                  Calendar windows are clear.
                </div>
              ) : null}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </AppShell>
  );
}

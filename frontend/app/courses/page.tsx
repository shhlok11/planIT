"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { DeadlineTable } from "@/components/DeadlineTable";
import { DownloadButton } from "@/components/DownloadButton";
import { PlanStatus } from "@/components/PlanStatus";
import { SpotlightCard } from "@/components/SpotlightCard";
import { useAuth } from "@/hooks/useAuth";
import { useSyllabus } from "@/hooks/useSyllabus";
import { api } from "@/lib/api";
import { getStoredPlanHistory, getStoredPlanId, setStoredPlanId, type StoredPlanRecord } from "@/lib/storage";

export default function CoursesPage() {
  const auth = useAuth();
  const router = useRouter();
  const [planId, setPlanId] = useState<number | null>(null);
  const [planHistory, setPlanHistory] = useState<StoredPlanRecord[]>([]);
  const syllabus = useSyllabus(planId, auth.token);
  const orderedCourses = [...syllabus.courses].sort((a, b) => (a.priority_rank ?? Number.MAX_SAFE_INTEGER) - (b.priority_rank ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);

  useEffect(() => {
    if (!auth.loading && !auth.token) {
      router.replace("/");
    }
  }, [auth.loading, auth.token, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = Number(params.get("planId") ?? 0) || null;
    const nextPlanId = fromQuery ?? getStoredPlanId();
    setPlanId(nextPlanId);
    setPlanHistory(getStoredPlanHistory());

    if (!auth.token) return;

    void api.listPlans(auth.token)
      .then((plans) => {
        const records = plans.map((plan) => ({
          planId: plan.id,
          title: plan.title,
          createdAt: plan.created_at,
        }));
        setPlanHistory(records);
      })
      .catch(() => undefined);
  }, [auth.token]);

  async function handleSwapCoursePriority(courseId: number, direction: "up" | "down") {
    const index = orderedCourses.findIndex((course) => course.id === courseId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= orderedCourses.length) return;

    const current = orderedCourses[index];
    const target = orderedCourses[swapIndex];
    const currentRank = current.priority_rank ?? index + 1;
    const targetRank = target.priority_rank ?? swapIndex + 1;
    const tempRank = Math.max(...orderedCourses.map((course, idx) => course.priority_rank ?? idx + 1), 0) + 1;

    await syllabus.updateCoursePreferences(current.id, { priority_rank: tempRank });
    await syllabus.updateCoursePreferences(target.id, { priority_rank: currentRank });
    await syllabus.updateCoursePreferences(current.id, { priority_rank: targetRank });
  }

  if (!auth.token) {
    return null;
  }

  return (
    <AppShell
      title={`Courses — ${syllabus.plan?.title ?? "No Plan Loaded"}`}
      subtitle="manual review // course ranking // missed deadline recovery"
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
          {planHistory.length ? (
            <select
              className="field mono plan-select"
              value={planId ?? ""}
              onChange={(event) => {
                const nextPlanId = Number(event.target.value) || null;
                if (!nextPlanId) return;
                setPlanId(nextPlanId);
                setStoredPlanId(nextPlanId);
                router.replace(`/courses?planId=${nextPlanId}`);
              }}
            >
              {planHistory.map((item) => (
                <option key={item.planId} value={item.planId}>
                  #{item.planId} · {item.title}
                </option>
              ))}
            </select>
          ) : null}
          {planId ? (
            <DownloadButton
              pdfHref={api.getPlanPdfUrl(planId)}
              icsHref={api.getPlanIcsUrl(planId)}
              token={auth.token}
            />
          ) : null}
          <button className="cta-secondary mono" onClick={() => router.push(`/dashboard${planId ? `?planId=${planId}` : ""}`)}>
            Dashboard
          </button>
          <button className="cta-secondary mono" onClick={() => router.push(`/calendar${planId ? `?planId=${planId}` : ""}`)}>
            Calendar
          </button>
        </div>
      )}
    >
      {syllabus.error ? <div className="error-banner">{syllabus.error}</div> : null}

      {!planId ? (
        <div className="panel empty-state">
          <h2 className="display" style={{ fontSize: "2.6rem", margin: 0 }}>No plan selected</h2>
          <p className="muted">Open a plan first, then use this surface to review extracted deadlines, add missed events, and rebalance course priority.</p>
          <button className="cta-primary mono" onClick={() => router.push("/")}>Back to Upload</button>
        </div>
      ) : (
        <div className="stack">
          <SpotlightCard accent="amber" className="section-panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Manual Review</div>
                <h2 className="display" style={{ margin: "0.45rem 0 0" }}>Courses</h2>
              </div>
            </div>
            <DeadlineTable
              courses={syllabus.courses}
              priorityScores={syllabus.priorityScores}
              onUpdateEvent={syllabus.updateEvent}
              onDeleteEvent={syllabus.deleteEvent}
              onCreateEvent={syllabus.createEvent}
              onUpdateCourse={syllabus.updateCoursePreferences}
              onSwapCoursePriority={handleSwapCoursePriority}
            />
          </SpotlightCard>
      </div>
      )}
    </AppShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { ConflictRadar } from "@/components/ConflictRadar";
import { DeadlineGravityField } from "@/components/DeadlineGravityField";
import { DownloadButton } from "@/components/DownloadButton";
import { MiniCalendar } from "@/components/MiniCalendar";
import { NumberTicker } from "@/components/NumberTicker";
import { PlanStatus } from "@/components/PlanStatus";
import { SpotlightCard } from "@/components/SpotlightCard";
import { UploadZone } from "@/components/UploadZone";
import { useAuth } from "@/hooks/useAuth";
import { useSyllabus } from "@/hooks/useSyllabus";
import { clearStoredPlanId, getStoredPlanHistory, getStoredPlanId, pushStoredUpload, setStoredPlanId, setStoredUploadId, updateStoredPlanTitle, type StoredPlanRecord } from "@/lib/storage";
import { ApiError, api } from "@/lib/api";

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreColor(score: number) {
  if (score >= 90) return "#fca5a5";
  if (score >= 75) return "#fcd34d";
  if (score >= 60) return "#6ee7b7";
  return "#94a3b8";
}

function titleLooksFileDerived(title: string) {
  return /\.pdf$/i.test(title) || /course\s*outline/i.test(title) || /--/.test(title) || /syllabus/i.test(title);
}

function expandSemesterCode(value: string) {
  const compact = value.replace(/\s+/g, "");
  const coded = compact.match(/\b([WFS])(?:I|A|U|P|AL|IN|PRING|UMMER|ALL)?[-_ ]?(\d{2}|\d{4})\b/i);
  if (coded) {
    const seasonMap: Record<string, string> = { W: "Winter", F: "Fall", S: "Summer" };
    const yearValue = coded[2].length === 2 ? 2000 + Number(coded[2]) : Number(coded[2]);
    return `${seasonMap[coded[1].toUpperCase()] ?? coded[1].toUpperCase()} ${yearValue}`;
  }

  const longForm = value.match(/\b(Winter|Fall|Summer|Spring)\s*(20\d{2}|\d{2})\b/i);
  if (longForm) {
    const yearValue = longForm[2].length === 2 ? 2000 + Number(longForm[2]) : Number(longForm[2]);
    return `${longForm[1][0].toUpperCase()}${longForm[1].slice(1).toLowerCase()} ${yearValue}`;
  }

  return null;
}

function inferSemesterTitle(courses: ReturnType<typeof useSyllabus>["courses"], plan: ReturnType<typeof useSyllabus>["plan"]) {
  const semesterCounts = new Map<string, number>();
  for (const course of courses) {
    const expanded = course.semester ? expandSemesterCode(course.semester) ?? course.semester : null;
    if (!expanded) continue;
    semesterCounts.set(expanded, (semesterCounts.get(expanded) ?? 0) + 1);
  }

  const topSemester = [...semesterCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topSemester) return topSemester;

  for (const upload of plan?.uploads ?? []) {
    const fromFilename = expandSemesterCode(upload.original_filename);
    if (fromFilename) return fromFilename;
  }

  return null;
}

export default function DashboardPage() {
  const auth = useAuth();
  const router = useRouter();
  const [planId, setPlanId] = useState<number | null>(null);
  const [planHistory, setPlanHistory] = useState<StoredPlanRecord[]>([]);
  const [isAddingPdf, setIsAddingPdf] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [addingPdfError, setAddingPdfError] = useState<string | null>(null);
  const [addingPdfSuccess, setAddingPdfSuccess] = useState<string | null>(null);
  const [activeUploadName, setActiveUploadName] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [uploadQueueMeta, setUploadQueueMeta] = useState<{
    current: number;
    total: number;
    phase: "uploading" | "extracting";
    skipped: string[];
  } | null>(null);
  const syllabus = useSyllabus(planId, auth.token);
  const activePlanId = syllabus.plan?.id ?? null;

  const inferredSemesterTitle = useMemo(
    () => inferSemesterTitle(syllabus.courses, syllabus.plan),
    [syllabus.courses, syllabus.plan],
  );
  const dashboardTitle = useMemo(() => {
    const planTitle = syllabus.plan?.title?.trim();
    if (!planTitle) return inferredSemesterTitle ?? "No semester loaded";
    if (inferredSemesterTitle && titleLooksFileDerived(planTitle)) return inferredSemesterTitle;
    return planTitle;
  }, [inferredSemesterTitle, syllabus.plan?.title]);

  const missionMetrics = useMemo(() => {
    const datedEvents = syllabus.courses.flatMap((course) => course.events).filter((event) => Boolean(event.date));
    const criticalDeadlines = datedEvents.filter((event) => {
      if (!event.date) return false;
      const due = new Date(`${event.date}T23:59:59`);
      const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 7;
    }).length;

    const totalHours = syllabus.studyBlocks.reduce((sum, block) => {
      const start = new Date(block.start_time).getTime();
      const end = new Date(block.end_time).getTime();
      return sum + (end - start) / 3600000;
    }, 0);

    const avgScore = average(syllabus.priorityScores.map((item) => item.priority_score));

    return {
      criticalDeadlines,
      totalHours,
      conflictCount: syllabus.conflicts.length,
      avgScore,
    };
  }, [syllabus.conflicts.length, syllabus.courses, syllabus.priorityScores, syllabus.studyBlocks]);

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

        const currentPlanId = fromQuery ?? getStoredPlanId();
        const hasCurrentPlan = currentPlanId ? records.some((record) => record.planId === currentPlanId) : false;
        const fallbackPlanId = hasCurrentPlan
          ? currentPlanId
          : records[0]?.planId ?? null;

        if (fallbackPlanId !== currentPlanId) {
          setPlanId(fallbackPlanId);
          if (fallbackPlanId) {
            setStoredPlanId(fallbackPlanId);
            router.replace(`/dashboard?planId=${fallbackPlanId}`);
          } else {
            clearStoredPlanId();
            router.replace("/dashboard");
          }
        }
      })
      .catch(() => undefined);
  }, [auth.token]);

  async function handleAddFiles(files: File[]) {
    if (!auth.token || !activePlanId) {
      setAddingPdfError("Select a plan before adding more PDFs.");
      return;
    }

    setIsUploadingPdf(true);
    setAddingPdfError(null);
    setAddingPdfSuccess(null);
    setUploadQueueMeta(null);

    try {
      const succeededUploads = [];
      const failedUploads: string[] = [];

      for (const [index, file] of files.entries()) {
        setActiveUploadName(file.name);
        setUploadQueueMeta({
          current: index + 1,
          total: files.length,
          phase: "uploading",
          skipped: [...failedUploads],
        });
        try {
          const upload = await api.uploadFileToPlan(activePlanId, file, auth.token);
          succeededUploads.push(upload);
          setStoredUploadId(upload.upload_id);
          pushStoredUpload({
            uploadId: upload.upload_id,
            originalFilename: upload.original_filename,
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          failedUploads.push(file.name);
          setAddingPdfError(
            err instanceof ApiError
              ? `Skipped ${file.name}: ${err.message}`
              : `Skipped ${file.name}: upload failed.`,
          );
        }
      }

      if (!succeededUploads.length) {
        throw new Error("None of the selected PDFs could be uploaded.");
      }

      setUploadQueueMeta({
        current: succeededUploads.length,
        total: files.length,
        phase: "extracting",
        skipped: failedUploads,
      });
      const extraction = await api.extractPlan(activePlanId, auth.token);
      await syllabus.refresh();
      const extractedEventCount = extraction.courses.reduce((count, course) => count + course.events.length, 0);
      setAddingPdfSuccess(
        extractedEventCount === 0
          ? "The PDFs were attached, but extraction needs manual review."
          : failedUploads.length
          ? `Added ${succeededUploads.length}/${files.length} syllabi to the active mission plan. Skipped: ${failedUploads.join(", ")}.`
          : files.length === 1
          ? "Syllabus added to the active mission plan."
          : `${files.length} syllabi added to the active mission plan.`,
      );
      setIsAddingPdf(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to add PDF";
      setAddingPdfError(message);
    } finally {
      setIsUploadingPdf(false);
      setActiveUploadName(null);
      setUploadQueueMeta(null);
    }
  }

  async function handleSaveTitle() {
    if (!auth.token || !activePlanId) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleError("Title cannot be blank.");
      return;
    }

    try {
      setTitleError(null);
      const updated = await api.updatePlan(activePlanId, { title: nextTitle }, auth.token);
      updateStoredPlanTitle(activePlanId, updated.title);
      setPlanHistory((current) => current.map((item) => (
        item.planId === activePlanId ? { ...item, title: updated.title } : item
      )));
      await syllabus.refresh();
      setIsEditingTitle(false);
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : "Failed to update title.");
    }
  }

  if (!auth.token) {
    return null;
  }

  return (
    <AppShell
      title={(
        <div className="editable-title-wrap">
          {isEditingTitle ? (
            <>
              <span>Mission Control —</span>
              <input
                className="editable-title-input"
                value={titleDraft}
                autoFocus
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSaveTitle();
                  if (event.key === "Escape") {
                    setIsEditingTitle(false);
                    setTitleError(null);
                  }
                }}
              />
              <button className="title-edit-button mono" onClick={() => void handleSaveTitle()}>
                Save
              </button>
              <button
                className="title-edit-button mono"
                onClick={() => {
                  setIsEditingTitle(false);
                  setTitleError(null);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span>Mission Control — {dashboardTitle}</span>
              <button
                className="title-edit-button mono"
                onClick={() => {
                  setTitleDraft(dashboardTitle);
                  setTitleError(null);
                  setIsEditingTitle(true);
                }}
              >
                Edit
              </button>
            </>
          )}
        </div>
      )}
      subtitle="sys_id stable // uplink authenticated // dashboard"
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
      missionMeta={(
        <div className="mono muted" style={{ fontSize: "0.78rem" }}>
          {syllabus.plan ? `plan #${syllabus.plan.id}` : "no plan"} · sync online · {syllabus.courses.length} course channels
        </div>
      )}
      actions={(
        <div className="topbar-action-strip">
          {planHistory.length ? (
            <select
              className="field mono plan-select"
              value={activePlanId ?? planId ?? ""}
              onChange={(event) => {
                const nextPlanId = Number(event.target.value) || null;
                if (!nextPlanId) return;
                setPlanId(nextPlanId);
                setStoredPlanId(nextPlanId);
                router.replace(`/dashboard?planId=${nextPlanId}`);
              }}
            >
              {planHistory.map((item) => (
                <option key={item.planId} value={item.planId}>
                  #{item.planId} · {item.title}
                </option>
              ))}
            </select>
          ) : null}
          {activePlanId ? (
            <button className="cta-secondary mono" onClick={() => setIsAddingPdf(true)}>
              Add PDF
            </button>
          ) : null}
          {activePlanId ? (
            <DownloadButton
              pdfHref={api.getPlanPdfUrl(activePlanId)}
              icsHref={api.getPlanIcsUrl(activePlanId)}
              token={auth.token}
            />
          ) : null}
        </div>
      )}
    >
      {syllabus.error ? <div className="error-banner">{syllabus.error}</div> : null}
      {titleError ? <div className="error-banner">{titleError}</div> : null}
      {addingPdfError ? <div className="error-banner">{addingPdfError}</div> : null}
      {addingPdfSuccess ? <div className="success-banner">{addingPdfSuccess}</div> : null}
      {isAddingPdf ? (
        <div className="modal-overlay" onClick={() => !isUploadingPdf && setIsAddingPdf(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-header" style={{ marginBottom: "1.25rem" }}>
              <div>
                <div className="eyebrow">Extend Mission Plan</div>
                <h2 className="display" style={{ margin: "0.45rem 0 0", fontSize: "2rem" }}>Add More Syllabi</h2>
              </div>
              <button className="icon-button mono" onClick={() => setIsAddingPdf(false)} disabled={isUploadingPdf}>
                Close
              </button>
            </div>
            {isUploadingPdf && uploadQueueMeta ? (
              <div className="upload-loading-panel">
                <div className="orbit-mark compact">
                  <div className="orbit-ring" />
                  <div className="orbit-ring alt" />
                  <div className="orbit-core" />
                </div>
                <div className="display" style={{ fontSize: "1.6rem", marginTop: "0.7rem" }}>
                  {uploadQueueMeta.phase === "uploading"
                    ? `Uploading ${uploadQueueMeta.current} of ${uploadQueueMeta.total}`
                    : `Extracting ${uploadQueueMeta.current} uploaded PDF${uploadQueueMeta.current === 1 ? "" : "s"}`}
                </div>
                <div className="mono muted" style={{ marginTop: "0.45rem", textAlign: "center", lineHeight: 1.6 }}>
                  {activeUploadName ? `Current file: ${activeUploadName}` : "Preparing upload queue"}
                  {uploadQueueMeta.skipped.length ? ` • Skipped: ${uploadQueueMeta.skipped.join(", ")}` : ""}
                </div>
                <div className="progress-track" style={{ marginTop: "1rem", width: "100%" }}>
                  <div
                    className="progress-bar"
                    style={{
                      width: `${(uploadQueueMeta.current / Math.max(uploadQueueMeta.total, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <UploadZone
                disabled={isUploadingPdf}
                onUpload={handleAddFiles}
                activeFileName={activeUploadName}
              />
            )}
          </div>
        </div>
      ) : null}
      {!planId ? (
        <div className="panel empty-state">
          <h2 className="display" style={{ fontSize: "2.6rem", margin: 0 }}>No plan selected</h2>
          <p className="muted">Create a plan by uploading one or more syllabi, then return here to review deadlines and generate the schedule.</p>
          <button className="cta-primary mono" onClick={() => router.push("/")}>Back to Upload</button>
        </div>
      ) : (
        <>
          <div className="metrics-bento">
            <SpotlightCard accent="rose" className="metric-card">
              <h3>Critical Deadlines</h3>
              <div className="metric-value">
                <NumberTicker value={missionMetrics.criticalDeadlines} />
                <small className="mono">T-minus 7D</small>
              </div>
            </SpotlightCard>
            <SpotlightCard accent="cyan" className="metric-card">
              <h3>Study Blocks</h3>
              <div className="metric-value">
                <NumberTicker value={syllabus.studyBlocks.length} />
                <small className="mono">{missionMetrics.totalHours.toFixed(1)} hrs</small>
              </div>
            </SpotlightCard>
            <SpotlightCard accent="amber" className="metric-card">
              <h3>Schedule Conflicts</h3>
              <div className="metric-value" style={{ color: syllabus.conflicts.length ? "#fca5a5" : "var(--text)" }}>
                <NumberTicker value={syllabus.conflicts.length} />
                <small className="mono">requires action</small>
              </div>
            </SpotlightCard>
            <SpotlightCard accent="violet" className="metric-card">
              <h3>Avg Priority Score</h3>
              <div className="metric-value" style={{ color: scoreColor(missionMetrics.avgScore) }}>
                <NumberTicker value={missionMetrics.avgScore} decimals={1} />
                <small className="mono">/ 100</small>
              </div>
            </SpotlightCard>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <DeadlineGravityField
              courses={syllabus.courses}
              priorityScores={syllabus.priorityScores}
            />
          </div>

          <div className="dashboard-bento">
            <div className="stack">
              <SpotlightCard accent="cyan" className="section-panel">
                <div className="section-header">
                  <div>
                    <h2 className="display" style={{ margin: 0 }}>Deployment Window</h2>
                    <div className="muted" style={{ marginTop: "0.4rem" }}>
                      Your semester compressed into a single monthly launch surface.
                    </div>
                  </div>
                  <button className="cta-secondary mono" onClick={() => router.push(`/calendar${planId ? `?planId=${planId}` : ""}`)}>
                    Open Calendar
                  </button>
                </div>
                <div className="mono muted" style={{ fontSize: "0.74rem", marginBottom: "0.8rem" }}>
                  deadlines + exams + generated study blocks
                </div>
                <MiniCalendar courses={syllabus.courses} studyBlocks={syllabus.studyBlocks} />
              </SpotlightCard>
            </div>

            <div className="stack">
              <SpotlightCard accent="rose" className="section-panel">
                <div className="section-header">
                  <h2 className="display">Conflict Radar</h2>
                  <button className="cta-secondary mono" onClick={() => router.push(`/conflicts${planId ? `?planId=${planId}` : ""}`)}>
                    Open Conflicts
                  </button>
                </div>
                <div className="mono muted" style={{ fontSize: "0.74rem", marginBottom: "0.8rem" }}>
                  {syllabus.courses.flatMap((course) => course.events).filter((event) => event.date).length} dated events · {syllabus.conflicts.length} windows
                </div>
                <ConflictRadar courses={syllabus.courses} conflicts={syllabus.conflicts} />
              </SpotlightCard>
            </div>
          </div>

        </>
      )}
    </AppShell>
  );
}

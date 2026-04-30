"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/api";
import type { UploadPipelineStatus } from "@/lib/types";
import { pushStoredPlan, pushStoredUpload, setStoredPlanId, setStoredUploadId } from "@/lib/storage";
import { HeroBento } from "@/components/HeroBento";
import { useAuth } from "@/hooks/useAuth";
import { ProcessingState } from "@/components/ProcessingState";
import { TextRevealCard } from "@/components/TextRevealCard";
import { UploadZone } from "@/components/UploadZone";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const terminalUploadStatuses: UploadPipelineStatus[] = ["EXTRACTED", "NEEDS_REVIEW", "FAILED"];

export default function HomePage() {
  const router = useRouter();
  const auth = useAuth();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusPollingFailed, setStatusPollingFailed] = useState(false);
  const [processing, setProcessing] = useState<{
    planId: number;
    uploadId: number | null;
    fileName: string;
    fileSizeBytes: number;
    status: UploadPipelineStatus;
    queueIndex?: number;
    queueTotal?: number;
    phaseLabel?: string;
    note?: string | null;
  } | null>(null);

  const oauthLinks = useMemo(() => ({
    google: auth.providers?.google.enabled ? "http://localhost:8000/api/v1/auth/google/login" : null,
    github: auth.providers?.github.enabled ? "http://localhost:8000/api/v1/auth/github/login" : null,
  }), [auth.providers]);

  useEffect(() => {
    if (!processing || !auth.token || !processing.uploadId || statusPollingFailed) return;

    const token = auth.token;
    const uploadId = processing.uploadId;
    let cancelled = false;
    const interval = window.setInterval(() => {
      void api.getUploadStatus(uploadId, token)
        .then((status) => {
          if (!cancelled) {
            setStatusPollingFailed(false);
            setProcessing((current) => current ? {
              ...current,
              status: status.status,
            } : current);
            if (terminalUploadStatuses.includes(status.status)) {
              window.clearInterval(interval);
            }
          }
        })
        .catch((err) => {
          if (cancelled) return;
          const message = err instanceof ApiError
            ? err.message
            : "Upload status temporarily unavailable. The file may still finish processing in the background.";
          setStatusPollingFailed(true);
          setProcessing((current) => current ? {
            ...current,
            note: message,
          } : current);
          window.clearInterval(interval);
        });
    }, 1750);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [auth.token, processing?.uploadId, statusPollingFailed]);

  async function handleAuthSubmit() {
    setError(null);
    setSuccess(null);

    try {
      if (mode === "login") {
        await auth.login({ email, password });
        setSuccess("Authentication lock acquired.");
      } else {
        await auth.register({ email, password, name: name || null });
        setSuccess("Operator profile created.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  async function handleUpload(files: File[]) {
    if (!auth.token) {
      setError("Sign in before uploading a syllabus.");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      setStatusPollingFailed(false);
      const plan = await api.createPlan(
        { title: files.length === 1 ? files[0].name.replace(/\.pdf$/i, "") : `Semester Plan · ${new Date().toLocaleDateString()}` },
        auth.token,
      );
      setStoredPlanId(plan.id);
      pushStoredPlan({
        planId: plan.id,
        title: plan.title,
        createdAt: plan.created_at,
      });

      let totalExtractedEvents = 0;
      const succeededUploads = [];
      const failedUploads: string[] = [];

      for (const [index, file] of files.entries()) {
        setProcessing({
          planId: plan.id,
          uploadId: succeededUploads.at(-1)?.upload_id ?? null,
          fileName: file.name,
          fileSizeBytes: file.size,
          status: "UPLOADED",
          queueIndex: index + 1,
          queueTotal: files.length,
          phaseLabel: `Uploading syllabus ${index + 1} of ${files.length}`,
          note: "Building your mission plan queue and attaching files one at a time.",
        });
        try {
          const upload = await api.uploadFileToPlan(plan.id, file, auth.token);
          succeededUploads.push(upload);
          setStoredUploadId(upload.upload_id);
          pushStoredUpload({
            uploadId: upload.upload_id,
            originalFilename: upload.original_filename,
            createdAt: new Date().toISOString(),
          });
          setProcessing({
            planId: plan.id,
            uploadId: upload.upload_id,
            fileName: upload.original_filename,
            fileSizeBytes: upload.file_size_bytes,
            status: upload.status,
            queueIndex: index + 1,
            queueTotal: files.length,
            phaseLabel: `Uploaded syllabus ${index + 1} of ${files.length}`,
            note: failedUploads.length
              ? `${failedUploads.length} file${failedUploads.length === 1 ? "" : "s"} skipped so far.`
              : "Preparing the remaining PDFs in the queue.",
          });
        } catch (err) {
          failedUploads.push(file.name);
          setProcessing({
            planId: plan.id,
            uploadId: succeededUploads.at(-1)?.upload_id ?? null,
            fileName: file.name,
            fileSizeBytes: file.size,
            status: "PROCESSING",
            queueIndex: index + 1,
            queueTotal: files.length,
            phaseLabel: `Skipped ${file.name}`,
            note: err instanceof ApiError
              ? err.message
              : "This PDF could not be uploaded. Continuing with the rest of the queue.",
          });
        }
      }

      if (!succeededUploads.length) {
        throw new Error("None of the selected PDFs could be uploaded.");
      }

      const lastUpload = succeededUploads[succeededUploads.length - 1];
      setProcessing({
        planId: plan.id,
        uploadId: lastUpload.upload_id,
        fileName: lastUpload.original_filename,
        fileSizeBytes: lastUpload.file_size_bytes,
        status: "PROCESSING",
        queueIndex: succeededUploads.length,
        queueTotal: files.length,
        phaseLabel: `Extracting ${succeededUploads.length} uploaded PDF${succeededUploads.length === 1 ? "" : "s"}`,
        note: failedUploads.length
          ? `Continuing without: ${failedUploads.join(", ")}`
          : "The extraction pipeline is consolidating the uploaded syllabi into one plan.",
      });

      const extraction = await api.extractPlan(plan.id, auth.token);
      totalExtractedEvents += extraction.courses.reduce((count, course) => count + course.events.length, 0);

      if (totalExtractedEvents === 0) {
        setSuccess(
          failedUploads.length
            ? `Uploaded ${succeededUploads.length}/${files.length} PDFs, but extraction needs manual review. Skipped: ${failedUploads.join(", ")}.`
            : "Uploaded the PDF queue, but extraction needs manual review.",
        );
      } else {
        setSuccess(
          failedUploads.length
            ? `Processed ${succeededUploads.length}/${files.length} PDFs and extracted ${totalExtractedEvents} mission events. Skipped: ${failedUploads.join(", ")}.`
            : files.length === 1
            ? `Extracted ${totalExtractedEvents} mission events.`
            : `Processed ${files.length} PDFs and extracted ${totalExtractedEvents} mission events.`,
        );
      }
      setProcessing(null);
      startTransition(() => {
        router.push(`/dashboard?planId=${plan.id}`);
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed";
      setError(message);
      setProcessing(null);
    }
  }

  if (processing) {
    return (
      <ProcessingState
        fileName={processing.queueTotal && processing.queueTotal > 1 ? `${processing.fileName} (${processing.queueIndex}/${processing.queueTotal})` : processing.fileName}
        fileSizeLabel={formatBytes(processing.fileSizeBytes)}
        status={processing.status}
        phaseLabel={processing.phaseLabel}
        queueLabel={processing.queueTotal ? `${processing.queueIndex ?? 0} / ${processing.queueTotal} files in queue` : null}
        note={processing.note}
      />
    );
  }

  return (
    <div className="page-shell auth-layout">
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="brand-lockup">
            <div className="brand-mark">⌁</div>
            <div className="display" style={{ fontSize: "2.6rem" }}>planIT</div>
          </div>

          <h1 className="display hero-title">
            Drop your syllabus.
            <span className="hero-accent">Own your semester.</span>
          </h1>

          <p className="hero-subtitle">
            AI extracts every deadline, builds your schedule, scores the mission risk, and synchronizes your semester into a single command surface.
          </p>

          <UploadZone
            disabled={!auth.token || auth.loading || isPending}
            onUpload={handleUpload}
          />

          <div style={{ marginTop: "1.25rem", width: "min(620px, 100%)", marginInline: "auto" }}>
            <TextRevealCard
              caption="Aceternity-style reveal"
              text="Raw syllabus in."
              revealText="Priority engine out."
            />
          </div>

          <div className="feature-row">
            <span className="tag">⚡ AI Priority Scoring</span>
            <span className="tag">⌚ Study Block Generator</span>
            <span className="tag">⇣ Export to .ICS / PDF</span>
          </div>

          <HeroBento />
        </div>
      </section>

      <aside className="auth-column">
        <div className="panel auth-card">
          <div className="eyebrow">Orbital Access</div>
          <h2 className="display" style={{ fontSize: "2.2rem", margin: "0.65rem 0 0" }}>
            {auth.user ? "Mission Ready" : "Authenticate to launch"}
          </h2>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            {auth.user
              ? `Signed in as ${auth.user.name || auth.user.email}. You can upload new syllabi or jump directly to mission control.`
              : "Use a fast local login for testing or sign in with Google or GitHub to mirror the production flow."}
          </p>

          {error ? <div className="error-banner">{error}</div> : null}
          {success ? <div className="success-banner">{success}</div> : null}

          {auth.user ? (
            <div className="stack">
              <div className="glass-card" style={{ padding: "1rem" }}>
                <div className="mono muted">ACTIVE USER</div>
                <div style={{ marginTop: "0.45rem", fontSize: "1.05rem" }}>{auth.user.name || "Unnamed Operator"}</div>
                <div className="mono" style={{ marginTop: "0.4rem", color: "var(--cyan)" }}>{auth.user.email}</div>
              </div>
              <div className="action-row">
                <button className="cta-primary mono" onClick={() => router.push("/dashboard")}>
                  Open Dashboard
                </button>
                <button className="cta-secondary mono" onClick={() => void auth.logout()}>
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="auth-tabs">
                <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
                  Sign In
                </button>
                <button className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>
                  Register
                </button>
              </div>

              <div className="field-group">
                {mode === "register" ? (
                  <>
                    <label>Name</label>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Test User" />
                  </>
                ) : null}
                <label>Email</label>
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@planit.local" />
                <label>Password</label>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="StrongPass123" />
              </div>

              <div className="action-row" style={{ marginTop: "1rem" }}>
                <button className="cta-primary mono" onClick={() => void handleAuthSubmit()}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </div>

              <div className="auth-divider">or route through OAuth</div>

              <div className="oauth-grid">
                <button
                  className="cta-secondary mono"
                  disabled={!oauthLinks.google}
                  onClick={() => {
                    if (oauthLinks.google) window.location.href = oauthLinks.google;
                  }}
                >
                  Google Sign-In
                </button>
                <button
                  className="cta-secondary mono"
                  disabled={!oauthLinks.github}
                  onClick={() => {
                    if (oauthLinks.github) window.location.href = oauthLinks.github;
                  }}
                >
                  GitHub Sign-In
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

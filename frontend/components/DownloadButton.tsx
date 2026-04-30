"use client";

import { useState } from "react";

import { normalizeErrorMessage, readApiErrorMessage } from "@/lib/api";

interface DownloadButtonProps {
  pdfHref?: string;
  icsHref?: string;
  token?: string | null;
}

export function DownloadButton({ pdfHref, icsHref, token }: DownloadButtonProps) {
  const [mode, setMode] = useState<"pdf" | "ics">("pdf");
  const [pdfTheme, setPdfTheme] = useState<"dark" | "white">("dark");
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function downloadPdf(theme: "dark" | "white") {
    if (!pdfHref) return;
    const downloadHref = `${pdfHref}${pdfHref.includes("?") ? "&" : "?"}theme=${theme}`;
    const response = await fetch(downloadHref, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response));
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `planit-calendar-${theme}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    setIsReady(true);
    window.setTimeout(() => setIsReady(false), 1600);
  }

  async function downloadIcs() {
    if (!icsHref) return;
    const response = await fetch(icsHref, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response));
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "planit-export.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    setIsReady(true);
    window.setTimeout(() => setIsReady(false), 1600);
  }

  async function handleExport() {
    setExportError(null);

    try {
      if (mode === "pdf") {
        await downloadPdf(pdfTheme);
        return;
      }

      await downloadIcs();
    } catch (err) {
      setIsReady(false);
      setExportError(normalizeErrorMessage(err instanceof Error ? err.message : null, "Export failed. Try again."));
    }
  }

  return (
    <span className="export-widget">
      <button className="cta-secondary mono" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        Export
      </button>
      {isOpen ? (
        <div className="export-widget-card">
          <div className="export-widget-head">
            <div>
              <div className="export-widget-title">Export</div>
              <div className="export-widget-sub">Choose a format</div>
            </div>
            <button className="export-widget-close" aria-label="Close export menu" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className="export-section-label">Format</div>
          <div className="export-format-seg" role="tablist" aria-label="Export format">
            <button
              className={`export-format-btn ${mode === "pdf" ? "active" : ""}`}
              type="button"
              aria-selected={mode === "pdf"}
              onClick={() => {
                setMode("pdf");
                setIsReady(false);
              }}
            >
              <span aria-hidden="true">▣</span>
              PDF
            </button>
            <button
              className={`export-format-btn ${mode === "ics" ? "active" : ""}`}
              type="button"
              aria-selected={mode === "ics"}
              onClick={() => {
                setMode("ics");
                setIsReady(false);
              }}
            >
              <span aria-hidden="true">▦</span>
              ICS
            </button>
          </div>

          {mode === "pdf" ? (
            <>
              <div className="export-section-label">Appearance</div>
              <div className="export-mode-row">
                <div>
                  <div className="export-mode-label">{pdfTheme === "dark" ? "Dark mode" : "White mode"}</div>
                  <div className="export-mode-desc">{pdfTheme === "dark" ? "Black calendar background" : "Print friendly calendar"}</div>
                </div>
                <button
                  className={`export-theme-toggle ${pdfTheme === "dark" ? "dark-on" : "light-on"}`}
                  aria-label="Toggle PDF theme"
                  onClick={() => setPdfTheme((current) => (current === "dark" ? "white" : "dark"))}
                >
                  <span className="theme-icon moon">●</span>
                  <span className="theme-icon sun">○</span>
                  <span className={`theme-knob ${pdfTheme === "dark" ? "dark-on" : "light-on"}`} />
                </button>
              </div>
            </>
          ) : (
            <div className="export-calendar-row">
              <div className="calendar-export-icon">▦</div>
              <div>
                <div className="export-mode-label">Calendar file</div>
                <div className="export-mode-desc">Imports deadlines and study blocks</div>
              </div>
            </div>
          )}

          <button className={`export-action ${mode}`} onClick={() => void handleExport()}>
            Export {mode.toUpperCase()}
          </button>

          {exportError ? <div className="error-banner export-error">{exportError}</div> : null}

          <div className={`export-ready ${isReady ? "show" : ""}`}>
            File ready to download
          </div>
        </div>
      ) : null}
    </span>
  );
}

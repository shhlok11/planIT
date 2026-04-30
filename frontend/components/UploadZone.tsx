"use client";

import { useRef, useState } from "react";

interface UploadZoneProps {
  disabled?: boolean;
  onUpload: (files: File[]) => Promise<void> | void;
  activeFileName?: string | null;
}

export function UploadZone({ disabled = false, onUpload, activeFileName }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) : [];
    if (!files.length || disabled) return;
    await onUpload(files);
  }

  return (
    <div
      className="panel"
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setDragging(false);
        await handleFiles(event.dataTransfer.files);
      }}
      style={{
        width: "min(620px, 100%)",
        margin: "0 auto",
        padding: "2rem",
        borderStyle: "dashed",
        borderWidth: "2px",
        borderColor: dragging ? "rgba(6, 182, 212, 0.6)" : "rgba(124, 58, 237, 0.35)",
        boxShadow: dragging ? "var(--shadow-cyan)" : "var(--shadow-violet)",
        opacity: disabled ? 0.55 : 1,
      }}
      role="button"
      tabIndex={0}
      onClick={() => !disabled && fileInputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          fileInputRef.current?.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={async (event) => {
          await handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="brand-mark" style={{ width: 74, height: 74, margin: "0 auto 1.25rem", fontSize: "1.75rem" }}>
        ⤴
      </div>
      <div className="mono" style={{ fontSize: "1.15rem", textTransform: "uppercase", letterSpacing: "0.18em" }}>
        Drag your syllabus PDFs here
      </div>
      <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "1rem" }}>
        or click to queue multiple files from your local syllabus archive
      </p>
      {activeFileName ? (
        <div className="tag" style={{ margin: "1.3rem auto 0", width: "fit-content" }}>
          <span>Loaded</span>
          <strong>{activeFileName}</strong>
        </div>
      ) : null}
    </div>
  );
}

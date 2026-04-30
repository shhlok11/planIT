"use client";

interface TextRevealCardProps {
  text: string;
  revealText: string;
  caption?: string;
}

export function TextRevealCard({ text, revealText, caption }: TextRevealCardProps) {
  return (
    <div className="text-reveal-card">
      <div className="text-reveal-caption mono">{caption ?? "hover to reveal"}</div>
      <div className="text-reveal-stack">
        <div className="text-reveal-base">{text}</div>
        <div className="text-reveal-hover">{revealText}</div>
      </div>
    </div>
  );
}

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  accent?: "violet" | "cyan" | "amber" | "rose";
  style?: CSSProperties;
}

const accentMap = {
  violet: "rgba(124, 58, 237, 0.34)",
  cyan: "rgba(6, 182, 212, 0.28)",
  amber: "rgba(245, 158, 11, 0.28)",
  rose: "rgba(244, 114, 182, 0.26)",
} as const;

export function SpotlightCard({
  children,
  className,
  accent = "violet",
  style,
}: SpotlightCardProps) {
  const [pointer, setPointer] = useState({ x: 50, y: 50, active: false });

  const spotlightStyle = useMemo<CSSProperties>(
    () => ({
      "--spotlight-x": `${pointer.x}%`,
      "--spotlight-y": `${pointer.y}%`,
      "--spotlight-color": accentMap[accent],
      "--spotlight-opacity": pointer.active ? 1 : 0.72,
    }) as CSSProperties,
    [accent, pointer.active, pointer.x, pointer.y],
  );

  return (
    <div
      className={`spotlight-card ${className ?? ""}`}
      style={{ ...spotlightStyle, ...style }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setPointer({ x, y, active: true });
      }}
      onMouseLeave={() => setPointer((current) => ({ ...current, active: false }))}
    >
      {children}
    </div>
  );
}

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
  violet: {
    active: "rgba(124, 58, 237, 0.42)",
    rest: "rgba(124, 58, 237, 0.18)",
  },
  cyan: {
    active: "rgba(6, 182, 212, 0.36)",
    rest: "rgba(6, 182, 212, 0.16)",
  },
  amber: {
    active: "rgba(245, 158, 11, 0.36)",
    rest: "rgba(245, 158, 11, 0.15)",
  },
  rose: {
    active: "rgba(244, 114, 182, 0.34)",
    rest: "rgba(244, 114, 182, 0.14)",
  },
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
      "--spotlight-color": accentMap[accent][pointer.active ? "active" : "rest"],
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

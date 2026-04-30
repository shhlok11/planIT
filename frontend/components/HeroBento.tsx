"use client";

import { SpotlightCard } from "@/components/SpotlightCard";

const items = [
  {
    title: "AI Priority Scoring",
    description: "Every extracted assessment gets urgency, weight, confidence, and difficulty signals instead of a flat checklist.",
    accent: "violet" as const,
    metric: "0→100",
  },
  {
    title: "Conflict Radar",
    description: "Surface same-week collisions, 48-hour crunch windows, and high-weight overlaps before they wreck your semester.",
    accent: "rose" as const,
    metric: "48H",
  },
  {
    title: "Study Block Generator",
    description: "Turn deadlines into scheduled, reasoned work sessions using your actual available hours and study intensity.",
    accent: "cyan" as const,
    metric: "AUTO",
  },
  {
    title: "Calendar Exports",
    description: "Ship the final plan straight to `.ics` and PDF once the review layer is clean.",
    accent: "amber" as const,
    metric: "PDF + ICS",
  },
];

export function HeroBento() {
  return (
    <div className="hero-bento">
      {items.map((item, index) => (
        <SpotlightCard
          key={item.title}
          accent={item.accent}
          className={`hero-bento-card hero-bento-card-${index + 1}`}
        >
          <div className="hero-bento-metric mono">{item.metric}</div>
          <h3 className="display hero-bento-title">{item.title}</h3>
          <p className="hero-bento-copy">{item.description}</p>
        </SpotlightCard>
      ))}
    </div>
  );
}

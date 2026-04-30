"use client";

import { useEffect, useState } from "react";

interface NumberTickerProps {
  value: number;
  decimals?: number;
  suffix?: string;
}

export function NumberTicker({ value, decimals = 0, suffix = "" }: NumberTickerProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = display;
    const duration = 650;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toFixed(decimals)}{suffix}</>;
}

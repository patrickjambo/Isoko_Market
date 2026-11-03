'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated number that displays its value immediately without starting from 0,
 * and smoothly animates upward from that value as new stats arrive (e.g. from
 * poll-refresh intervals).
 */
export function CountUp({
  value,
  durationMs = 900,
  startFrom,
  suffix = '',
  prefix = '',
}: {
  value: number;
  durationMs?: number;
  startFrom?: number;
  suffix?: string;
  prefix?: string;
}) {
  const initial = startFrom ?? value;
  const [display, setDisplay] = useState(initial);
  const fromRef = useRef(initial);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast then settles
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      fromRef.current = current;
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </>
  );
}

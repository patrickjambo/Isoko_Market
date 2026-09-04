'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated number that tweens from its previously shown value to the new one.
 * On first mount it counts up from zero; on every later render (e.g. a
 * poll-refresh brings a higher stat) it animates from the last displayed value,
 * so the homepage visibly "ticks" as new listings/orders land — no page reload.
 */
export function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0); // value currently on screen — the tween's starting point

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

  return <>{display.toLocaleString()}</>;
}

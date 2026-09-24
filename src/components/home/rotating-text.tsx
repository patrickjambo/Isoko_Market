'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Cycles through short phrases with a fade+rise — a looping headline that keeps
 * the hero copy punchy instead of one long fixed block. Respects reduced-motion
 * (the base transition rule disables the animation, so it just swaps).
 */
export function RotatingText({ phrases, className }: { phrases: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (phrases.length <= 1) return;
    const id = setInterval(() => {
      setShow(false); // fade out
      setTimeout(() => {
        setI((p) => (p + 1) % phrases.length);
        setShow(true); // fade the next one in
      }, 300);
    }, 2800);
    return () => clearInterval(id);
  }, [phrases.length]);

  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-block transition-all duration-300 ease-out',
        show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}
    >
      {phrases[i]}
    </span>
  );
}

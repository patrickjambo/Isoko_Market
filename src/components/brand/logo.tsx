import { cn } from '@/lib/utils';

/**
 * Isoko Market wordmark + house/marketplace glyph.
 * Deep teal roof (trust) with a warm-orange market awning (commerce),
 * echoing the proposal's logo direction (Section 8.1).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('h-8 w-8', className)}
      role="img"
      aria-label="Isoko Market"
      fill="none"
    >
      <rect width="40" height="40" rx="10" fill="hsl(176 84% 22%)" />
      {/* roof */}
      <path d="M8 19 L20 9 L32 19" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* awning stripes */}
      <path d="M11 20 h18 v3.2 h-18 z" fill="hsl(24 92% 55%)" />
      <path d="M11 23.2 v7.2 h18 v-7.2" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
      {/* door */}
      <path d="M17.5 30.4 v-4.4 a2.5 2.5 0 0 1 5 0 v4.4" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {showText && (
        <span className="text-lg font-extrabold tracking-tight text-foreground">
          Isoko<span className="text-accent">Market</span>
        </span>
      )}
    </span>
  );
}

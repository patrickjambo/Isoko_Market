import type { LucideIcon } from 'lucide-react';

/**
 * Consistent, polished page header used across list/landing pages: an
 * accent-tinted icon tile, an optional uppercase eyebrow (matching the home
 * page's kicker language), a bold title + subtitle, and an optional action on
 * the right. A hairline rule anchors the section. Presentation only.
 */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary shadow-sm">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div>
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

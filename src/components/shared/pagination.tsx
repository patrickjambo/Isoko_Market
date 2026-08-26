import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Server-friendly pagination — plain links so it works without client JS. */
export function Pagination({
  page,
  total,
  pageSize,
  baseParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  baseParams: Record<string, string | undefined>;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v) sp.set(k, v);
    }
    sp.set('page', String(p));
    return `?${sp.toString()}`;
  };

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <PageLink href={buildHref(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous">
        <ChevronLeft className="h-4 w-4" />
      </PageLink>
      {Array.from({ length: pages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
        .map((p, idx, arr) => (
          <span key={p} className="flex items-center">
            {idx > 0 && arr[idx - 1] !== p - 1 && (
              <span className="px-1 text-muted-foreground">…</span>
            )}
            <PageLink href={buildHref(p)} active={p === page}>
              {p}
            </PageLink>
          </span>
        ))}
      <PageLink
        href={buildHref(Math.min(pages, page + 1))}
        disabled={page >= pages}
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...props
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  if (disabled) {
    return (
      <span className="flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-sm text-muted-foreground/40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        'flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-secondary'
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

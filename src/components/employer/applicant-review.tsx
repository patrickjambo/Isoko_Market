'use client';

import { useMemo, useState } from 'react';
import {
  Star,
  Check,
  X,
  FileText,
  MessageCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrustBadge } from '@/components/trust/trust-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { CvPreview } from '@/components/cv/cv-preview';
import { cvDataSchema, type CvData } from '@/lib/validators/cv';
import type { ApplicantItem } from '@/lib/employer-applicants';
import { initials, timeAgo } from '@/lib/utils';

type Sort = 'match' | 'newest' | 'verified';

/**
 * Scan-fast applicant triage (§4): match-scored, sortable/filterable cards with
 * inline Shortlist / View CV / Message / Reject — no separate page for routine
 * triage. Hiring flows through the shared status API (cascade fires on hire).
 */
export function ApplicantReview({
  applicants,
  locale,
  showJob = false,
}: {
  applicants: ApplicantItem[];
  locale: string;
  showJob?: boolean;
}) {
  const t = useTranslations('employer');
  const ts = useTranslations('jobs.status');
  const tcv = useTranslations('cv');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [sort, setSort] = useState<Sort>('match');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cv, setCv] = useState<ApplicantItem | null>(null);
  // Optimistic status overrides so a triaged card updates instantly.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const view = useMemo(() => {
    let list = applicants.map((a) => ({ ...a, status: (overrides[a.id] as ApplicantItem['status']) ?? a.status }));
    if (verifiedOnly) list = list.filter((a) => a.verified);
    list.sort((a, b) => {
      if (sort === 'newest') return b.appliedAt.localeCompare(a.appliedAt);
      if (sort === 'verified') return Number(b.verified) - Number(a.verified) || b.match.score - a.match.score;
      return b.match.score - a.match.score || b.appliedAt.localeCompare(a.appliedAt);
    });
    return list;
  }, [applicants, sort, verifiedOnly, overrides]);

  async function setStatus(a: ApplicantItem, status: string) {
    // Hiring is significant and hard to reverse (closes the job, fills the rest) —
    // confirm first. Other transitions (shortlist/reject) are cheap and instant.
    if (status === 'HIRED' && !window.confirm(t('hireConfirm', { name: a.name }))) return;
    setBusy(a.id);
    try {
      const res = await fetch(`/api/applications/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setOverrides((o) => ({ ...o, [a.id]: status }));
      toast(ts(status), 'success');
      if (status === 'HIRED') router.refresh(); // cascade closed the job
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function message(a: ApplicantItem) {
    setBusy(a.id);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: a.jobId, recipientId: a.applicantId, body: t('messageStarter') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      router.push(`/messages/${data.data?.conversationId ?? data.conversationId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
      setBusy(null);
    }
  }

  const matchLabel = (tier: string) =>
    tier === 'strong' ? t('matchStrong') : tier === 'good' ? t('matchGood') : null;

  return (
    <div className="space-y-3">
      {/* Sort / filter (§4) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 w-auto text-sm"
          aria-label={t('sortBy')}
        >
          <option value="match">{t('sortMatch')}</option>
          <option value="newest">{t('sortNewest')}</option>
          <option value="verified">{t('sortVerified')}</option>
        </Select>
        <Button
          type="button"
          variant={verifiedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVerifiedOnly((v) => !v)}
        >
          <ShieldCheck className="h-4 w-4" /> {t('verifiedOnly')}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {t('applicantCount', { count: view.length })}
        </span>
      </div>

      <ul className="space-y-2.5">
        {view.map((a) => {
          const ml = matchLabel(a.match.tier);
          const isBusy = busy === a.id;
          const terminal = a.status === 'HIRED' || a.status === 'REJECTED' || a.status === 'POSITION_FILLED';
          return (
            <li key={a.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11">
                  {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.name} />}
                  <AvatarFallback>{initials(a.name)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">{a.name}</span>
                    {a.verified && <TrustBadge variant="profile" status="VERIFIED" verifiedLabel="" />}
                    {ml && (
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (a.match.tier === 'strong' ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent-foreground')
                        }
                      >
                        <Sparkles className="h-3 w-3" /> {ml}
                      </span>
                    )}
                    <Badge variant="muted">{ts(a.status)}</Badge>
                  </div>
                  {showJob && <p className="truncate text-xs text-muted-foreground">{a.jobTitle}</p>}
                  {a.summary && <p className="truncate text-sm text-muted-foreground">{a.summary}</p>}
                  {a.match.overlap.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-success">
                      {t('sharedSkills', { skills: a.match.overlap.join(', ') })}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(new Date(a.appliedAt), locale)}</p>
                </div>
              </div>

              {/* Inline triage actions */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setCv(a)} disabled={isBusy}>
                  <FileText className="h-4 w-4" /> {t('viewCv')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => message(a)} disabled={isBusy}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  {t('message')}
                </Button>
                {!terminal && (
                  <>
                    <Button
                      size="sm"
                      variant={a.status === 'SHORTLISTED' ? 'default' : 'outline'}
                      onClick={() => setStatus(a, 'SHORTLISTED')}
                      disabled={isBusy}
                    >
                      <Star className="h-4 w-4" /> {t('shortlist')}
                    </Button>
                    <Button size="sm" variant="accent" onClick={() => setStatus(a, 'HIRED')} disabled={isBusy}>
                      <CheckCircle2 className="h-4 w-4" /> {t('hire')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setStatus(a, 'REJECTED')}
                      disabled={isBusy}
                    >
                      <X className="h-4 w-4" /> {t('reject')}
                    </Button>
                  </>
                )}
                {a.status === 'HIRED' && (
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-success">
                    <Check className="h-4 w-4" /> {ts('HIRED')}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Full CV — same renderer the seeker sees, from the immutable snapshot */}
      <Dialog open={!!cv} onOpenChange={(o) => !o && setCv(null)}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cv?.name}</DialogTitle>
          </DialogHeader>
          {cv?.snapshot ? (
            <>
              <div className="flex justify-end">
                {/* Static, immutable snapshot — a plain download link, no save race */}
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/applications/${cv.id}/cv/pdf`} download>
                    <Download className="h-4 w-4" /> {tcv('downloadPdf')}
                  </a>
                </Button>
              </div>
              <CvPreview data={normalizeCv(cv.snapshot)} fullName={cv.name} />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noCvSnapshot')}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Normalize any (possibly legacy/partial) snapshot into the current CvData
 *  shape via the schema, so old and new snapshots both render. */
function normalizeCv(s: unknown): CvData {
  const parsed = cvDataSchema.safeParse(s ?? {});
  return parsed.success ? parsed.data : cvDataSchema.parse({});
}

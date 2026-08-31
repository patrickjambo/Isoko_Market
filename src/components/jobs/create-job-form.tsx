'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Plus, Lightbulb } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { SkillPicker } from '@/components/jobs/skill-picker';
import { ContactFields } from '@/components/shared/contact-fields';
import { suggestSkillsFromText, draftJobDescription, labelForSkill } from '@/lib/skills';
import type { ContactChannels } from '@/lib/contact';

/**
 * Post-a-Job form (§3). A single mobile-first screen with the same assists as
 * the seller flow — title autocomplete, auto-suggested skills, a pay hint from
 * comparable postings, and a one-tap description draft — so posting stays under
 * 90 seconds (DoD §1) and feels like one consistent platform tool.
 */
export function CreateJobForm({ partners = [] }: { partners?: { id: string; name: string }[] }) {
  const t = useTranslations('jobs');
  const te = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'JOB' | 'GIG'>('JOB');
  const [location, setLocation] = useState('');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [payPeriod, setPayPeriod] = useState('month');
  const [contact, setContact] = useState<ContactChannels>({});
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [partnerId, setPartnerId] = useState('');

  // Title autocomplete (job context — converges with seeker search vocabulary).
  const [titleSug, setTitleSug] = useState<{ value: string }[]>([]);
  const [titleOpen, setTitleOpen] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchTitles = useCallback(
    (q: string) => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(async () => {
        if (q.trim().length < 2) return setTitleSug([]);
        try {
          const res = await fetch(`/api/suggestions/titles?context=job&q=${encodeURIComponent(q)}&locale=${locale}`);
          if (!res.ok) return setTitleSug([]);
          const j = await res.json();
          setTitleSug((j.data?.suggestions ?? j.suggestions ?? []) as { value: string }[]);
          setTitleOpen(true);
        } catch {
          setTitleSug([]);
        }
      }, 250);
    },
    [locale]
  );

  // Auto-suggested required skills from the title (tap to confirm — §3 Step 2).
  const suggestedSkills = suggestSkillsFromText(title).filter((k) => !skills.includes(k));

  // Pay hint from comparable postings (§3 Step 3) — never auto-fills the field.
  const [payHint, setPayHint] = useState<{ min: number; max: number } | null>(null);
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggestions/job-pay?type=${type}&location=${encodeURIComponent(location)}`);
        if (!res.ok) return setPayHint(null);
        const j = await res.json();
        const d = j.data ?? j;
        setPayHint(d?.min != null && d?.max != null ? { min: d.min, max: d.max } : null);
      } catch {
        setPayHint(null);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [type, location]);

  function payString(): string | undefined {
    if (!payMin && !payMax) return undefined;
    const range = payMin && payMax && payMin !== payMax ? `${payMin}–${payMax}` : payMin || payMax;
    return `${range} RWF/${t(`form.period${cap(payPeriod)}`)}`;
  }

  function draft() {
    setDescription(draftJobDescription({ title, type, skills, location, pay: payString(), locale }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          type,
          payMin: payMin ? Number(payMin) : null,
          payMax: payMax ? Number(payMax) : null,
          payPeriod,
          location,
          contactInfo: contact,
          skills,
          partnerId: partnerId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.fields) setErrors(data.error.fields);
        throw new Error(data.error?.message ?? te('generic'));
      }
      toast(t('form.publish'), 'success');
      router.push(`/jobs/${data.data?.id ?? data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : te('generic'), 'error');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Type — reshapes the rest (§3 Step 1) */}
      <Field label={t('form.typeLabel')}>
        <div className="grid grid-cols-2 gap-2">
          {(['JOB', 'GIG'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setType(v)}
              className={
                'rounded-xl border p-3 text-left text-sm transition-colors ' +
                (type === v ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-secondary')
              }
            >
              <span className="font-semibold">{v === 'GIG' ? t('typeGig') : t('typeJob')}</span>
              <span className="block text-xs text-muted-foreground">
                {v === 'GIG' ? t('form.gigHint') : t('form.jobHint')}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {/* Title with autocomplete (§3 Step 2) */}
      <Field label={t('form.titleLabel')} error={errors.title}>
        <div className="relative">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              searchTitles(e.target.value);
            }}
            onFocus={() => titleSug.length && setTitleOpen(true)}
            onBlur={() => setTimeout(() => setTitleOpen(false), 150)}
            placeholder={t('form.titlePlaceholder')}
            required
          />
          {titleOpen && titleSug.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
              {titleSug.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTitle(s.value);
                      setTitleOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> {s.value}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {/* Skills — auto-suggested from title, tap to confirm (§3 Step 2) */}
      <Field label={t('form.skillsLabel')}>
        <SkillPicker value={skills} onChange={setSkills} placeholder={t('form.skillsPlaceholder')} max={20} />
        {suggestedSkills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t('form.suggestedSkills')}</span>
            {suggestedSkills.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSkills((s) => [...s, k])}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/5"
              >
                <Plus className="h-3 w-3" /> {labelForSkill(k, locale)}
              </button>
            ))}
          </div>
        )}
      </Field>

      {/* Pay & duration (§3 Step 3) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('form.payMinLabel')}>
          <Input value={payMin} onChange={(e) => setPayMin(e.target.value)} type="number" inputMode="numeric" min={0} />
        </Field>
        <Field label={t('form.payMaxLabel')} error={errors.payMax}>
          <Input value={payMax} onChange={(e) => setPayMax(e.target.value)} type="number" inputMode="numeric" min={0} />
        </Field>
        <Field label={t('form.payPeriodLabel')}>
          <Select value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)}>
            <option value="hour">{t('form.periodHour')}</option>
            <option value="day">{t('form.periodDay')}</option>
            <option value="month">{t('form.periodMonth')}</option>
            <option value="fixed">{t('form.periodFixed')}</option>
          </Select>
        </Field>
      </div>
      {payHint && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-accent" />
          {t('form.payHint', { min: payHint.min.toLocaleString(), max: payHint.max.toLocaleString() })}
        </p>
      )}

      {/* Location (§3 Step 4) */}
      <Field label={t('form.locationLabel')} error={errors.location}>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kigali" required />
      </Field>

      <ContactFields value={contact} onChange={setContact} />

      {/* Description with one-tap draft (§3 Step 5) */}
      <Field label={t('form.descriptionLabel')} error={errors.description}>
        <div className="mb-1.5 flex justify-end">
          {title.trim() && (
            <button
              type="button"
              onClick={draft}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" /> {t('form.suggestDescription')}
            </button>
          )}
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('form.descriptionPlaceholder')}
          rows={6}
          required
        />
      </Field>

      {partners.length > 0 && (
        <Field label={t('form.partnerLabel')}>
          <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">{t('form.partnerNone')}</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? t('form.publishing') : t('form.publish')}
      </Button>
    </form>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

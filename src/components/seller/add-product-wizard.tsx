'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Camera,
  Sparkles,
  Check,
  Tag as TagIcon,
  CircleAlert,
  MapPin,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ImageUploader } from '@/components/shared/image-uploader';
import { ContactFields } from '@/components/shared/contact-fields';
import type { ContactChannels } from '@/lib/contact';
import { useToast } from '@/components/ui/toast';
import { listingConditions } from '@/lib/validators/listing';
import { RWANDA_DISTRICTS } from '@/lib/rwanda';
import { formatRWF, cn } from '@/lib/utils';

type Category = { id: string; name: string };
type ListingKind = 'PRODUCT' | 'SERVICE';
type Data = {
  images: string[];
  title: string;
  categoryId: string;
  kind: ListingKind;
  condition: string;
  location: string;
  price: number | '';
  description: string;
  tags: string[];
  showPhone: boolean;
  contact: ContactChannels;
};

const EMPTY: Data = {
  images: [],
  title: '',
  categoryId: '',
  kind: 'PRODUCT',
  condition: 'GOOD',
  location: '',
  price: '',
  description: '',
  tags: [],
  showPhone: false,
  contact: {},
};

const TOTAL = 6;

export function AddProductWizard({
  categories,
  kind = 'PRODUCT',
}: {
  categories: Category[];
  kind?: ListingKind;
}) {
  const t = useTranslations('sell');
  const tc = useTranslations('marketplace');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const isService = kind === 'SERVICE';
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Data>({ ...EMPTY, kind });
  const [loaded, setLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);

  // Load an existing draft to resume where the seller left off.
  useEffect(() => {
    fetch('/api/seller/draft')
      .then((r) => r.json())
      .then((j) => {
        if (j?.draft?.data) {
          // The URL intent (product vs service) wins over whatever the draft had.
          setData({ ...EMPTY, ...j.draft.data, kind });
          setStep(j.draft.step ?? 1);
        }
      })
      .finally(() => setLoaded(true));
    // `kind` is a stable prop from the URL; included to satisfy exhaustive-deps.
  }, [kind]);

  // Autosave (debounced) at every change so nothing is lost on a dropped connection.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch('/api/seller/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { ...data, price: data.price === '' ? null : data.price }, step }),
      });
    }, 700);
  }, [data, step, loaded]);

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setData((d) => ({ ...d, [k]: v }));

  const categoryName = categories.find((c) => c.id === data.categoryId)?.name;

  async function publish(force = false) {
    setPublishing(true);
    setDuplicate(null);
    try {
      const res = await fetch(`/api/seller/listings${force ? '?force=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          price: Number(data.price || 0),
          categoryId: data.categoryId || null,
          kind: data.kind,
          condition: data.condition,
          location: data.location,
          images: data.images,
          tags: data.tags,
          showPhone: data.showPhone,
          contactInfo: data.contact,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'error');
      if (j.duplicate) {
        setDuplicate(j.duplicate);
        return;
      }
      toast(t('published'), 'success');
      router.push(`/marketplace/${j.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setPublishing(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const canNext =
    (step === 1 && data.images.length > 0) ||
    (step === 2 && data.title.trim().length >= 3) ||
    (step === 3 && !!data.categoryId && data.price !== '') ||
    step === 4 ||
    (step === 5 && data.location.trim().length >= 2) ||
    step === 6;

  return (
    <div className="mx-auto max-w-lg">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('stepOf', { step, total: TOTAL })}</span>
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="h-3 w-3" /> {t('autosaved')}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <Step
          title={isService ? t('service1Title') : t('step1Title')}
          hint={isService ? t('service1Hint') : t('step1Hint')}
        >
          <ImageUploader value={data.images} onChange={(v) => set('images', v)} max={6} />
          {data.images.length === 0 && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Camera className="h-4 w-4" /> {isService ? t('servicePhotoNudge') : t('photoNudge')}
            </p>
          )}
        </Step>
      )}

      {step === 2 && (
        <Step title={t('step2Title')} hint={t('step2Hint')}>
          <TitleAutocomplete
            value={data.title}
            onChange={(v) => set('title', v)}
            onPickCategory={(name) => {
              const match = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
              if (match) set('categoryId', match.id);
            }}
            locale={locale}
            placeholder={t('titlePlaceholder')}
          />
        </Step>
      )}

      {step === 3 && (
        <Step title={t('step3Title')} hint={t('step3Hint')}>
          <div className="space-y-1.5">
            <Label>{tc('form.categoryLabel')}</Label>
            <Select value={data.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          {/* Condition is meaningless for a service — hide it entirely. */}
          {!isService && (
            <div className="space-y-1.5">
              <Label>{tc('condition')}</Label>
              <div className="flex flex-wrap gap-2">
                {listingConditions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('condition', c)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      data.condition === c
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {tc(`condition.${c}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <PriceField
            serviceLabel={isService ? t('servicePriceLabel') : undefined}
            value={data.price}
            onChange={(v) => set('price', v)}
            categoryId={data.categoryId}
            location={data.location}
            locale={locale}
          />

          {data.categoryId && (
            <TagField categoryId={data.categoryId} tags={data.tags} onChange={(v) => set('tags', v)} />
          )}
        </Step>
      )}

      {step === 4 && (
        <Step title={t('step4Title')} hint={t('step4Hint')}>
          <SuggestDescription data={data} categoryName={categoryName} onDraft={(d) => set('description', d)} />
          <Textarea
            value={data.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{t('charCount', { count: data.description.length })}</p>
        </Step>
      )}

      {step === 5 && (
        <Step title={t('step5Title')} hint={t('step5Hint')}>
          <div className="space-y-1.5">
            <Label>{tc('form.locationLabel')}</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                list="rw-districts"
                value={data.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Kigali, Nyarugenge"
                className="pl-9"
              />
              <datalist id="rw-districts">
                {RWANDA_DISTRICTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={data.showPhone}
              onChange={(e) => set('showPhone', e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary"
            />
            {t('showPhone')}
          </label>
          <p className="text-xs text-muted-foreground">
            {data.showPhone ? t('showPhoneOn') : t('showPhoneOff')}
          </p>

          <ContactFields value={data.contact} onChange={(v) => set('contact', v)} />
        </Step>
      )}

      {step === 6 && (
        <Step title={t('step6Title')} hint={t('step6Hint')}>
          <Review data={data} categoryName={categoryName} locale={locale} isService={isService} conditionLabel={(c) => tc(`condition.${c}`)} />
          {duplicate && (
            <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <p>{t('duplicateWarning', { title: duplicate.title })}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => router.push(`/marketplace/${duplicate.id}`)}>
                    {t('updateInstead')}
                  </Button>
                  <Button size="sm" onClick={() => publish(true)} disabled={publishing}>
                    {t('publishAnyway')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Step>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" /> {t('back')}
          </Button>
        ) : (
          <span />
        )}
        {step < TOTAL ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {t('next')} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="accent" onClick={() => publish(false)} disabled={publishing || !data.title || !data.categoryId}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t('publish')}
          </Button>
        )}
      </div>
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function TitleAutocomplete({
  value,
  onChange,
  onPickCategory,
  locale,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickCategory: (name: string) => void;
  locale: string;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<{ value: string; type: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (q.trim().length < 2) return setSuggestions([]);
        const res = await fetch(`/api/suggestions/titles?q=${encodeURIComponent(q)}&locale=${locale}`);
        const j = await res.json();
        setSuggestions(j.suggestions ?? []);
        setOpen(true);
      }, 250);
    },
    [locale]
  );

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoFocus
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {suggestions.map((s) => (
            <li key={s.value + s.type}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.value);
                  if (s.type === 'category') onPickCategory(s.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                {s.type === 'category' ? (
                  <TagIcon className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {s.value}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PriceField({
  value,
  onChange,
  categoryId,
  location,
  locale,
  serviceLabel,
}: {
  value: number | '';
  onChange: (v: number | '') => void;
  categoryId: string;
  location: string;
  locale: string;
  serviceLabel?: string;
}) {
  const t = useTranslations('sell');
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    if (!categoryId) return setRange(null);
    const sp = new URLSearchParams({ category: categoryId });
    if (location) sp.set('location', location);
    fetch(`/api/suggestions/price?${sp}`)
      .then((r) => r.json())
      .then((j) => (j.count >= 2 && j.min != null ? setRange({ min: j.min, max: j.max }) : setRange(null)));
  }, [categoryId, location]);

  return (
    <div className="space-y-1.5">
      <Label>{serviceLabel ?? t('priceLabel')}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="0"
      />
      {range && (
        <p className="text-xs text-primary">
          {t('priceHint', {
            range: `${formatRWF(range.min * 100, locale)} – ${formatRWF(range.max * 100, locale)}`,
          })}
        </p>
      )}
    </div>
  );
}

function TagField({
  categoryId,
  tags,
  onChange,
}: {
  categoryId: string;
  tags: string[];
  onChange: (v: string[]) => void;
}) {
  const t = useTranslations('sell');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/suggestions/tags?category=${categoryId}`)
      .then((r) => r.json())
      .then((j) => setSuggestions(j.tags ?? []));
  }, [categoryId]);

  const toggle = (tag: string) =>
    onChange(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag]);

  if (suggestions.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Label>{t('tagsLabel')}</Label>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              tags.includes(tag)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input text-muted-foreground hover:bg-secondary'
            )}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function SuggestDescription({
  data,
  categoryName,
  onDraft,
}: {
  data: Data;
  categoryName?: string;
  onDraft: (d: string) => void;
}) {
  const t = useTranslations('sell');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function suggest() {
    setLoading(true);
    try {
      const res = await fetch('/api/suggestions/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          category: categoryName,
          condition: data.condition,
          location: data.location,
          tags: data.tags,
          locale,
        }),
      });
      const j = await res.json();
      if (j.description) onDraft(j.description);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={suggest} disabled={loading || !data.title}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {t('suggestDescription')}
    </Button>
  );
}

function Review({
  data,
  categoryName,
  locale,
  isService,
  conditionLabel,
}: {
  data: Data;
  categoryName?: string;
  locale: string;
  isService: boolean;
  conditionLabel: (c: string) => string;
}) {
  const t = useTranslations('sell');
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {data.images[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.images[0]} alt="" className="h-40 w-full rounded-lg object-cover" />
      )}
      <div>
        <p className="text-lg font-bold text-primary">
          {data.price !== '' ? formatRWF(Number(data.price) * 100, locale) : '—'}
        </p>
        <p className="font-semibold">{data.title || '—'}</p>
        <p className="text-sm text-muted-foreground">
          {[categoryName, isService ? null : conditionLabel(data.condition), data.location]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {data.description && <p className="whitespace-pre-wrap text-sm">{data.description}</p>}
      {data.tags.length > 0 && (
        <p className="text-xs text-muted-foreground">{data.tags.join(' · ')}</p>
      )}
      <p className="text-xs text-muted-foreground">{t('reviewNote')}</p>
    </div>
  );
}

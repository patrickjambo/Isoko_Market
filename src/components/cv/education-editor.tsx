'use client';

import { useCallback, useState } from 'react';
import { Plus, Trash2, Upload, Check, Loader2, FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { RefAutocomplete, type RefOption } from '@/components/cv/ref-autocomplete';
import { EDUCATION_LEVELS, DEGREE_CLASSES, type Education } from '@/lib/validators/cv';

const UNIVERSITY_LEVELS = new Set(['bachelor', 'masters', 'phd']);
const instTypeFor = (level: string) =>
  level === 'tvet' ? 'tvet' : UNIVERSITY_LEVELS.has(level) ? 'university' : 'secondary_school';

const YEARS = Array.from({ length: 60 }, (_, i) => String(new Date().getFullYear() + 2 - i));

/**
 * Rebuilt Education step (spec Part 4): one guided, repeatable block per level.
 * Every text field is autocomplete-backed by a seeded reference table; the only
 * free-text is the explicit "add new" fallback. University→Faculty cascades
 * (disabled until an institution is picked). Degree classification + faculty are
 * shown for Bachelor's+; combination for Secondary; trade for TVET.
 */
export function EducationEditor({
  value,
  onChange,
}: {
  value: Education[];
  onChange: (entries: Education[]) => void;
}) {
  const t = useTranslations('cv');
  const locale = useLocale();

  function add() {
    onChange([
      ...value,
      {
        level: 'secondary',
        institutionId: '',
        institutionName: '',
        facultyId: '',
        facultyName: '',
        combinationId: '',
        combinationName: '',
        degreeClassification: null,
        startYear: '',
        endYear: '',
        certificateUrl: '',
      },
    ]);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function patch(i: number, changes: Partial<Education>) {
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...changes } : e)));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('education')}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> {t('addEducation')}
        </Button>
      </div>

      {value.map((entry, i) => (
        <EducationEntry
          key={i}
          entry={entry}
          locale={locale}
          onPatch={(c) => patch(i, c)}
          onRemove={() => remove(i)}
        />
      ))}
    </section>
  );
}

function EducationEntry({
  entry,
  locale,
  onPatch,
  onRemove,
}: {
  entry: Education;
  locale: string;
  onPatch: (changes: Partial<Education>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('cv');
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const level = entry.level ?? 'secondary';
  const instType = instTypeFor(level);
  const isUni = UNIVERSITY_LEVELS.has(level);
  const isSecondary = level === 'secondary';
  const isTvet = level === 'tvet';

  // Reference fetchers (shared endpoints).
  const fetchInstitutions = useCallback(
    async (q: string): Promise<RefOption[]> => {
      const res = await fetch(`/api/suggestions/institutions?type=${instType}&q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const j = await res.json();
      const rows = (j.data?.institutions ?? j.institutions ?? []) as { id: string; name: string }[];
      return rows.map((r) => ({ id: r.id, label: r.name }));
    },
    [instType]
  );
  const addInstitution = useCallback(
    async (name: string): Promise<RefOption> => {
      const res = await fetch('/api/suggestions/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: instType }),
      });
      const j = await res.json();
      const d = j.data ?? j;
      return { id: d.id, label: d.name };
    },
    [instType]
  );
  const fetchCombinations = useCallback(
    async (q: string): Promise<RefOption[]> => {
      const kind = isTvet ? 'tvet' : 'alevel';
      const res = await fetch(`/api/suggestions/combinations?kind=${kind}&locale=${locale}&q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const j = await res.json();
      const rows = (j.data?.combinations ?? j.combinations ?? []) as { id: string; label: string }[];
      return rows.map((r) => ({ id: r.id, label: r.label }));
    },
    [isTvet, locale]
  );
  const fetchFaculties = useCallback(
    async (q: string): Promise<RefOption[]> => {
      if (!entry.institutionId) return [];
      const res = await fetch(
        `/api/suggestions/faculties?universityId=${entry.institutionId}&locale=${locale}&q=${encodeURIComponent(q)}`
      );
      if (!res.ok) return [];
      const j = await res.json();
      const rows = (j.data?.faculties ?? j.faculties ?? []) as { id: string; label: string }[];
      return rows.map((r) => ({ id: r.id, label: r.label }));
    },
    [entry.institutionId, locale]
  );

  async function uploadCertificate(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('private', 'true'); // certificates get the same private/signed-URL handling as IDs
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'upload failed');
      onPatch({ certificateUrl: (j.data ?? j).url });
      toast(t('certUploaded'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('certFailed'), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex justify-end">
        <button type="button" onClick={onRemove} aria-label={t('remove')} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Level chips */}
      <div className="flex flex-wrap gap-1.5">
        {EDUCATION_LEVELS.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() =>
              onPatch({
                level: lvl,
                // Reset level-dependent fields on level change.
                institutionId: '',
                institutionName: '',
                facultyId: '',
                facultyName: '',
                combinationId: '',
                combinationName: '',
                degreeClassification: null,
              })
            }
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              level === lvl ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
            )}
          >
            {t(`eduLevel_${lvl}`)}
          </button>
        ))}
      </div>

      {/* Institution */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t('institution')}</Label>
        <RefAutocomplete
          value={entry.institutionId ? { id: entry.institutionId, label: entry.institutionName ?? '' } : null}
          onChange={(o) =>
            onPatch({ institutionId: o?.id ?? '', institutionName: o?.label ?? '', facultyId: '', facultyName: '' })
          }
          fetchOptions={fetchInstitutions}
          onAdd={addInstitution}
          placeholder={t('institutionPlaceholder')}
        />
      </div>

      {/* Secondary → combination */}
      {isSecondary && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('combination')}</Label>
          <RefAutocomplete
            value={entry.combinationId ? { id: entry.combinationId, label: entry.combinationName ?? '' } : null}
            onChange={(o) => onPatch({ combinationId: o?.id ?? '', combinationName: o?.label ?? '' })}
            fetchOptions={fetchCombinations}
            placeholder={t('combinationPlaceholder')}
          />
        </div>
      )}

      {/* TVET → trade */}
      {isTvet && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('trade')}</Label>
          <RefAutocomplete
            value={entry.combinationId ? { id: entry.combinationId, label: entry.combinationName ?? '' } : null}
            onChange={(o) => onPatch({ combinationId: o?.id ?? '', combinationName: o?.label ?? '' })}
            fetchOptions={fetchCombinations}
            placeholder={t('tradePlaceholder')}
          />
        </div>
      )}

      {/* University → faculty (cascade) + degree classification */}
      {isUni && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('faculty')}</Label>
            <RefAutocomplete
              value={entry.facultyId ? { id: entry.facultyId, label: entry.facultyName ?? '' } : null}
              onChange={(o) => onPatch({ facultyId: o?.id ?? '', facultyName: o?.label ?? '' })}
              fetchOptions={fetchFaculties}
              placeholder={t('facultyPlaceholder')}
              disabled={!entry.institutionId}
              disabledHint={t('pickInstitutionFirst')}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('degreeClass')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DEGREE_CLASSES.map((dc) => (
                <button
                  key={dc}
                  type="button"
                  onClick={() => onPatch({ degreeClassification: entry.degreeClassification === dc ? null : dc })}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    entry.degreeClassification === dc
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {t(`degree_${dc}`)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Years */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('startYear')}</Label>
          <Select value={entry.startYear ?? ''} onChange={(e) => onPatch({ startYear: e.target.value })}>
            <option value="">—</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('endYear')}</Label>
          <Select value={entry.endYear ?? ''} onChange={(e) => onPatch({ endYear: e.target.value })}>
            <option value="">{t('present')}</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Certificate upload */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t('certificate')}</Label>
        {entry.certificateUrl ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-success">
              <Check className="h-4 w-4" /> {t('certAttached')}
            </span>
            <a href={entry.certificateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <FileText className="h-4 w-4" /> {t('view')}
            </a>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-secondary/40">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? t('uploading') : t('certUpload')}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadCertificate(f);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

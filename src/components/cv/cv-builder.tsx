'use client';

import { useState } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Download,
  Save,
  Sparkles,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Upload,
  Check,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import type { CvData } from '@/lib/validators/cv';
import { SkillPicker, type SkillLevel } from '@/components/jobs/skill-picker';
import { EducationEditor } from '@/components/cv/education-editor';
import { LanguagePicker } from '@/components/cv/language-picker';
import { LocationPicker } from '@/components/cv/location-picker';
import { draftExperience } from '@/lib/skills';
import {
  calculateCvCompleteness,
  draftSummary,
  getSampleCv,
  POPULAR_ROLES,
} from '@/lib/cv-assist';
import { cn } from '@/lib/utils';
import { CvPreview } from './cv-preview';

const EMPTY: CvData = {
  headline: '',
  summary: '',
  contactEmail: '',
  portfolioUrl: '',
  dateOfBirth: '',
  nationality: '',
  gender: '',
  drivingLicense: '',
  education: [],
  experience: [],
  skills: [],
  skillLevels: {},
  languages: [],
  certifications: [],
  references: [],
  location: null,
};

export type CvListItem = {
  id: string;
  name: string;
  updatedAt: string;
};

export function CvBuilder({
  initial,
  fullName,
  cvId: initialCvId = null,
  name: initialName = 'My CV',
  cvList = [],
  onSaveSuccess,
}: {
  initial: CvData | null;
  fullName: string;
  /** The CV being edited; null = create on first save. */
  cvId?: string | null;
  name?: string;
  cvList?: CvListItem[];
  onSaveSuccess?: () => void;
}) {
  const t = useTranslations('cv');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<CvData>(initial ? { ...EMPTY, ...initial } : EMPTY);
  const [cvId, setCvId] = useState<string | null>(initialCvId);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingCertIndex, setUploadingCertIndex] = useState<number | null>(null);
  const [switchingCv, setSwitchingCv] = useState(false);

  const completeness = calculateCvCompleteness(data);

  function set<K extends keyof CvData>(key: K, value: CvData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleBlur(field: 'headline' | 'contactEmail' | 'summary') {
    if (field === 'headline') {
      if (!data.headline?.trim() || data.headline.trim().length < 3) {
        setErrors((prev) => ({ ...prev, headline: t('reqHeadline') }));
      }
    } else if (field === 'contactEmail') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!data.contactEmail?.trim()) {
        setErrors((prev) => ({ ...prev, contactEmail: t('reqEmail') }));
      } else if (!emailRegex.test(data.contactEmail.trim())) {
        setErrors((prev) => ({ ...prev, contactEmail: t('reqEmailInvalid') }));
      }
    } else if (field === 'summary') {
      if (!data.summary?.trim() || data.summary.trim().length < 10) {
        setErrors((prev) => ({ ...prev, summary: t('reqSummary') }));
      }
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!data.headline?.trim() || data.headline.trim().length < 3) {
      errs.headline = t('reqHeadline');
    }

    if (!data.skills || data.skills.length === 0) {
      errs.skills = t('reqSkills');
    }

    if (!data.summary?.trim() || data.summary.trim().length < 10) {
      errs.summary = t('reqSummary');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.contactEmail?.trim()) {
      errs.contactEmail = t('reqEmail');
    } else if (!emailRegex.test(data.contactEmail.trim())) {
      errs.contactEmail = t('reqEmailInvalid');
    }

    if (!data.location?.id && !data.location?.label) {
      errs.location = t('reqLocation');
    }

    // Check individual experience entries
    data.experience.forEach((exp, i) => {
      if (!exp.position?.trim()) {
        errs[`exp_${i}_position`] = t('reqExpPosition');
      }
      if (!exp.company?.trim()) {
        errs[`exp_${i}_company`] = t('reqExpCompany');
      }
    });

    // Check individual education entries
    data.education.forEach((edu, i) => {
      if (!edu.institutionName?.trim() && !edu.institutionId?.trim()) {
        errs[`edu_${i}_institution`] = t('reqEduSchool');
      }
    });

    // Check individual certifications
    data.certifications.forEach((c, i) => {
      if (!c.name?.trim()) {
        errs[`cert_${i}_name`] = t('reqCertNameSingle');
      }
    });

    // Check individual references
    data.references.forEach((r, i) => {
      if (!r.name?.trim()) {
        errs[`ref_${i}_name`] = t('reqRefNameSingle');
      }
      if (!r.phone?.trim() && !r.email?.trim()) {
        errs[`ref_${i}_contact`] = t('reqRefContactSingle');
      }
    });

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast(t('reqFillAll'), 'error');
      const firstField = Object.keys(errs)[0];
      if (firstField) {
        let scrollTarget: Element | null = null;
        if (firstField.startsWith('exp_')) {
          scrollTarget = document.querySelector('[data-field="experience"]');
        } else if (firstField.startsWith('edu_')) {
          scrollTarget = document.querySelector('[data-field="education"]');
        } else if (firstField.startsWith('cert_')) {
          scrollTarget = document.querySelector('[data-field="certifications"]');
        } else if (firstField.startsWith('ref_')) {
          scrollTarget = document.querySelector('[data-field="references"]');
        } else {
          scrollTarget =
            document.getElementById(firstField) ??
            document.querySelector(`[data-field="${firstField}"]`);
        }
        scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    return true;
  }

  /** Persist; returns the CV id (creating one on first save), or null on failure. */
  async function save(): Promise<string | null> {
    if (!validate()) return null;
    setSaving(true);
    try {
      let id = cvId;
      if (!id) {
        const cRes = await fetch('/api/cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!cRes.ok) throw new Error();
        id = ((await cRes.json()) as { id: string }).id;
        setCvId(id);
      }
      const res = await fetch(`/api/cv/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, name }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error?.fields) {
          setErrors(errJson.error.fields);
        }
        throw new Error(errJson.error?.message ?? t('saveError'));
      }
      toast(t('saved'), 'success');
      onSaveSuccess?.();
      router.refresh();
      return id;
    } catch (err) {
      toast(err instanceof Error ? err.message : t('saveError'), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const id = await save();
      if (!id) return;
      const res = await fetch(`/api/cv/${id}/pdf`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fullName.replace(/\s+/g, '_') || 'CV'}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast(t('saveError'), 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function uploadCertificationDoc(index: number, file: File) {
    setUploadingCertIndex(index);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('private', 'true');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'upload failed');
      const url = (j.data ?? j).url;
      set('certifications', patch(data.certifications, index, { url }));
      toast(t('certUploaded'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('certFailed'), 'error');
    } finally {
      setUploadingCertIndex(null);
    }
  }

  async function duplicateCurrentCv() {
    if (!cvId) return;
    try {
      const res = await fetch(`/api/cv/${cvId}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast(t('saved'), 'success');
      router.refresh();
    } catch {
      toast(t('saveError'), 'error');
    }
  }

  async function createNewCv() {
    try {
      const res = await fetch('/api/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New CV' }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { id: string };
      setCvId(j.id);
      setName('New CV');
      setData(EMPTY);
      setErrors({});
      router.refresh();
    } catch {
      toast(t('saveError'), 'error');
    }
  }

  async function switchCv(id: string) {
    setSwitchingCv(true);
    try {
      const res = await fetch(`/api/cv/${id}`);
      if (!res.ok) throw new Error();
      const j = await res.json();
      setCvId(id);
      setName(j.name ?? 'My CV');
      setData(j.data ? { ...EMPTY, ...j.data } : EMPTY);
      setErrors({});
    } catch {
      toast(t('saveError'), 'error');
    } finally {
      setSwitchingCv(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-6">
        {/* Top Control Bar: CV title, Switcher, Sample Template & Actions */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('cvName')}
                className="h-8 max-w-[200px] text-sm font-semibold"
                aria-label={t('cvName')}
              />
              {cvList.length > 1 && (
                <Select
                  value={cvId ?? ''}
                  onChange={(e) => void switchCv(e.target.value)}
                  disabled={switchingCv}
                  className="h-8 text-xs sm:w-36"
                  aria-label={t('switchCv')}
                >
                  {cvList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {cvId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void duplicateCurrentCv()}
                  className="h-8 text-xs"
                  title={t('duplicateCv')}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('duplicateCv')}</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void createNewCv()}
                className="h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> {t('newCv')}
              </Button>
            </div>
          </div>

          {/* Quick Template Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs">
            <button
              type="button"
              onClick={() => {
                if (confirm(t('loadExampleConfirm'))) {
                  setData(getSampleCv(locale));
                  setErrors({});
                }
              }}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" /> {t('loadExample')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(t('clearAllConfirm'))) {
                  setData(EMPTY);
                  setErrors({});
                }
              }}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              {t('clearAll')}
            </button>
          </div>
        </div>

        {/* CV Completeness & Missing Fields Indicator */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{t('cvStrength')}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {completeness.score}%
              </span>
            </div>
            {completeness.isStandardReady ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('cvStandardMet')}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('missingFieldsHint')}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full transition-all duration-300',
                completeness.score < 50
                  ? 'bg-amber-500'
                  : completeness.score < 85
                  ? 'bg-primary'
                  : 'bg-success'
              )}
              style={{ width: `${completeness.score}%` }}
            />
          </div>

          {/* Missing Fields Interactive Badges */}
          {completeness.missingFields.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 text-xs font-medium text-muted-foreground">
                {t('missingFields')}:
              </span>
              {completeness.missingFields.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const el =
                      document.getElementById(item.fieldId) ??
                      document.querySelector(`[data-field="${item.fieldId}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                      el.focus();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                >
                  <AlertCircle className="h-3 w-3" />
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Headline */}
        <div className="space-y-1.5" data-field="headline">
          <Label htmlFor="headline" className="flex items-center gap-1">
            {t('headline')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="headline"
            value={data.headline}
            onChange={(e) => set('headline', e.target.value)}
            onBlur={() => handleBlur('headline')}
            placeholder={t('headlinePlaceholder')}
            className={errors.headline ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors.headline && <p className="text-xs text-destructive">{errors.headline}</p>}

          {/* Popular Role Quick Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">{t('popularRoles')}:</span>
            {POPULAR_ROLES.slice(0, 5).map((role) => {
              const roleLabel = locale === 'rw' ? role.rw : locale === 'fr' ? role.fr : role.en;
              return (
                <button
                  key={role.en}
                  type="button"
                  onClick={() => set('headline', roleLabel)}
                  className="rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs transition-colors hover:border-primary hover:bg-primary/10"
                >
                  {roleLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Skills first */}
        <section className="space-y-2" data-field="skills">
          <Label className="flex items-center gap-1">
            {t('skills')} <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">{t('skillsHint')}</p>
          <div className={errors.skills ? 'rounded-lg border border-destructive p-1' : ''}>
            <SkillPicker
              value={data.skills}
              onChange={(skills) => {
                set('skills', skills);
                if (skills.length > 0 && errors.skills) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.skills;
                    return n;
                  });
                }
              }}
              levels={data.skillLevels as Record<string, SkillLevel>}
              onLevels={(lv) => set('skillLevels', lv)}
            />
          </div>
          {errors.skills && <p className="text-xs text-destructive">{errors.skills}</p>}
        </section>

        {/* Professional Summary */}
        <div className="space-y-1.5" data-field="summary">
          <div className="flex items-center justify-between">
            <Label htmlFor="summary" className="flex items-center gap-1">
              {t('summary')} <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={() => {
                const drafted = draftSummary({ headline: data.headline, skills: data.skills, locale });
                set('summary', drafted);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              title={t('suggestSummaryHint')}
            >
              <Sparkles className="h-3.5 w-3.5" /> {t('suggestSummary')}
            </button>
          </div>
          <Textarea
            id="summary"
            value={data.summary}
            onChange={(e) => set('summary', e.target.value)}
            onBlur={() => handleBlur('summary')}
            placeholder={t('summaryPlaceholder')}
            rows={4}
            className={errors.summary ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors.summary && <p className="text-xs text-destructive">{errors.summary}</p>}
        </div>

        {/* Contact & personal details */}
        <section className="space-y-2" data-field="contactEmail">
          <Label className="flex items-center gap-1">
            {t('contactPersonal')} <span className="text-destructive">*</span>
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Input
                id="contactEmail"
                value={data.contactEmail}
                onChange={(e) => set('contactEmail', e.target.value)}
                onBlur={() => handleBlur('contactEmail')}
                type="email"
                placeholder={t('email') + ' *'}
                className={errors.contactEmail ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.contactEmail && (
                <p className="mt-1 text-xs text-destructive">{errors.contactEmail}</p>
              )}
            </div>
            <Input
              value={data.portfolioUrl}
              onChange={(e) => set('portfolioUrl', e.target.value)}
              placeholder={t('portfolio')}
            />
            <Input
              value={data.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              type="date"
              aria-label={t('dateOfBirth')}
            />
            <Input
              value={data.nationality}
              onChange={(e) => set('nationality', e.target.value)}
              placeholder={t('nationality')}
            />
            <Select
              value={data.gender}
              onChange={(e) => set('gender', e.target.value)}
              aria-label={t('gender')}
            >
              <option value="">{t('gender')}</option>
              <option value="female">{t('genderFemale')}</option>
              <option value="male">{t('genderMale')}</option>
              <option value="other">{t('genderOther')}</option>
            </Select>
            <Input
              value={data.drivingLicense}
              onChange={(e) => set('drivingLicense', e.target.value)}
              placeholder={t('drivingLicense')}
            />
          </div>
        </section>

        {/* Experience */}
        <section className="space-y-3" data-field="experience">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('experience')}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                set('experience', [
                  ...data.experience,
                  { company: '', position: '', startYear: '', endYear: '', summary: '' },
                ]);
              }}
            >
              <Plus className="h-4 w-4" /> {t('addExperience')}
            </Button>
          </div>

          {data.experience.map((exp, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => set('experience', data.experience.filter((_, idx) => idx !== i))}
                  aria-label={tc('delete')}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <Input
                  value={exp.position}
                  onChange={(e) => {
                    set('experience', patch(data.experience, i, { position: e.target.value }));
                    if (errors[`exp_${i}_position`] && e.target.value.trim()) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n[`exp_${i}_position`];
                        return n;
                      });
                    }
                  }}
                  placeholder={t('position') + ' *'}
                  className={errors[`exp_${i}_position`] ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors[`exp_${i}_position`] && (
                  <p className="mt-1 text-xs text-destructive">{errors[`exp_${i}_position`]}</p>
                )}
              </div>

              <div>
                <Input
                  value={exp.company}
                  onChange={(e) => {
                    set('experience', patch(data.experience, i, { company: e.target.value }));
                    if (errors[`exp_${i}_company`] && e.target.value.trim()) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n[`exp_${i}_company`];
                        return n;
                      });
                    }
                  }}
                  placeholder={t('company') + ' *'}
                  className={errors[`exp_${i}_company`] ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors[`exp_${i}_company`] && (
                  <p className="mt-1 text-xs text-destructive">{errors[`exp_${i}_company`]}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={exp.startYear}
                  onChange={(e) => set('experience', patch(data.experience, i, { startYear: e.target.value }))}
                  placeholder={t('startYear')}
                />
                <Input
                  value={exp.endYear}
                  onChange={(e) => set('experience', patch(data.experience, i, { endYear: e.target.value }))}
                  placeholder={t('endYear')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('experienceSummary')}</Label>
                {exp.position.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'experience',
                        patch(data.experience, i, {
                          summary: draftExperience({ role: exp.position, place: exp.company, locale }),
                        })
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> {t('suggestDescription')}
                  </button>
                )}
              </div>
              <Textarea
                value={exp.summary}
                onChange={(e) => set('experience', patch(data.experience, i, { summary: e.target.value }))}
                placeholder={t('experienceSummaryPlaceholder')}
                rows={2}
              />
            </div>
          ))}
        </section>

        {/* Education */}
        <div data-field="education" className="space-y-2">
          <EducationEditor
            value={data.education}
            errors={errors}
            onChange={(education) => set('education', education)}
          />
        </div>

        {/* Languages */}
        <section className="space-y-2">
          <Label>{t('languages')}</Label>
          <LanguagePicker value={data.languages} onChange={(langs) => set('languages', langs)} />
        </section>

        {/* Certifications */}
        <section className="space-y-3" data-field="certifications">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('certifications')}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set('certifications', [
                  ...data.certifications,
                  { name: '', issuer: '', year: '', url: '' },
                ])
              }
            >
              <Plus className="h-4 w-4" /> {t('addCertification')}
            </Button>
          </div>

          {data.certifications.map((c, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    set('certifications', data.certifications.filter((_, idx) => idx !== i))
                  }
                  aria-label={tc('delete')}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <Input
                  value={c.name}
                  onChange={(e) => {
                    set('certifications', patch(data.certifications, i, { name: e.target.value }));
                    if (errors[`cert_${i}_name`] && e.target.value.trim()) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n[`cert_${i}_name`];
                        return n;
                      });
                    }
                  }}
                  placeholder={t('certName') + ' *'}
                  className={errors[`cert_${i}_name`] ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors[`cert_${i}_name`] && (
                  <p className="mt-1 text-xs text-destructive">{errors[`cert_${i}_name`]}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={c.issuer}
                  onChange={(e) =>
                    set('certifications', patch(data.certifications, i, { issuer: e.target.value }))
                  }
                  placeholder={t('certIssuer')}
                />
                <Input
                  value={c.year}
                  onChange={(e) =>
                    set('certifications', patch(data.certifications, i, { year: e.target.value }))
                  }
                  placeholder={t('startYear')}
                />
              </div>

              {/* Inline Certificate Document Upload */}
              <div className="pt-1">
                {c.url ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-1.5 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-xs text-success">
                      <Check className="h-3.5 w-3.5" /> {t('certAttached')}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> {t('view')}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          set('certifications', patch(data.certifications, i, { url: '' }))
                        }
                        className="text-muted-foreground hover:text-destructive"
                        title={t('removeCertificate')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40">
                    {uploadingCertIndex === i ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {uploadingCertIndex === i ? t('uploading') : t('attachCertFile')}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={uploadingCertIndex === i}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadCertificationDoc(i, f);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* References */}
        <section className="space-y-3" data-field="references">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('references')}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set('references', [
                  ...data.references,
                  { name: '', relationship: '', phone: '', email: '' },
                ])
              }
            >
              <Plus className="h-4 w-4" /> {t('addReference')}
            </Button>
          </div>

          {data.references.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => set('references', data.references.filter((_, idx) => idx !== i))}
                  aria-label={tc('delete')}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <Input
                  value={r.name}
                  onChange={(e) => {
                    set('references', patch(data.references, i, { name: e.target.value }));
                    if (errors[`ref_${i}_name`] && e.target.value.trim()) {
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n[`ref_${i}_name`];
                        return n;
                      });
                    }
                  }}
                  placeholder={t('refName') + ' *'}
                  className={errors[`ref_${i}_name`] ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors[`ref_${i}_name`] && (
                  <p className="mt-1 text-xs text-destructive">{errors[`ref_${i}_name`]}</p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={r.relationship}
                  onChange={(e) =>
                    set('references', patch(data.references, i, { relationship: e.target.value }))
                  }
                  placeholder={t('refRelationship')}
                />
                <div>
                  <Input
                    value={r.phone}
                    onChange={(e) => {
                      set('references', patch(data.references, i, { phone: e.target.value }));
                      if (errors[`ref_${i}_contact`]) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n[`ref_${i}_contact`];
                          return n;
                        });
                      }
                    }}
                    placeholder={t('refPhone')}
                    className={errors[`ref_${i}_contact`] ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                </div>
                <div>
                  <Input
                    value={r.email}
                    onChange={(e) => {
                      set('references', patch(data.references, i, { email: e.target.value }));
                      if (errors[`ref_${i}_contact`]) {
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n[`ref_${i}_contact`];
                          return n;
                        });
                      }
                    }}
                    placeholder={t('email')}
                    className={errors[`ref_${i}_contact`] ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                </div>
              </div>
              {errors[`ref_${i}_contact`] && (
                <p className="mt-1 text-xs text-destructive">{errors[`ref_${i}_contact`]}</p>
              )}
            </div>
          ))}
        </section>

        {/* Location */}
        <section className="space-y-2" data-field="location">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-muted-foreground" /> {t('location')}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <div className={errors.location ? 'rounded-lg border border-destructive p-1' : ''}>
            <LocationPicker
              value={data.location ?? null}
              onChange={(loc) => {
                set('location', loc);
                if (loc && errors.location) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.location;
                    return n;
                  });
                }
              }}
            />
          </div>
          {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
        </section>

        {/* Sticky Actions */}
        <div className="sticky bottom-20 space-y-2 md:bottom-4">
          <div className="flex gap-2">
            <Button
              onClick={() => void save()}
              disabled={saving || downloading}
              className="flex-1"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('saveCv')}
            </Button>
            <Button
              variant="accent"
              onClick={() => void download()}
              disabled={saving || downloading}
              className="flex-1"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? t('generating') : t('downloadPdf')}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            <span className="text-destructive">*</span> {t('requiredField')}
          </p>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-sm font-medium text-muted-foreground">{t('livePreview')}</p>
        <CvPreview data={data} fullName={fullName} />
      </div>
    </div>
  );
}

function patch<T>(list: T[], index: number, changes: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...changes } : item));
}

'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, Download, Save, Sparkles, MapPin } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
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

export function CvBuilder({ initial, fullName }: { initial: CvData | null; fullName: string }) {
  const t = useTranslations('cv');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { toast } = useToast();
  const [data, setData] = useState<CvData>(initial ? { ...EMPTY, ...initial } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function set<K extends keyof CvData>(key: K, value: CvData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch('/api/cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast(t('saved'), 'success');
      return true;
    } catch {
      toast(t('saveError'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  // The PDF is rendered server-side from the SAVED record, so persist the current
  // edits FIRST, then stream the file — avoids the old race that downloaded stale
  // (or missing) data. Fetched as a blob so a failure shows a toast, not a raw
  // JSON error page.
  async function download() {
    setDownloading(true);
    try {
      if (!(await save())) return;
      const res = await fetch('/api/cv/pdf');
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

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="headline">{t('headline')}</Label>
          <Input
            id="headline"
            value={data.headline}
            onChange={(e) => set('headline', e.target.value)}
            placeholder={t('headlinePlaceholder')}
          />
        </div>

        {/* Skills first (§3 Step 2) */}
        <section className="space-y-2">
          <Label>{t('skills')}</Label>
          <p className="text-xs text-muted-foreground">{t('skillsHint')}</p>
          <SkillPicker
            value={data.skills}
            onChange={(skills) => set('skills', skills)}
            levels={data.skillLevels as Record<string, SkillLevel>}
            onLevels={(lv) => set('skillLevels', lv)}
          />
        </section>

        <div className="space-y-1.5">
          <Label htmlFor="summary">{t('summary')}</Label>
          <Textarea
            id="summary"
            value={data.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder={t('summaryPlaceholder')}
            rows={4}
          />
        </div>

        {/* Contact & personal details (professional-CV essentials) */}
        <section className="space-y-2">
          <Label>{t('contactPersonal')}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={data.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} type="email" placeholder={t('email')} />
            <Input value={data.portfolioUrl} onChange={(e) => set('portfolioUrl', e.target.value)} placeholder={t('portfolio')} />
            <Input value={data.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} type="date" aria-label={t('dateOfBirth')} />
            <Input value={data.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder={t('nationality')} />
            <Select value={data.gender} onChange={(e) => set('gender', e.target.value)} aria-label={t('gender')}>
              <option value="">{t('gender')}</option>
              <option value="female">{t('genderFemale')}</option>
              <option value="male">{t('genderMale')}</option>
              <option value="other">{t('genderOther')}</option>
            </Select>
            <Input value={data.drivingLicense} onChange={(e) => set('drivingLicense', e.target.value)} placeholder={t('drivingLicense')} />
          </div>
        </section>

        {/* Experience */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('experience')}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set('experience', [...data.experience, { company: '', position: '', startYear: '', endYear: '', summary: '' }])
              }
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
              <Input value={exp.position} onChange={(e) => set('experience', patch(data.experience, i, { position: e.target.value }))} placeholder={t('position')} />
              <Input value={exp.company} onChange={(e) => set('experience', patch(data.experience, i, { company: e.target.value }))} placeholder={t('company')} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={exp.startYear} onChange={(e) => set('experience', patch(data.experience, i, { startYear: e.target.value }))} placeholder={t('startYear')} />
                <Input value={exp.endYear} onChange={(e) => set('experience', patch(data.experience, i, { endYear: e.target.value }))} placeholder={t('endYear')} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('experienceSummary')}</Label>
                {exp.position.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      set('experience', patch(data.experience, i, { summary: draftExperience({ role: exp.position, place: exp.company, locale }) }))
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> {t('suggestDescription')}
                  </button>
                )}
              </div>
              <Textarea value={exp.summary} onChange={(e) => set('experience', patch(data.experience, i, { summary: e.target.value }))} placeholder={t('experienceSummaryPlaceholder')} rows={2} />
            </div>
          ))}
        </section>

        {/* Education — rebuilt, autocomplete-backed (Part 4) */}
        <EducationEditor value={data.education} onChange={(education) => set('education', education)} />

        {/* Languages (Part 5) */}
        <section className="space-y-2">
          <Label>{t('languages')}</Label>
          <LanguagePicker value={data.languages} onChange={(langs) => set('languages', langs)} />
        </section>

        {/* Certifications (separate from education certificates) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('certifications')}</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => set('certifications', [...data.certifications, { name: '', issuer: '', year: '', url: '' }])}>
              <Plus className="h-4 w-4" /> {t('addCertification')}
            </Button>
          </div>
          {data.certifications.map((c, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => set('certifications', data.certifications.filter((_, idx) => idx !== i))} aria-label={tc('delete')} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input value={c.name} onChange={(e) => set('certifications', patch(data.certifications, i, { name: e.target.value }))} placeholder={t('certName')} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={c.issuer} onChange={(e) => set('certifications', patch(data.certifications, i, { issuer: e.target.value }))} placeholder={t('certIssuer')} />
                <Input value={c.year} onChange={(e) => set('certifications', patch(data.certifications, i, { year: e.target.value }))} placeholder={t('startYear')} />
              </div>
            </div>
          ))}
        </section>

        {/* References */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('references')}</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => set('references', [...data.references, { name: '', relationship: '', phone: '', email: '' }])}>
              <Plus className="h-4 w-4" /> {t('addReference')}
            </Button>
          </div>
          {data.references.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => set('references', data.references.filter((_, idx) => idx !== i))} aria-label={tc('delete')} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input value={r.name} onChange={(e) => set('references', patch(data.references, i, { name: e.target.value }))} placeholder={t('refName')} />
              <div className="grid gap-2 sm:grid-cols-3">
                <Input value={r.relationship} onChange={(e) => set('references', patch(data.references, i, { relationship: e.target.value }))} placeholder={t('refRelationship')} />
                <Input value={r.phone} onChange={(e) => set('references', patch(data.references, i, { phone: e.target.value }))} placeholder={t('refPhone')} />
                <Input value={r.email} onChange={(e) => set('references', patch(data.references, i, { email: e.target.value }))} placeholder={t('email')} />
              </div>
            </div>
          ))}
        </section>

        {/* Location — shared 4-level cascade (Part 6) */}
        <section className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-muted-foreground" /> {t('location')}
          </Label>
          <LocationPicker value={data.location ?? null} onChange={(loc) => set('location', loc)} />
        </section>

        <div className="sticky bottom-20 flex gap-2 md:bottom-4">
          <Button onClick={() => void save()} disabled={saving || downloading} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('saveCv')}
          </Button>
          <Button variant="accent" onClick={() => void download()} disabled={saving || downloading} className="flex-1">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? t('generating') : t('downloadPdf')}
          </Button>
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

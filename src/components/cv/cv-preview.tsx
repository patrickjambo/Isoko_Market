'use client';

import { useTranslations, useLocale } from 'next-intl';
import { MapPin } from 'lucide-react';
import type { CvData } from '@/lib/validators/cv';
import { labelForSkill } from '@/lib/skills';
import { formatEducation, sortEducation, formatLanguages } from '@/lib/cv-format';

/** On-screen mirror of the generated PDF, updating live as the user types. */
export function CvPreview({ data, fullName }: { data: CvData; fullName: string }) {
  const t = useTranslations('cv');
  const locale = useLocale();
  const levels = data.skillLevels ?? {};
  const eduLabels = {
    level: (l: string) => t(`eduLevel_${l}`),
    degree: (d: string) => t(`degree_${d}`),
    inWord: t('inWord'),
    present: t('present'),
  };
  const langLine = formatLanguages(data.languages, {
    lang: (c) => (['rw', 'en', 'fr'].includes(c) ? t(`lang_${c}`) : c),
    level: (lv) => t(`proficiency_${lv}`),
  });

  return (
    <div className="rounded-xl border border-border bg-white p-6 text-slate-900 shadow-sm">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-extrabold">{fullName}</h1>
        {data.headline && <p className="font-medium text-orange-600">{data.headline}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {data.contactEmail && <span>{data.contactEmail}</span>}
          {data.location?.label && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {data.location.label}
            </span>
          )}
          {data.portfolioUrl && <span>{data.portfolioUrl}</span>}
          {langLine && <span>{langLine}</span>}
        </div>
        {(data.dateOfBirth || data.nationality || data.gender || data.drivingLicense) && (
          <p className="mt-0.5 text-xs text-slate-400">
            {[
              data.dateOfBirth && `${t('dateOfBirth')}: ${data.dateOfBirth}`,
              data.nationality,
              data.gender && t(`gender${data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}`),
              data.drivingLicense && `${t('drivingLicense')}: ${data.drivingLicense}`,
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </p>
        )}
      </header>

      {data.summary && <p className="mt-3 text-sm leading-relaxed text-slate-700">{data.summary}</p>}

      {data.experience.length > 0 && (
        <Section title={t('experience')}>
          {data.experience.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{e.position || e.company}</p>
                <p className="text-xs text-slate-500">
                  {[e.startYear, e.endYear].filter(Boolean).join(' – ')}
                </p>
              </div>
              {e.position && e.company && <p className="text-sm text-slate-600">{e.company}</p>}
              {e.summary && <p className="text-sm text-slate-700">{e.summary}</p>}
            </div>
          ))}
        </Section>
      )}

      {data.education.length > 0 && (
        <Section title={t('education')}>
          {sortEducation(data.education).map((ed, i) => {
            const f = formatEducation(ed, eduLabels);
            return (
              <div key={i} className="mb-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{f.title}</p>
                  {f.years && <p className="shrink-0 text-xs text-slate-500">{f.years}</p>}
                </div>
                <p className="text-sm text-slate-600">
                  {f.institution}
                  {f.classification && <span className="text-slate-500"> — {f.classification}</span>}
                </p>
              </div>
            );
          })}
        </Section>
      )}

      {data.skills.length > 0 && (
        <Section title={t('skills')}>
          <p className="text-sm text-slate-700">
            {data.skills
              .map((k) => {
                const lvl = levels[k];
                return lvl ? `${labelForSkill(k, locale)} (${t(`level_${lvl}`)})` : labelForSkill(k, locale);
              })
              .join(' · ')}
          </p>
        </Section>
      )}

      {langLine && (
        <Section title={t('languages')}>
          <p className="text-sm text-slate-700">{langLine}</p>
        </Section>
      )}

      {data.certifications.length > 0 && (
        <Section title={t('certifications')}>
          {data.certifications.map((c, i) => (
            <p key={i} className="text-sm text-slate-700">
              <span className="font-medium">{c.name}</span>
              {[c.issuer, c.year].filter(Boolean).length > 0 && (
                <span className="text-slate-500"> — {[c.issuer, c.year].filter(Boolean).join(', ')}</span>
              )}
            </p>
          ))}
        </Section>
      )}

      {data.references.length > 0 && (
        <Section title={t('references')}>
          {data.references.map((r, i) => (
            <p key={i} className="text-sm text-slate-700">
              <span className="font-medium">{r.name}</span>
              {r.relationship && <span className="text-slate-500"> — {r.relationship}</span>}
              {(r.phone || r.email) && <span className="text-slate-500"> · {[r.phone, r.email].filter(Boolean).join(' · ')}</span>}
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-1.5 border-b-2 border-orange-400 pb-0.5 text-sm font-bold uppercase tracking-wide text-teal-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

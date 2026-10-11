import { describe, it, expect } from 'vitest';
import { calculateCvCompleteness, draftSummary, getSampleCv, POPULAR_ROLES } from '@/lib/cv-assist';
import type { CvData } from '@/lib/validators/cv';

describe('cv-assist', () => {
  it('calculates 0% completeness on empty CV and enumerates all missing fields', () => {
    const empty: CvData = {
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
    const res = calculateCvCompleteness(empty);
    expect(res.score).toBe(0);
    expect(res.isStandardReady).toBe(false);
    expect(res.missingFields.length).toBe(7);
  });

  it('calculates 100% completeness on full sample CV and flags standard ready', () => {
    const sample = getSampleCv('en');
    const res = calculateCvCompleteness(sample);
    expect(res.score).toBe(100);
    expect(res.isStandardReady).toBe(true);
    expect(res.missingFields).toHaveLength(0);
  });

  it('drafts a coherent summary in English, French and Kinyarwanda', () => {
    const en = draftSummary({ headline: 'Accountant', skills: ['accounting'], locale: 'en' });
    expect(en).toContain('Accountant');
    expect(en).toContain('Accounting');

    const fr = draftSummary({ headline: 'Comptable', skills: ['accounting'], locale: 'fr' });
    expect(fr).toContain('Comptable');

    const rw = draftSummary({ headline: 'Umucungamari', skills: ['accounting'], locale: 'rw' });
    expect(rw).toContain('Umucungamari');
  });

  it('provides localized popular roles', () => {
    expect(POPULAR_ROLES.length).toBeGreaterThan(5);
    expect(POPULAR_ROLES[0].en).toBe('Software Developer');
  });
});

import { describe, it, expect } from 'vitest';
import {
  matchScore,
  searchSkills,
  draftExperience,
  draftJobDescription,
  draftDescription,
  suggestSkillsFromText,
  labelForSkill,
  canonicalSkill,
} from '@/lib/skills';
// The API wrapper must re-export the SAME function (no second implementation).
import { draftDescription as draftDescriptionViaSuggestions } from '@/lib/suggestions';

describe('matchScore', () => {
  it('reflects real overlap between CV skills and job requirements (not static)', () => {
    const cv = ['tailoring', 'sales', 'customer_service'];
    // Job needs 2 skills, seeker has both → full match, strong tier.
    const full = matchScore(cv, ['tailoring', 'sales']);
    expect(full.score).toBe(1);
    expect(full.tier).toBe('strong');
    expect(full.overlap.sort()).toEqual(['sales', 'tailoring']);

    // Seeker has 1 of 3 → 'good', partial score.
    const partial = matchScore(cv, ['tailoring', 'welding', 'plumbing']);
    expect(partial.overlap).toEqual(['tailoring']);
    expect(partial.score).toBeCloseTo(1 / 3);
    expect(partial.tier).toBe('good');
  });

  it('is "none" when nothing overlaps or the job lists no skills', () => {
    expect(matchScore(['driving'], ['tailoring']).tier).toBe('none');
    expect(matchScore(['driving'], []).tier).toBe('none');
    expect(matchScore([], ['tailoring']).score).toBe(0);
  });

  it('normalizes legacy free-text labels to canonical keys before comparing', () => {
    // CV stored a human label; job stored the canonical key — still matches.
    const r = matchScore(['Tailoring'], ['tailoring']);
    expect(r.overlap).toEqual(['tailoring']);
    expect(r.tier).toBe('strong');
  });
});

describe('searchSkills', () => {
  it('finds taxonomy skills across locales, prefix-first', () => {
    const en = searchSkills('tail', 'en');
    expect(en[0]?.key).toBe('tailoring');
    // Kinyarwanda label search hits the same canonical key.
    const rw = searchSkills('kudoda', 'rw');
    expect(rw.some((s) => s.key === 'tailoring')).toBe(true);
  });

  it('returns nothing for empty queries', () => {
    expect(searchSkills('', 'en')).toEqual([]);
  });
});

describe('labelForSkill / canonicalSkill', () => {
  it('resolves labels per locale and falls back to raw free text', () => {
    expect(labelForSkill('tailoring', 'fr')).toBe('Couture');
    expect(labelForSkill('some_custom_skill', 'en')).toBe('some_custom_skill');
  });
  it('canonicalizes labels and keys to one token', () => {
    expect(canonicalSkill('Couture')).toBe('tailoring');
    expect(canonicalSkill('TAILORING')).toBe('tailoring');
  });
});

describe('draftExperience', () => {
  it('builds an editable, role-aware sentence in each locale', () => {
    const en = draftExperience({ role: 'tailoring', place: 'Kigali Shop', locale: 'en' });
    expect(en).toContain('Worked as a tailoring at Kigali Shop');
    expect(en).toMatch(/responsible for/);

    const fr = draftExperience({ role: 'sales', place: 'Boutique', locale: 'fr' });
    expect(fr).toContain('travaillé comme sales');

    // Unknown role still produces a valid, non-empty line (no task clause).
    const rw = draftExperience({ role: 'astronaut', locale: 'rw' });
    expect(rw.length).toBeGreaterThan(0);
    // Empty role yields empty string.
    expect(draftExperience({ role: '  ' })).toBe('');
  });
});

describe('suggestSkillsFromText (employer §3 Step 2)', () => {
  it('infers required skills from a job title', () => {
    expect(suggestSkillsFromText('Experienced tailor needed')).toContain('tailoring');
    expect(suggestSkillsFromText('Driver for deliveries')).toEqual(
      expect.arrayContaining(['driving'])
    );
    expect(suggestSkillsFromText('xyzzy nonsense role')).toEqual([]);
  });
});

describe('draftDescription (listing) — single shared drafter', () => {
  it('drafts an editable listing description in each locale', () => {
    const en = draftDescription({ title: 'Samsung A14', category: 'Phones', condition: 'GOOD', location: 'Kigali', tags: ['64GB'], locale: 'en' });
    expect(en).toContain('Samsung A14');
    expect(en).toContain('Kigali');
    expect(en).toContain('64GB');
    expect(draftDescription({ title: 'X', locale: 'rw' })).toMatch(/Vugana/);
    expect(draftDescription({ title: 'X', locale: 'fr' })).toMatch(/Contactez/);
  });

  it('is the exact same function the /api/suggestions wrapper uses', () => {
    // Rule 3: one implementation, imported by both the client and the API.
    expect(draftDescriptionViaSuggestions).toBe(draftDescription);
  });
});

describe('draftJobDescription (employer §3 Step 5)', () => {
  it('drafts an editable posting in each locale with skills & pay', () => {
    const en = draftJobDescription({
      title: 'Shop assistant',
      type: 'JOB',
      skills: ['sales', 'customer_service'],
      location: 'Kigali',
      pay: '50,000 RWF/month',
      locale: 'en',
    });
    expect(en).toContain("We're hiring a Shop assistant");
    expect(en).toContain('Kigali');
    expect(en).toContain('Sales');
    expect(en).toContain('50,000');

    const fr = draftJobDescription({ title: 'Tailleur', type: 'GIG', locale: 'fr' });
    expect(fr).toContain('mission');
    // Empty title → empty string.
    expect(draftJobDescription({ title: '' })).toBe('');
  });
});

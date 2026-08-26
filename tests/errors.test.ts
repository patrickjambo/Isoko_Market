import { describe, it, expect } from 'vitest';
import { localizeError } from '@/lib/errors';

describe('localizeError', () => {
  it('translates a known message into rw and fr', () => {
    expect(localizeError('Job not found.', 'rw')).toBe('Akazi ntikabonetse.');
    expect(localizeError('Job not found.', 'fr')).toBe('Offre introuvable.');
    expect(localizeError('You already applied to this job.', 'fr')).toBe(
      'Vous avez déjà postulé à cette offre.'
    );
  });

  it('passes English through unchanged (English is the source of truth)', () => {
    expect(localizeError('Job not found.', 'en')).toBe('Job not found.');
  });

  it('falls back to the original text for unmapped/dynamic messages', () => {
    expect(localizeError('Missing permission: analytics.export', 'fr')).toBe(
      'Missing permission: analytics.export'
    );
    expect(localizeError('Job not found.', 'sw')).toBe('Job not found.'); // unknown locale
  });
});

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

  it('translates Zod field messages too', () => {
    expect(localizeError('Add a job title.', 'rw')).toBe('Andika umutwe w’akazi.');
    expect(localizeError('Enter a valid Rwandan phone number.', 'fr')).toBe(
      'Saisissez un numéro de téléphone rwandais valide.'
    );
  });

  it('translates the dynamic "Missing permission:" prefix, keeping the key', () => {
    expect(localizeError('Missing permission: analytics.export', 'fr')).toBe(
      'Autorisation manquante : analytics.export'
    );
    expect(localizeError('Missing permission: users.ban', 'rw')).toBe('Nta ruhushya: users.ban');
    // English is unchanged.
    expect(localizeError('Missing permission: users.ban', 'en')).toBe('Missing permission: users.ban');
  });

  it('falls back to the original text for unmapped messages and unknown locales', () => {
    expect(localizeError('Totally novel error.', 'fr')).toBe('Totally novel error.');
    expect(localizeError('Job not found.', 'sw')).toBe('Job not found.'); // unknown locale
  });
});

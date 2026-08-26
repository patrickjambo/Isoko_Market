import { describe, it, expect } from 'vitest';
import { categoryName } from '@/lib/i18n-helpers';

const cat = { nameRw: 'Ibikoresho', nameEn: 'Electronics', nameFr: 'Électronique' };

describe('categoryName', () => {
  it('picks the locale-specific name, defaulting to English', () => {
    expect(categoryName(cat, 'rw')).toBe('Ibikoresho');
    expect(categoryName(cat, 'fr')).toBe('Électronique');
    expect(categoryName(cat, 'en')).toBe('Electronics');
    expect(categoryName(cat, 'sw')).toBe('Electronics'); // unknown locale → English
  });

  it('returns an empty string for a missing category', () => {
    expect(categoryName(null, 'en')).toBe('');
    expect(categoryName(undefined, 'rw')).toBe('');
  });
});

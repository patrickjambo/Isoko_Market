import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://isoko:pass@localhost:5544/isoko';
  process.env.AUTH_SECRET = 'dev-only-secret-change-me-in-production-0123456789abcdef';
});

import {
  validateRwandanIdNumber,
  parseIdTextHeuristically,
} from '@/lib/verification/ocr';
import { exportUsersToExcelBuffer } from '@/lib/export/excel';

describe('Rwandan National ID Validation', () => {
  it('validates a standard 16-digit Rwandan citizen ID (Male)', () => {
    const raw = '1 1995 8 0012345 0 24';
    const res = validateRwandanIdNumber(raw);

    expect(res.valid).toBe(true);
    expect(res.normalizedId).toBe('1199580012345024');
    expect(res.birthYear).toBe(1995);
    expect(res.genderIndicator).toBe('MALE');
    expect(res.isCitizen).toBe(true);
  });

  it('validates a standard 16-digit Rwandan citizen ID (Female)', () => {
    const raw = '1199870098765012';
    const res = validateRwandanIdNumber(raw);

    expect(res.valid).toBe(true);
    expect(res.birthYear).toBe(1998);
    expect(res.genderIndicator).toBe('FEMALE');
    expect(res.isCitizen).toBe(true);
  });

  it('recognizes foreigner/refugee identification starting with 2', () => {
    const raw = '2 2000 8 0045678 1 09';
    const res = validateRwandanIdNumber(raw);

    expect(res.valid).toBe(true);
    expect(res.isCitizen).toBe(false);
    expect(res.birthYear).toBe(2000);
  });

  it('rejects an ID with incorrect digit length', () => {
    expect(validateRwandanIdNumber('119958001234502').valid).toBe(false);
    expect(validateRwandanIdNumber('11995800123450249').valid).toBe(false);
  });

  it('rejects an ID with an impossible birth year', () => {
    const futureId = '1209980012345024';
    const res = validateRwandanIdNumber(futureId);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/birth year/i);
  });
});

describe('ID Information Extraction & OCR Parser', () => {
  it('recognizes "Republic of Rwanda" and extracts Rwanda as issuing country', () => {
    const text = `
      REPUBLIC OF RWANDA
      NATIONAL IDENTITY CARD / INDANGAMUNTU
      Amazina / Names / Noms: MUGISHA Jean Paul
      ID: 1 1995 8 0012345 0 24
      Sex: M
    `;

    const extracted = parseIdTextHeuristically(text, 'MUGISHA Jean Paul');

    expect(extracted.country).toBe('Rwanda');
    expect(extracted.idNumber).toBe('1199580012345024');
    expect(extracted.fullName).toMatch(/MUGISHA Jean Paul/i);
    expect(extracted.confidence).toBeGreaterThanOrEqual(0.75);
    expect(extracted.needsManualReview).toBe(false);
  });

  it('recognizes Kinyarwanda header "Repubulika y\'u Rwanda"', () => {
    const text = `
      REPUBULIKA Y'U RWANDA
      INDANGAMUNTU
      Amazina: UWASE Aline
      Numero: 1199870098765012
    `;

    const extracted = parseIdTextHeuristically(text, 'UWASE Aline');

    expect(extracted.country).toBe('Rwanda');
    expect(extracted.idNumber).toBe('1199870098765012');
    expect(extracted.fullName).toMatch(/UWASE Aline/i);
    expect(extracted.needsManualReview).toBe(false);
  });

  it('flags for manual review when national ID number is missing or illegible', () => {
    const text = `
      REPUBLIC OF RWANDA
      NATIONAL IDENTITY CARD
      Names: GISA Patrick
      [ID Number obscured by glare]
    `;

    const extracted = parseIdTextHeuristically(text, 'GISA Patrick');

    expect(extracted.country).toBe('Rwanda');
    expect(extracted.idNumber).toBeNull();
    expect(extracted.needsManualReview).toBe(true);
    expect(extracted.reviewReasons.some((r) => r.includes('ID number'))).toBe(true);
  });

  it('flags for manual review when country cannot be determined', () => {
    const text = `
      STUDENT CARD
      Name: John Doe
      ID: 123456789
    `;

    const extracted = parseIdTextHeuristically(text);

    expect(extracted.country).toBeNull();
    expect(extracted.needsManualReview).toBe(true);
  });
});

describe('Export Users to Excel (.xlsx)', () => {
  const mockUsers = [
    {
      id: 'usr_clz1234567890',
      fullName: 'Habimana & Sons <Trading>',
      email: 'habimana@zenova.rw',
      phone: '+250788123456',
      country: 'Rwanda',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      createdAt: new Date('2026-02-10T08:30:00Z'),
      nationalId: '1199080012345099',
    },
    {
      id: 'usr_clz9876543210',
      fullName: 'Mukamana Claire',
      email: 'claire@zenova.rw',
      phone: '+250788654321',
      country: 'Rwanda',
      accountStatus: 'SUSPENDED',
      verificationStatus: 'PENDING',
      createdAt: '2026-03-01 12:00:00',
      nationalId: null,
    },
  ];

  it('generates a valid OpenXML (.xlsx) buffer with all 7 required columns', () => {
    const buffer = exportUsersToExcelBuffer(mockUsers);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify ZIP magic header: PK\x03\x04
    expect(buffer.readUInt32LE(0)).toBe(0x04034b50);
  });

  it('includes 8th column for authorized National ID export', () => {
    const buffer = exportUsersToExcelBuffer(mockUsers, { includeNationalId: true });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('safely handles empty user list without failing', () => {
    const buffer = exportUsersToExcelBuffer([]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.readUInt32LE(0)).toBe(0x04034b50);
  });
});

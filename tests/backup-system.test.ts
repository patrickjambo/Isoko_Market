import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://isoko:pass@localhost:5544/isoko';
  process.env.AUTH_SECRET = 'dev-only-secret-change-me-in-production-0123456789abcdef';
});

import { encryptBackupData, decryptBackupData, computeSha256 } from '@/lib/backup/crypto';
import { DEFAULT_SCOPES } from '@/lib/backup/engine';

describe('Backup Cryptography and Tamper Resistance', () => {
  it('computes deterministic SHA-256 hashes', () => {
    const data = 'zenova-rwanda-secure-backup-payload-2026';
    const hash1 = computeSha256(data);
    const hash2 = computeSha256(Buffer.from(data, 'utf8'));

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('encrypts and decrypts data loss-free using AES-256-GCM', () => {
    const originalPayload = JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      metadata: { totalRecords: 2, scopes: ['users', 'listings'] },
      tables: {
        users: [
          { id: 'usr_001', email: 'jean@zenova.rw', fullName: 'Jean Paul', role: 'BUYER' },
          { id: 'usr_002', email: 'claudine@zenova.rw', fullName: 'Claudine M', role: 'SELLER' },
        ],
        listings: [
          { id: 'lst_001', title: 'Toyota RAV4 2022', price: 25000000, sellerId: 'usr_002' },
        ],
      },
    });

    const encrypted = encryptBackupData(originalPayload);

    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes in hex = 24 chars
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(encrypted.salt).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(encrypted.checksumSha256).toBe(computeSha256(originalPayload));

    // Decrypt and verify exact match
    const decrypted = decryptBackupData(encrypted);
    expect(decrypted).toBe(originalPayload);

    const parsed = JSON.parse(decrypted);
    expect(parsed.tables.users).toHaveLength(2);
    expect(parsed.tables.listings[0].title).toBe('Toyota RAV4 2022');
  });

  it('rejects tampered ciphertext with an authentication error', () => {
    const payload = JSON.stringify({ secret: 'critical-financial-transaction-record' });
    const encrypted = encryptBackupData(payload);

    // Tamper with the encrypted data base64 string
    const tamperedData = Buffer.from(encrypted.encryptedData, 'base64');
    tamperedData[0] = (tamperedData[0] ?? 0) ^ 0xff; // Flip bits in first byte
    const tamperedPayload = {
      ...encrypted,
      encryptedData: tamperedData.toString('base64'),
    };

    expect(() => decryptBackupData(tamperedPayload)).toThrow();
  });

  it('rejects tampered auth tag', () => {
    const payload = JSON.stringify({ safe: true });
    const encrypted = encryptBackupData(payload);

    const tamperedPayload = {
      ...encrypted,
      authTag: '00000000000000000000000000000000',
    };

    expect(() => decryptBackupData(tamperedPayload)).toThrow();
  });

  it('rejects tampered plaintext checksum', () => {
    const payload = JSON.stringify({ safe: true });
    const encrypted = encryptBackupData(payload);

    const tamperedPayload = {
      ...encrypted,
      checksumSha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    };

    expect(() => decryptBackupData(tamperedPayload)).toThrow(/checksum/i);
  });
});

describe('Backup Scopes & Default Configuration', () => {
  it('covers all critical Zenova platform domains in default scopes', () => {
    const requiredScopes = ['users', 'listings', 'transactions', 'messages', 'settings', 'feedback', 'files'];
    for (const scope of requiredScopes) {
      expect(DEFAULT_SCOPES).toContain(scope);
    }
  });
});

describe('Restoration Preview Diff Logic', () => {
  it('accurately calculates inserts, updates, and unaffected counts', () => {
    // Pure function logic mirroring safe restore diff algorithm
    function computeTableDiff(
      backupRows: Array<{ id: string; updatedAt: string; [key: string]: any }>,
      liveRows: Array<{ id: string; updatedAt: string; [key: string]: any }>
    ) {
      const liveMap = new Map(liveRows.map((r) => [r.id, r]));
      let toInsert = 0;
      let toUpdate = 0;
      let identical = 0;

      for (const bRow of backupRows) {
        const live = liveMap.get(bRow.id);
        if (!live) {
          toInsert++;
        } else if (new Date(bRow.updatedAt).getTime() !== new Date(live.updatedAt).getTime()) {
          toUpdate++;
        } else {
          identical++;
        }
      }

      const liveOnly = liveRows.filter((r) => !backupRows.some((b) => b.id === r.id)).length;

      return { toInsert, toUpdate, identical, liveOnly };
    }

    const backupRows = [
      { id: '1', title: 'Item 1', updatedAt: '2026-11-01T00:00:00Z' },
      { id: '2', title: 'Item 2 (v1)', updatedAt: '2026-11-01T00:00:00Z' },
      { id: '3', title: 'Item 3 (Deleted from live)', updatedAt: '2026-11-01T00:00:00Z' },
    ];

    const liveRows = [
      { id: '1', title: 'Item 1', updatedAt: '2026-11-01T00:00:00Z' }, // Identical
      { id: '2', title: 'Item 2 (v2 modified)', updatedAt: '2026-11-05T00:00:00Z' }, // Modified
      { id: '4', title: 'Item 4 (Created after backup)', updatedAt: '2026-11-08T00:00:00Z' }, // Live only
    ];

    const diff = computeTableDiff(backupRows, liveRows);

    expect(diff.toInsert).toBe(1); // Item 3
    expect(diff.toUpdate).toBe(1); // Item 2
    expect(diff.identical).toBe(1); // Item 1
    expect(diff.liveOnly).toBe(1); // Item 4
  });
});

describe('Data Loss and Corruption Detection Rules', () => {
  it('detects negative price or financial corruption in listings', () => {
    const listings = [
      { id: 'lst_valid', title: 'Smartphone', price: 150000 },
      { id: 'lst_corrupt_1', title: 'Corrupted price', price: -500 },
      { id: 'lst_corrupt_2', title: 'NaN price', price: NaN },
    ];

    const corruptListings = listings.filter(
      (l) => typeof l.price !== 'number' || isNaN(l.price) || l.price < 0
    );

    expect(corruptListings).toHaveLength(2);
    expect(corruptListings.map((l) => l.id)).toEqual(['lst_corrupt_1', 'lst_corrupt_2']);
  });

  it('detects orphan records with missing parent references', () => {
    const users = [{ id: 'usr_1' }, { id: 'usr_2' }];
    const listings = [
      { id: 'lst_1', sellerId: 'usr_1' },
      { id: 'lst_2', sellerId: 'usr_999_deleted' }, // Orphan
    ];

    const userSet = new Set(users.map((u) => u.id));
    const orphans = listings.filter((l) => !userSet.has(l.sellerId));

    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.id).toBe('lst_2');
  });
});

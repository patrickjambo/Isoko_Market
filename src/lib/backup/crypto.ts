import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;

/**
 * Derives a 32-byte key from the platform secret.
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.AUTH_SECRET || 'zenova-secure-backup-master-secret-key-2026';
  return scryptSync(secret, salt, 32);
}

/**
 * Computes a SHA-256 hex checksum of a buffer or string.
 */
export function computeSha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export type EncryptedPayload = {
  encryptedData: string; // base64
  iv: string; // hex
  authTag: string; // hex
  salt: string; // hex
  checksumSha256: string; // hash of plaintext
};

/**
 * Encrypts data using AES-256-GCM with authentication tag and salt.
 */
export function encryptBackupData(plainText: string): EncryptedPayload {
  const salt = randomBytes(SALT_LENGTH);
  const key = getEncryptionKey(salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const buffer = Buffer.from(plainText, 'utf8');
  const checksumSha256 = computeSha256(buffer);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
    checksumSha256,
  };
}

/**
 * Decrypts data using AES-256-GCM and verifies SHA-256 checksum integrity.
 */
export function decryptBackupData(payload: EncryptedPayload): string {
  const salt = Buffer.from(payload.salt, 'hex');
  const key = getEncryptionKey(salt);
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const encrypted = Buffer.from(payload.encryptedData, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const plainText = decrypted.toString('utf8');

  // Verify integrity checksum
  const verifiedChecksum = computeSha256(decrypted);
  if (verifiedChecksum !== payload.checksumSha256) {
    throw new Error('Backup integrity verification failed: SHA-256 checksum mismatch (data was tampered or corrupted).');
  }

  return plainText;
}

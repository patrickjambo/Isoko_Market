import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from '../src/lib/push-client';

describe('Web Push client helpers', () => {
  it('correctly converts base64url string to Uint8Array', () => {
    // Standard test base64url string
    const testKey = 'BNGZY0XmsE2FdHVmBKDOIqzr-I6Hb0BkgILMqAOCtNg2-VOSltKEZGB_vWv5UfCF-stofE56ctoYNaxYgC4pkqY';
    const uint8Arr = urlBase64ToUint8Array(testKey);

    expect(uint8Arr).toBeInstanceOf(Uint8Array);
    expect(uint8Arr.length).toBeGreaterThan(0);
    // VAPID uncompressed public key should be 65 bytes
    expect(uint8Arr.length).toBe(65);
  });

  it('handles padded and unpadded base64 strings', () => {
    const raw = 'dGVzdC1zdHJpbmc';
    const arr = urlBase64ToUint8Array(raw);
    expect(arr.length).toBe(11);
  });
});

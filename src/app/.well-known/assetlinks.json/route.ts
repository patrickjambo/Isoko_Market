import { NextResponse } from 'next/server';

/**
 * Digital Asset Links — required for Android TWA (Trusted Web Activity).
 *
 * This file proves to the Android OS that zenova.rw and the Play Store app
 * (rw.zenova.app) are owned by the same entity. Without it, Chrome will show
 * its URL bar inside the TWA, breaking the full-screen native experience.
 *
 * HOW TO FILL IN sha256_cert_fingerprints:
 *   1. After generating your signing key in PWABuilder or Android Studio, run:
 *        keytool -list -v -keystore zenova.keystore
 *   2. Copy the "SHA256:" value (colons included) into the array below.
 *   OR
 *   1. In Google Play Console → App Integrity → App signing tab.
 *   2. Copy the "SHA-256 certificate fingerprint" shown there.
 *
 * The ASSETLINKS_SHA256 environment variable overrides the placeholder so you
 * can set the real fingerprint in Vercel without touching this file.
 */

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME ?? 'rw.zenova.app';

// Set ASSETLINKS_SHA256 in Vercel env vars once you have your signing key.
// Format: "AA:BB:CC:DD:..." (colon-separated uppercase hex)
const SHA256 =
  process.env.ASSETLINKS_SHA256 ??
  'PLACEHOLDER:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';

const assetLinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: [SHA256],
    },
  },
];

export function GET() {
  return NextResponse.json(assetLinks, {
    headers: {
      // Cache for 1 hour — Android caches this aggressively
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  });
}

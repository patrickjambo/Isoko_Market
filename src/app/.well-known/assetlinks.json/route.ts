import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Digital Asset Links — required for Android TWA (Trusted Web Activity).
 *
 * This file proves to the Android OS that www.zenova.rw and the Play Store app
 * (rw.zenova.app) are owned by the same entity. Without it, Chrome will show
 * its URL bar inside the TWA, breaking the full-screen native experience.
 *
 * IMPORTANT: Android Digital Asset Links does NOT follow HTTP redirects, so
 * PWABuilder / Bubblewrap MUST target https://www.zenova.rw (with "www"),
 * where /.well-known/assetlinks.json responds directly with HTTP 200.
 *
 * HOW TO FILL IN sha256_cert_fingerprints:
 *   1. In PWABuilder's downloaded Android zip, open assetlinks.json (or signing-key-info.txt)
 *      and copy the SHA-256 fingerprint (upload/test key).
 *   2. Once uploaded to Google Play Console -> Setup -> App integrity -> App signing,
 *      copy the Play App Signing "SHA-256 certificate fingerprint" as well.
 *   3. Set ASSETLINKS_SHA256 in Vercel Environment Variables to one fingerprint or
 *      comma-separated fingerprints:
 *        AA:BB:CC:...,11:22:33:...
 */

const PLACEHOLDER_SHA256 =
  'PLACEHOLDER:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME ?? 'rw.zenova.app';
  const rawFingerprints = process.env.ASSETLINKS_SHA256 ?? PLACEHOLDER_SHA256;

  // Support comma-separated fingerprints so both PWABuilder's upload/APK key and
  // Google Play App Signing's release key can be authorized at the same time.
  const fingerprints = rawFingerprints
    .split(',')
    .map((fp) => fp.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints.length > 0 ? fingerprints : [PLACEHOLDER_SHA256],
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    headers: {
      // Cache briefly — Android caches this, short TTL makes key rollout quick
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json',
    },
  });
}

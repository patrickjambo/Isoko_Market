import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificationSubmitSchema } from '@/lib/validators/misc';
import { emitAdmin } from '@/lib/admin-realtime';
import { publish } from '@/lib/realtime';

/**
 * GET /api/verification — get the current user's verification status.
 */
export const GET = route(async () => {
  const user = await requireUser();
  return jsonOk({
    status: user.verificationStatus,
    isVerified: user.isVerified,
    hasIdDocument: Boolean(user.idDocumentUrl),
  });
});

/**
 * POST /api/verification — submit a National ID for review.
 *
 * Strategy:
 *  1. Immediately save the submission to DB (fast, never fails the user).
 *  2. Fire OCR extraction in the background — doesn't block the response.
 *     If OCR fails for any reason, the submission is still saved and queued
 *     for manual admin review.
 *
 * This prevents Vercel's 10s serverless timeout from killing a valid submission
 * when external OCR API calls (Anthropic Vision) take too long.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { idDocumentUrl } = verificationSubmitSchema.parse(await req.json().catch(() => ({})));

  // ── Step 1: Save submission immediately ──────────────────────────────────
  // Always succeeds — no external calls, no OCR blocking the user.
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { idDocumentUrl, verificationStatus: 'PENDING' },
      }),
      prisma.verificationRequest.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          idDocumentUrl,
          status: 'PENDING',
          needsManualReview: true,
        },
        update: {
          idDocumentUrl,
          status: 'PENDING',
          reviewedAt: null,
          reviewNote: null,
          // Reset OCR fields so the background job re-runs on resubmission
          extractedFullName: null,
          extractedIdNumber: null,
          extractedCountry: null,
          ocrConfidence: null,
          ocrRawText: null,
          needsManualReview: true,
        },
      }),
    ]);
  } catch (dbErr) {
    // If OCR columns don't exist yet (migration pending), fall back to minimal save
    console.error('[verification] Full upsert failed, trying minimal save:', dbErr);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { idDocumentUrl, verificationStatus: 'PENDING' },
      }),
      prisma.verificationRequest.upsert({
        where: { userId: user.id },
        create: { userId: user.id, idDocumentUrl, status: 'PENDING' },
        update: { idDocumentUrl, status: 'PENDING', reviewedAt: null, reviewNote: null },
      }),
    ]);
  }

  // ── Step 2: Notify admin dashboard in real-time ──────────────────────────
  await emitAdmin('verification.pending', `${user.fullName} submitted an ID for verification`);

  // Notify the submitting user immediately so their UI updates to PENDING
  publish(user.id, { type: 'verification_updated', status: 'PENDING' });

  // ── Step 3: Fire background OCR (non-blocking, never fails the request) ──
  // We deliberately do NOT await this. It updates the DB record after the
  // response has already been sent. On Vercel, use waitUntil if available,
  // otherwise the background microtask runs until the function cold-terminates
  // (fine — if it doesn't finish, the admin can manually trigger re-OCR).
  runOcrInBackground(user.id, idDocumentUrl, user.fullName ?? undefined);

  return jsonOk({ ok: true, status: 'PENDING' });
});

/**
 * Background OCR job — runs after the HTTP response is sent.
 * Updates the verification request with extracted data.
 * Any error is swallowed so it never surfaces to the user.
 */
async function runOcrInBackground(
  userId: string,
  idDocumentUrl: string,
  userFullName?: string
): Promise<void> {
  try {
    const { getFileBytes } = await import('@/lib/storage');
    const { extractIdDocumentData } = await import('@/lib/verification/ocr');

    const key = idDocumentUrl.startsWith('/uploads/')
      ? idDocumentUrl.slice('/uploads/'.length)
      : idDocumentUrl;

    const bytes = await getFileBytes(key);
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const ocrResult = await extractIdDocumentData({ imageBuffer: bytes, mimeType, userFullName });

    // Write OCR results back to the existing record (non-transactional, best-effort)
    await prisma.verificationRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: {
        extractedFullName: ocrResult.fullName,
        extractedIdNumber: ocrResult.idNumber,
        extractedCountry: ocrResult.country,
        ocrConfidence: ocrResult.confidence,
        ocrRawText: ocrResult.rawText,
        needsManualReview: ocrResult.needsManualReview,
      },
    });

    // Re-notify admin with richer info once OCR data is available
    if (ocrResult.idNumber || ocrResult.fullName) {
      await emitAdmin(
        'verification.ocr_ready',
        `OCR complete for ${userFullName ?? userId}: ${ocrResult.fullName ?? 'Unknown'} (ID: ${ocrResult.idNumber ?? 'not extracted'})`
      );
    }
  } catch (err) {
    // Swallow — admin can manually re-trigger OCR from the review panel
    console.error('[verification] Background OCR failed (non-fatal):', err);
  }
}

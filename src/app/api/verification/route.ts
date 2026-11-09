import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificationSubmitSchema } from '@/lib/validators/misc';
import { emitAdmin } from '@/lib/admin-realtime';
import { publish } from '@/lib/realtime';
import { getFileBytes } from '@/lib/storage';
import { extractIdDocumentData, type IdExtractionResult } from '@/lib/verification/ocr';

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
 * POST /api/verification — submit a National ID for review (Section 6.1).
 * The document key is stored privately and only ever served via signed URLs;
 * the account moves to PENDING until the admin trust team approves it.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { idDocumentUrl } = verificationSubmitSchema.parse(await req.json().catch(() => ({})));

  // Perform automated OCR extraction on the uploaded ID
  let ocrResult: IdExtractionResult = {
    fullName: null,
    idNumber: null,
    country: 'Rwanda',
    confidence: 0,
    rawText: '',
    needsManualReview: true,
    reviewReasons: ['Automated extraction pending review'],
  };

  try {
    const key = idDocumentUrl.startsWith('/uploads/')
      ? idDocumentUrl.slice('/uploads/'.length)
      : idDocumentUrl;
    const bytes = await getFileBytes(key);
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    ocrResult = await extractIdDocumentData({
      imageBuffer: bytes,
      mimeType,
      userFullName: user.fullName,
    });
  } catch (ocrErr) {
    console.error('[verification] Automated OCR extraction encountered an error:', ocrErr);
    ocrResult.reviewReasons.push('File could not be parsed automatically');
  }

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
        extractedFullName: ocrResult.fullName,
        extractedIdNumber: ocrResult.idNumber,
        extractedCountry: ocrResult.country,
        ocrConfidence: ocrResult.confidence,
        ocrRawText: ocrResult.rawText,
        needsManualReview: ocrResult.needsManualReview,
      },
      update: {
        idDocumentUrl,
        status: 'PENDING',
        reviewedAt: null,
        reviewNote: null,
        extractedFullName: ocrResult.fullName,
        extractedIdNumber: ocrResult.idNumber,
        extractedCountry: ocrResult.country,
        ocrConfidence: ocrResult.confidence,
        ocrRawText: ocrResult.rawText,
        needsManualReview: ocrResult.needsManualReview,
      },
    }),
  ]);

  // Live-notify the trust team that a new ID is awaiting review.
  await emitAdmin(
    'verification.pending',
    `${user.fullName} submitted an ID for verification ${
      ocrResult.idNumber ? `(Extracted ID: ${ocrResult.idNumber})` : ''
    }`
  );

  // Live-notify the submitting user so client UI updates in realtime.
  publish(user.id, { type: 'verification_updated', status: 'PENDING' });

  return jsonOk({ ok: true, status: 'PENDING', ocr: ocrResult });
});

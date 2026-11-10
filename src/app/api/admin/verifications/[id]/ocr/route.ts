import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api';
import { getFileBytes } from '@/lib/storage';
import { extractIdDocumentData } from '@/lib/verification/ocr';

// Allow up to 60s for OCR on Vercel (Pro plan allows up to 300s)
export const maxDuration = 60;

/**
 * POST /api/admin/verifications/[id]/ocr — Re-trigger OCR extraction on an ID document.
 */
export const POST = adminRoute('verification.view', async (_req, ctx: { params: { id: string } }) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: ctx.params.id },
    include: { user: true },
  });

  if (!request) {
    throw new ApiError('NOT_FOUND', 'Verification request not found.');
  }

  const rawUrl = request.idDocumentUrl;
  const key = rawUrl.startsWith('/uploads/') ? rawUrl.slice('/uploads/'.length) : rawUrl;

  let bytes: Buffer;
  try {
    bytes = await getFileBytes(key);
  } catch {
    throw new ApiError('NOT_FOUND', 'Document file is unavailable in storage.');
  }

  const ext = key.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const ocrResult = await extractIdDocumentData({
    imageBuffer: bytes,
    mimeType,
    userFullName: request.user.fullName,
  });

  const updated = await prisma.verificationRequest.update({
    where: { id: request.id },
    data: {
      extractedFullName: ocrResult.fullName,
      extractedIdNumber: ocrResult.idNumber,
      extractedCountry: ocrResult.country,
      ocrConfidence: ocrResult.confidence,
      ocrRawText: ocrResult.rawText,
      needsManualReview: ocrResult.needsManualReview,
    },
  });

  return {
    data: {
      ocr: ocrResult,
      request: updated,
    },
  };
});

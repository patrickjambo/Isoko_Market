import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveDocument } from '@/lib/storage';
import { rateLimit } from '@/lib/rate-limit';

const TYPES = ['CV', 'COVER_LETTER', 'CERTIFICATE', 'ID_DOCUMENT', 'OTHER'] as const;
type DocType = (typeof TYPES)[number];
const MAX_DOCS = 30;

/** GET /api/documents — the signed-in user's own uploaded documents (metadata only). */
export const GET = route(async () => {
  const user = await requireUser();
  const items = await prisma.seekerDocument.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, label: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  return jsonOk({ items });
});

/**
 * POST /api/documents — upload a document from the device (multipart: file +
 * type). Stored PRIVATE; only the owner and an employer the user applied to can
 * later read it (see /api/documents/[id]/file).
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();

  const limit = rateLimit(`docupload:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.success) throw new ApiError('RATE_LIMITED', 'Too many uploads. Try again later.');

  const form = await req.formData();
  const file = form.get('file');
  const type = String(form.get('type') ?? 'OTHER') as DocType;
  if (!(file instanceof File)) throw new ApiError('BAD_REQUEST', 'No file provided.');
  if (!TYPES.includes(type)) throw new ApiError('BAD_REQUEST', 'Invalid document type.');

  const count = await prisma.seekerDocument.count({ where: { userId: user.id } });
  if (count >= MAX_DOCS) throw new ApiError('CONFLICT', 'You have reached the document limit.');

  let saved;
  try {
    saved = await saveDocument(file);
  } catch (err) {
    throw new ApiError('BAD_REQUEST', err instanceof Error ? err.message : 'Upload failed.');
  }

  const label = (file.name || 'document').slice(0, 120);
  const doc = await prisma.seekerDocument.create({
    data: {
      userId: user.id,
      type,
      label,
      key: saved.key,
      mimeType: file.type,
      sizeBytes: file.size,
    },
    select: { id: true, type: true, label: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  return jsonOk(doc, { status: 201 });
});

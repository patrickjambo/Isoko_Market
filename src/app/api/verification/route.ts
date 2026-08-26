import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificationSubmitSchema } from '@/lib/validators/misc';
import { emitAdmin } from '@/lib/admin-realtime';

/**
 * POST /api/verification — submit a National ID for review (Section 6.1).
 * The document key is stored privately and only ever served via signed URLs;
 * the account moves to PENDING until the admin trust team approves it.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { idDocumentUrl } = verificationSubmitSchema.parse(await req.json().catch(() => ({})));

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

  // Live-notify the trust team that a new ID is awaiting review.
  await emitAdmin('verification.pending', `${user.fullName} submitted an ID for verification`);

  return jsonOk({ ok: true, status: 'PENDING' });
});

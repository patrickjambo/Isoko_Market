import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileBytes } from '@/lib/storage';
import { effectivePermissions } from '@/lib/permissions';

/**
 * GET /api/admin/disputes/[orderId]/proof — stream the buyer's proof-of-payment
 * image for a disputed order, to an admin with `moderation.view`. Proxied so the
 * private storage URL is never exposed.
 */
export async function GET(_req: Request, ctx: { params: { orderId: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await effectivePermissions(user)).has('moderation.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: ctx.params.orderId },
    select: { buyerPaymentProofUrl: true },
  });
  if (!order?.buyerPaymentProofUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = order.buyerPaymentProofUrl;
  const key = raw.startsWith('/uploads/') ? raw.slice('/uploads/'.length) : raw;

  let bytes: Buffer;
  try {
    bytes = await getFileBytes(key);
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  }

  const ext = key.split('.').pop()?.toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';

  return new NextResponse(new Blob([new Uint8Array(bytes)], { type: contentType }), {
    headers: {
      'content-type': contentType,
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
    },
  });
}

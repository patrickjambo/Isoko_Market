import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileBytes } from '@/lib/storage';
import { effectivePermissions } from '@/lib/permissions';

/**
 * GET /api/admin/verifications/[id]/document — stream the National ID a user
 * submitted, to an admin with `verification.view`. The bytes are proxied so the
 * underlying (unlisted) storage URL is never exposed in the admin's HTML, and
 * access is gated by permission + audited by the surrounding admin area (§10).
 */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const perms = await effectivePermissions(user);
  if (!perms.has('verification.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const vr = await prisma.verificationRequest.findUnique({
    where: { id: ctx.params.id },
    select: { idDocumentUrl: true },
  });
  if (!vr?.idDocumentUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Stored value is a URL: local `/uploads/<key>` or a full blob/S3 URL. Normalize
  // back to a storage key so getFileBytes can read it on any driver.
  const raw = vr.idDocumentUrl;
  const key = raw.startsWith('/uploads/') ? raw.slice('/uploads/'.length) : raw;

  let bytes: Buffer;
  try {
    bytes = await getFileBytes(key);
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  }

  const ext = key.split('.').pop()?.toLowerCase();
  const contentType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'pdf'
          ? 'application/pdf'
          : 'image/jpeg';

  return new NextResponse(new Blob([new Uint8Array(bytes)], { type: contentType }), {
    headers: {
      'content-type': contentType,
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
    },
  });
}

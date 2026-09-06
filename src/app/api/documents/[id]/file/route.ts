import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileBytes } from '@/lib/storage';

/**
 * GET /api/documents/[id]/file — stream a private document to an AUTHORIZED
 * viewer only: the owner, or an employer who has received an application from
 * this seeker. The file bytes are proxied so the underlying storage URL is never
 * exposed (matters for ID documents).
 */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.seekerDocument.findUnique({
    where: { id: ctx.params.id },
    select: { userId: true, key: true, mimeType: true, label: true },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let allowed = doc.userId === user.id;
  if (!allowed) {
    const app = await prisma.application.findFirst({
      where: { applicantId: doc.userId, job: { employerId: user.id } },
      select: { id: true },
    });
    allowed = Boolean(app);
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let bytes: Buffer;
  try {
    bytes = await getFileBytes(doc.key);
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  }

  const contentType = doc.mimeType || 'application/octet-stream';
  return new NextResponse(new Blob([new Uint8Array(bytes)], { type: contentType }), {
    headers: {
      'content-type': contentType,
      'content-disposition': `inline; filename="${encodeURIComponent(doc.label)}"`,
      'cache-control': 'private, no-store',
    },
  });
}

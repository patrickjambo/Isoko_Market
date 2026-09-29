import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileBytes } from '@/lib/storage';

/**
 * GET /api/applications/[id]/documents/[docId]/file — stream a document the
 * applicant attached to this application, to an AUTHORIZED viewer only: the
 * applicant themselves, or the employer who owns the job. Bytes are proxied so
 * the private storage key is never exposed.
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string; docId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await prisma.applicationDocument.findFirst({
    where: { id: ctx.params.docId, applicationId: ctx.params.id },
    select: {
      label: true,
      key: true,
      mimeType: true,
      application: {
        select: { applicantId: true, job: { select: { employerId: true } } },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed =
    doc.application.applicantId === user.id || doc.application.job.employerId === user.id;
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let bytes: Buffer;
  try {
    bytes = await getFileBytes(doc.key);
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  }

  return new NextResponse(new Blob([new Uint8Array(bytes)], { type: doc.mimeType || 'application/octet-stream' }), {
    headers: {
      'content-type': doc.mimeType || 'application/octet-stream',
      'content-disposition': `inline; filename="${encodeURIComponent(doc.label)}"`,
      'cache-control': 'private, no-store',
    },
  });
}

import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cvDataSchema } from '@/lib/validators/cv';

async function ownCv(userId: string, id: string) {
  const cv = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!cv) throw new ApiError('NOT_FOUND', 'CV not found.');
  return cv;
}

/** GET /api/cv/[id] — one CV's data + name (for the builder). */
export const GET = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const cv = await prisma.cV.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: { name: true, structuredData: true, updatedAt: true },
  });
  if (!cv) throw new ApiError('NOT_FOUND', 'CV not found.');
  return jsonOk({ name: cv.name, data: cv.structuredData ?? null, updatedAt: cv.updatedAt });
});

/** PUT /api/cv/[id] — save this CV's content (guided builder save/autosave). */
export const PUT = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  await ownCv(user.id, ctx.params.id);

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const data = cvDataSchema.parse(body);

  const fields: Record<string, string> = {};
  if (!data.headline?.trim() || data.headline.trim().length < 3) {
    fields.headline = 'Please enter your professional headline.';
  }
  if (!data.skills || data.skills.length === 0) {
    fields.skills = 'Please select at least one skill.';
  }
  if (!data.summary?.trim() || data.summary.trim().length < 10) {
    fields.summary = 'Please write a brief summary about yourself (at least 10 characters).';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.contactEmail?.trim()) {
    fields.contactEmail = 'Please enter your contact email.';
  } else if (!emailRegex.test(data.contactEmail.trim())) {
    fields.contactEmail = 'Please enter a valid email address.';
  }
  if (!data.location?.id && !data.location?.label) {
    fields.location = 'Please select your location.';
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError('VALIDATION', 'Please fill all required fields before saving your CV.', fields);
  }

  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : undefined;

  // Mirror the selected division to the queryable column (validated against the
  // seeded AdminDivision table); the display label lives in structuredData.
  let locationId: string | null = null;
  if (data.location?.id) {
    const div = await prisma.adminDivision.findUnique({
      where: { id: data.location.id },
      select: { id: true },
    });
    locationId = div?.id ?? null;
  }

  const cv = await prisma.cV.update({
    where: { id: ctx.params.id },
    data: { structuredData: data, locationId, ...(name ? { name } : {}) },
    select: { id: true, updatedAt: true },
  });
  return jsonOk({ id: cv.id, updatedAt: cv.updatedAt });
});

/** DELETE /api/cv/[id] — remove a CV from the library. Past applications keep
 *  their own immutable cvSnapshot, so nothing already submitted is affected. */
export const DELETE = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  await ownCv(user.id, ctx.params.id);
  await prisma.cV.delete({ where: { id: ctx.params.id } });
  return jsonOk({ ok: true });
});

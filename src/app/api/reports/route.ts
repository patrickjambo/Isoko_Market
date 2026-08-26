import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reportSchema } from '@/lib/validators/misc';
import { rateLimit } from '@/lib/rate-limit';
import { emitAdmin } from '@/lib/admin-realtime';

/** POST /api/reports — flag a listing/job/user/message into the admin queue. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = reportSchema.parse(await req.json().catch(() => ({})));

  const limit = rateLimit(`report:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.success) throw new ApiError('RATE_LIMITED', 'Too many reports. Try again later.');

  await prisma.report.create({
    data: {
      reportedById: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details,
    },
  });

  // Live-notify the moderation team (admin:report.created).
  await emitAdmin('report.created', `${input.targetType.toLowerCase()} reported: ${input.reason}`);

  return jsonOk({ ok: true });
});
